import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { WhatsAppIcon } from '../icons'
import { carregarNumeros, diaDe, nomeDoMes, variacao, type Cliente, type Numeros, type Visita } from './dados'
import { addDays, brl, capitalize, dayTitleFmt, ENDERECO, timeFmt, whatsappLink } from './util'

export type Destino = 'agenda' | 'pontos' | 'clientes' | 'divulgar' | 'mais'

const reais = (c: number) => brl.format(c / 100)
const reaisCurto = (c: number) =>
  c >= 100_000 ? `R$ ${(c / 100_000).toFixed(1).replace('.', ',')} mil` : `R$ ${Math.round(c / 100)}`

function Seta({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const sobe = pct >= 0
  return (
    <span className={`pn-var ${sobe ? 'up' : 'down'}`}>
      {sobe ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

export default function Inicio({ onIr, resgates }: { onIr: (d: Destino) => void; resgates: number }) {
  const [n, setN] = useState<Numeros | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [aConfirmar, setAConfirmar] = useState(0)
  const [erro, setErro] = useState('')

  const load = useCallback(async () => {
    try {
      const [numeros, cl, pend] = await Promise.all([
        carregarNumeros(),
        supabase!.from('clients').select('phone, name, birthday, origin, notes, created_at'),
        supabase!
          .from('appointments')
          .select('id')
          .eq('status', 'pendente')
          .gte('starts_at', new Date().toISOString())
          .limit(200),
      ])
      setN(numeros)
      setClientes((cl.data as Cliente[]) ?? [])
      setAConfirmar(pend.data?.length ?? 0)
      if (cl.error) setErro('Rode o arquivo 0009 no Supabase para ver aniversários e clientes.')
    } catch {
      setErro('Não foi possível carregar os números. Confira a internet. (Já rodou o arquivo 0009 no Supabase?)')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!n) return <section className="pn-section">{erro ? <p className="pn-error">{erro}</p> : <p className="pn-muted">Carregando…</p>}</section>

  const pctEntrou = variacao(n.entrou, n.entrouAntes)
  const amanha = addDays(n.hoje, 1)
  const deHoje = n.visitas.filter((v) => diaDe(v.starts_at) === n.hoje && v.status !== 'cancelado')
  const deAmanha = n.visitas.filter((v) => diaDe(v.starts_at) === amanha && (v.status === 'confirmado' || v.status === 'pendente'))

  const semana = Array.from({ length: 7 }, (_, i) => addDays(n.hoje, i).slice(5))
  const aniversariantes = clientes.filter((c) => c.birthday && semana.includes(c.birthday.slice(5)))

  // Sumidas: a última visita foi há mais de 60 dias e não tem nada marcado
  const ultima = new Map<string, string>()
  const futura = new Set<string>()
  for (const v of n.visitas) {
    const d = diaDe(v.starts_at)
    if (v.status === 'concluido') ultima.set(v.client_phone, d)
    if (d >= n.hoje && (v.status === 'pendente' || v.status === 'confirmado')) futura.add(v.client_phone)
  }
  const limite = addDays(n.hoje, -60)
  const sumidas = [...ultima.entries()].filter(([p, d]) => d < limite && !futura.has(p)).length

  const maiorMes = Math.max(1, ...n.meses.map((m) => m.entrou))
  const maiorServico = Math.max(1, ...n.topServicos.map((s) => s.valor))
  const maiorDia = Math.max(1, ...n.porDia.map((d) => d.vezes))
  const melhorDia = n.porDia.reduce((a, b) => (b.vezes > a.vezes ? b : a))
  const piorDia = n.porDia.reduce((a, b) => (b.vezes < a.vezes ? b : a))

  const frase =
    n.entrou === 0
      ? 'Ainda não tem atendimento concluído neste mês. Quando marcar "Atendida" na agenda, os números aparecem aqui.'
      : n.sobrou < 0
        ? `As despesas passaram do que entrou neste mês. Vale uma promoção para encher a agenda.`
        : pctEntrou === null
          ? `Neste mês sobraram ${reais(n.sobrou)} até agora.`
          : pctEntrou >= 0
            ? `Está indo bem: entrou ${pctEntrou}% a mais que no mesmo período do mês passado.`
            : `Entrou ${Math.abs(pctEntrou)}% a menos que no mesmo período do mês passado. Que tal uma promoção?`

  return (
    <>
      <section className="pn-section">
        <h2>Olá, Leide</h2>
        <p className="pn-muted">{capitalize(dayTitleFmt.format(new Date(`${n.hoje}T12:00:00-03:00`)))}</p>
        {erro && <p className="pn-error">{erro}</p>}

        <div className="pn-hoje">
          <button className="pn-hoje-item" onClick={() => onIr('agenda')}>
            <strong>{deHoje.length}</strong>
            <span>{deHoje.length === 1 ? 'cliente hoje' : 'clientes hoje'}</span>
          </button>
          <button className={`pn-hoje-item ${aConfirmar ? 'alerta' : ''}`} onClick={() => onIr('agenda')}>
            <strong>{aConfirmar}</strong>
            <span>a confirmar</span>
          </button>
          <button className={`pn-hoje-item ${resgates ? 'alerta' : ''}`} onClick={() => onIr('pontos')}>
            <strong>{resgates}</strong>
            <span>prêmios para validar</span>
          </button>
        </div>
      </section>

      <section className="pn-section">
        <h2>Dinheiro de {nomeDoMes(n.mes, true)}</h2>
        <p className="pn-muted">{frase}</p>
        <div className="pn-kpis">
          <div className="pn-kpi pn-kpi-main">
            <span>Entrou</span>
            <strong>{reais(n.entrou)}</strong>
            <Seta pct={pctEntrou} />
          </div>
          <div className="pn-kpi">
            <span>Despesas</span>
            <strong>{reais(n.saiu)}</strong>
          </div>
          <div className={`pn-kpi ${n.sobrou < 0 ? 'neg' : 'pos'}`}>
            <span>Sobrou (lucro)</span>
            <strong>{reais(n.sobrou)}</strong>
            <Seta pct={variacao(n.sobrou, n.sobrouAntes)} />
          </div>
          <div className="pn-kpi">
            <span>Atendimentos</span>
            <strong>{n.atendimentos}</strong>
            <Seta pct={variacao(n.atendimentos, n.atendimentosAntes)} />
          </div>
          <div className="pn-kpi">
            <span>Valor médio por cliente</span>
            <strong>{reais(n.medio)}</strong>
          </div>
          <div className="pn-kpi">
            <span>Clientes novas</span>
            <strong>{n.novas}</strong>
          </div>
        </div>
        <p className="pn-muted pn-nota">
          As setas comparam com o mesmo período do mês passado (do dia 1 até hoje).
          {n.semValor > 0 &&
            ` ${n.semValor} atendimento${n.semValor > 1 ? 's' : ''} sem valor anotado: usei o preço do serviço.`}
          {n.marcados > 0 && ` Cancelamentos: ${n.cancelados} de ${n.marcados} horários marcados.`}
        </p>
        <button className="pn-chip" onClick={() => onIr('mais')}>
          Anotar uma despesa
        </button>
      </section>

      <section className="pn-section">
        <h3>Últimos 6 meses</h3>
        <div className="pn-legenda">
          <span>
            <i className="c-entrou" /> Entrou
          </span>
          <span>
            <i className="c-sobrou" /> Sobrou
          </span>
        </div>
        <div className="pn-meses" role="img" aria-label={n.meses.map((m) => `${nomeDoMes(m.mes)}: entrou ${reais(m.entrou)}, sobrou ${reais(m.sobrou)}`).join('. ')}>
          {n.meses.map((m) => (
            <div key={m.mes} className={`pn-mes ${m.mes === n.mes ? 'atual' : ''}`}>
              <span className="pn-mes-valor">{m.entrou ? reaisCurto(m.entrou) : '–'}</span>
              <div className="pn-mes-barras">
                <i className="c-entrou" style={{ height: `${(m.entrou / maiorMes) * 100}%` }} />
                <i className="c-sobrou" style={{ height: `${(Math.max(0, m.sobrou) / maiorMes) * 100}%` }} />
              </div>
              <span className="pn-mes-nome">{nomeDoMes(m.mes)}</span>
            </div>
          ))}
        </div>
      </section>

      {n.topServicos.length > 0 && (
        <section className="pn-section">
          <h3>O que mais rendeu no mês</h3>
          <ul className="pn-barras">
            {n.topServicos.map((s) => (
              <li key={s.nome}>
                <div className="pn-barras-txt">
                  <span>{s.nome}</span>
                  <span>
                    {reais(s.valor)} · {s.vezes}x
                  </span>
                </div>
                <div className="pn-barra">
                  <i style={{ width: `${(s.valor / maiorServico) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pn-section">
        <h3>Dias mais procurados</h3>
        <p className="pn-muted">
          Últimos 3 meses.
          {melhorDia.vezes > 0 &&
            melhorDia !== piorDia &&
            ` ${melhorDia.dia} é o dia mais cheio; ${piorDia.dia} é o mais vazio, bom dia para uma promoção.`}
        </p>
        <div className="pn-dias">
          {n.porDia.map((d) => (
            <div key={d.dia} className="pn-dia">
              <div className="pn-dia-barra">
                <i style={{ height: `${(d.vezes / maiorDia) * 100}%` }} />
              </div>
              <strong>{d.vezes}</strong>
              <span>{d.dia}</span>
            </div>
          ))}
        </div>
        <button className="pn-chip" onClick={() => onIr('divulgar')}>
          Criar promoção com o assistente
        </button>
      </section>

      {deAmanha.length > 0 && (
        <section className="pn-section">
          <h3>Lembrar quem vem amanhã</h3>
          <p className="pn-muted">Um toque abre o WhatsApp com a mensagem pronta.</p>
          <ul className="pn-list">
            {deAmanha.map((v) => (
              <Lembrete key={v.id} v={v} />
            ))}
          </ul>
        </section>
      )}

      {aniversariantes.length > 0 && (
        <section className="pn-section">
          <h3>Aniversários da semana</h3>
          <ul className="pn-list">
            {aniversariantes.map((c) => (
              <li key={c.phone} className="pn-card pn-card-flat">
                <div className="pn-card-body">
                  <span className="pn-card-service">{c.name}</span>
                  <span className="pn-card-client">
                    {c.birthday!.slice(8, 10)}/{c.birthday!.slice(5, 7)}
                  </span>
                </div>
                <a
                  className="pn-btn pn-btn-dark"
                  target="_blank"
                  rel="noreferrer"
                  href={whatsappLink(
                    c.phone,
                    `Feliz aniversário, ${c.name.split(' ')[0]}! 🎉 Que seu dia seja lindo. Para comemorar, seu próximo atendimento aqui no salão tem um mimo especial. Beijos, Leide Hair`,
                  )}
                >
                  <WhatsAppIcon /> Parabéns
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sumidas > 0 && (
        <section className="pn-section">
          <button className="pn-alerta" onClick={() => onIr('clientes')}>
            <strong>
              {sumidas} {sumidas === 1 ? 'cliente sumiu' : 'clientes sumiram'} há mais de 2 meses
            </strong>
            <span>Mande uma mensagem de saudade pela aba Clientes ›</span>
          </button>
        </section>
      )}
    </>
  )
}

function Lembrete({ v }: { v: Visita }) {
  const inicio = new Date(v.starts_at)
  const nome = v.client_name.split(' ')[0]
  const servico = v.service?.name ?? 'seu horário'
  const texto = `Oi, ${nome}! Passando para lembrar do seu horário de ${servico} amanhã às ${timeFmt.format(inicio)}. Endereço: ${ENDERECO}. Se não puder vir, me avisa por aqui. Até amanhã! Leide Hair`
  return (
    <li className="pn-card pn-card-flat">
      <div className="pn-card-body">
        <span className="pn-card-service">
          {timeFmt.format(inicio)} · {v.client_name}
        </span>
        <span className="pn-card-client">{servico}</span>
      </div>
      <a className="pn-btn pn-btn-dark" target="_blank" rel="noreferrer" href={whatsappLink(v.client_phone, texto)}>
        <WhatsAppIcon /> Lembrar
      </a>
    </li>
  )
}
