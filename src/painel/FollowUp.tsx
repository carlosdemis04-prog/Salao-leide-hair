import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { WhatsAppIcon } from '../icons'
import { whatsappLink } from './util'

// Parabéns, follow up ou oferta pelo WhatsApp. Antes de montar a mensagem, a Leide escolhe o benefício.
// Se for desconto, o banco cria um cupom de verdade (migração 0016), validado no "Validar código" da aba Pontos.

export type Motivo = 'aniversario' | 'follow_up' | 'oferta'
type Beneficio = 'desconto' | 'servico' | 'mimo' | 'nenhum'

const MOTIVOS: { key: Motivo; label: string }[] = [
  { key: 'aniversario', label: 'Parabéns de aniversário' },
  { key: 'follow_up', label: 'Follow up (saudade)' },
  { key: 'oferta', label: 'Oferecer serviço com desconto' },
]

const BENEFICIOS: { key: Beneficio; label: string }[] = [
  { key: 'desconto', label: 'Desconto no próximo atendimento' },
  { key: 'servico', label: 'Desconto num serviço' },
  { key: 'mimo', label: 'Um mimo ou brinde' },
  { key: 'nenhum', label: 'Nenhum, só a mensagem' },
]

const dataFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long' })

type Props = {
  phone: string
  nome: string
  motivoInicial: Motivo
  interesses?: string[]
  naoQuerReceber?: boolean
  fechar: () => void
  aoEnviar?: () => void
}

export default function FollowUp({ phone, nome, motivoInicial, interesses = [], naoQuerReceber, fechar, aoEnviar }: Props) {
  const primeiro = nome.split(' ')[0]
  const [motivo, setMotivo] = useState<Motivo>(motivoInicial)
  const [beneficio, setBeneficio] = useState<Beneficio | null>(null)
  const [pct, setPct] = useState('10')
  const [dias, setDias] = useState('30')
  const [servico, setServico] = useState(interesses[0] ?? '')
  const [mimo, setMimo] = useState('')
  const [servicos, setServicos] = useState<string[]>([])
  const [texto, setTexto] = useState<string | null>(null)
  const [estado, setEstado] = useState('')
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    supabase!
      .from('services')
      .select('name')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setServicos(((data as { name: string }[]) ?? []).map((s) => s.name)))
  }, [])

  const comDesconto = beneficio === 'desconto' || beneficio === 'servico'

  function descricao() {
    if (beneficio === 'desconto') return `${pct}% de desconto no próximo atendimento`
    if (beneficio === 'servico') return `${pct}% de desconto em ${servico}`
    if (beneficio === 'mimo') return `Mimo: ${mimo.trim()}`
    return 'Só a mensagem'
  }

  function montar(codigo: string | null, expira: string | null) {
    const app = `${location.origin}/app`
    const validade = codigo && expira ? ` Use o código ${codigo} até ${dataFmt.format(new Date(expira))}.` : ''
    const presente =
      beneficio === 'desconto'
        ? `${pct}% de desconto no seu próximo atendimento.${validade}`
        : beneficio === 'servico'
          ? `${pct}% de desconto em ${servico}.${validade}`
          : beneficio === 'mimo'
            ? `${mimo.trim()} no seu próximo atendimento.`
            : ''
    if (motivo === 'aniversario') {
      return presente
        ? `Feliz aniversário, ${primeiro}! 🎉 Que seu novo ano seja lindo. Para comemorar, você ganhou ${presente} É só marcar aqui ou pelo app: ${app}. Beijos, Leide Hair`
        : `Feliz aniversário, ${primeiro}! 🎉 Que seu novo ano seja lindo e cheio de coisas boas. Beijos, Leide Hair`
    }
    if (motivo === 'oferta') {
      return presente
        ? `Oi, ${primeiro}! Aqui é a Leide, do Leide Hair 💛 Separei uma oferta especial pra você: ${presente} Vamos marcar? Responde aqui ou agenda pelo app: ${app}`
        : `Oi, ${primeiro}! Aqui é a Leide, do Leide Hair 💛 Tenho horários livres essa semana. Vamos marcar? Responde aqui ou agenda pelo app: ${app}`
    }
    return presente
      ? `Oi, ${primeiro}! Tudo bem? Aqui é a Leide, do Leide Hair 💛 Estava lembrando de você e preparei um presente: ${presente} Quer marcar um horário? Responde aqui ou agenda pelo app: ${app}`
      : `Oi, ${primeiro}! Tudo bem? Aqui é a Leide, do Leide Hair 💛 Que saudade de você aqui no salão. Quer marcar um horário? Responde aqui ou agenda pelo app: ${app}`
  }

  async function preparar() {
    if (!beneficio) return setEstado('Escolha o benefício antes de continuar.')
    const p = Number(pct)
    const d = Number(dias)
    if (comDesconto && (!Number.isInteger(p) || p < 1 || p > 100)) return setEstado('Escreva um desconto de 1 a 100%.')
    if (comDesconto && (!Number.isInteger(d) || d < 1 || d > 365)) return setEstado('A validade vai de 1 a 365 dias.')
    if (beneficio === 'servico' && !servico) return setEstado('Escolha o serviço.')
    if (beneficio === 'mimo' && mimo.trim().length < 3) return setEstado('Escreva qual é o mimo.')
    setEstado('Preparando…')
    const { data, error } = await supabase!.rpc('crm_follow_up', {
      p_phone: phone,
      p_motivo: motivo,
      p_beneficio: descricao(),
      p_desconto: comDesconto ? p : null,
      p_dias: comDesconto ? d : null,
      p_servico: beneficio === 'servico' ? servico : null,
    })
    if (error) {
      return setEstado(
        error.message.includes('crm_follow_up')
          ? 'Rode o arquivo 0016_questionario.sql no Supabase para usar o follow up.'
          : 'Não foi possível preparar. Confira a internet e tente de novo.',
      )
    }
    const r = data as { codigo: string | null; expira_em: string | null }
    setTexto(montar(r.codigo, r.expira_em))
    setEstado('')
  }

  return (
    <div className="pn-box pn-follow">
      <div className="pn-follow-topo">
        <h3>Mensagem para {primeiro}</h3>
        <button type="button" className="pn-chip" onClick={fechar}>
          Fechar
        </button>
      </div>
      {naoQuerReceber && (
        <p className="pn-error">No questionário, {primeiro} pediu para não receber ofertas. Mande só se ela pedir.</p>
      )}

      {texto === null ? (
        <>
          <p className="pn-follow-passo">1. O que você quer mandar?</p>
          <div className="pn-row pn-row-left">
            {MOTIVOS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`pn-chip ${motivo === m.key ? 'pn-chip-dark' : ''}`}
                onClick={() => (setMotivo(m.key), setEstado(''))}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="pn-follow-passo">2. Qual benefício você vai dar?</p>
          <div className="pn-row pn-row-left">
            {BENEFICIOS.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`pn-chip ${beneficio === b.key ? 'pn-chip-dark' : ''}`}
                onClick={() => (setBeneficio(b.key), setEstado(''))}
              >
                {b.label}
              </button>
            ))}
          </div>

          {beneficio === 'servico' && (
            <label className="pn-field">
              <span>Serviço</span>
              <select value={servico} onChange={(e) => setServico(e.target.value)}>
                <option value="">Escolha</option>
                {[...new Set([...interesses, ...servicos])].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          {beneficio === 'servico' && interesses.length > 0 && (
            <p className="pn-muted">Ela disse que se interessa por: {interesses.join(', ')}.</p>
          )}
          {comDesconto && (
            <div className="pn-grid2">
              <label className="pn-field">
                <span>Desconto (%)</span>
                <input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </label>
              <label className="pn-field">
                <span>Vale por quantos dias</span>
                <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </label>
            </div>
          )}
          {beneficio === 'mimo' && (
            <label className="pn-field">
              <span>Qual mimo?</span>
              <input value={mimo} maxLength={80} placeholder="Ex.: uma hidratação de presente" onChange={(e) => setMimo(e.target.value)} />
            </label>
          )}

          <div className="pn-save">
            <button type="button" className="btn btn-primary" onClick={preparar} disabled={!beneficio}>
              Preparar mensagem
            </button>
            {estado && <span className="pn-muted-inline">{estado}</span>}
          </div>
          {comDesconto && <p className="pn-muted">O código do desconto é criado agora e entra na mensagem.</p>}
        </>
      ) : (
        <>
          <p className="pn-follow-passo">3. Confira e mande</p>
          <label className="pn-field">
            <span className="sr-only">Mensagem</span>
            <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="pn-row pn-row-left">
            <a
              className="pn-btn pn-btn-dark"
              href={whatsappLink(phone, texto)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                setEnviado(true)
                aoEnviar?.()
              }}
            >
              <WhatsAppIcon /> Abrir no WhatsApp
            </a>
            {enviado && <span className="pn-ok">Pronto! Fica anotado no histórico dela.</span>}
          </div>
        </>
      )}
    </div>
  )
}
