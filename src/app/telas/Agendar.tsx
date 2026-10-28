import { useEffect, useMemo, useRef, useState } from 'react'
import { avisarGoogle, supabase, type BusinessHours, type Service } from '../../supabase'
import { CheckIcon, ChevronLeftIcon, ClockIcon, WhatsAppIcon } from '../../icons'
import { linkWhats, type Reserva } from '../dados'
import {
  dataLongaFmt,
  diaFmt,
  duracao,
  horaFmt,
  linkGoogleAgenda,
  maiuscula,
  manha,
  mesFmt,
  precoServico,
  proximosDias,
  semanaFmt,
  telefone,
  type Dia,
} from '../formato'
import { Mascote } from '../Mascote'
import type { Conta } from '../conta'
import { Cabecalho, Esqueleto, IconeServico, Vazio } from '../ui'

type Etapa = 'servico' | 'horario' | 'dados' | 'feito'

const ETAPAS: { chave: Etapa; nome: string }[] = [
  { chave: 'servico', nome: 'Serviço' },
  { chave: 'horario', nome: 'Data e hora' },
  { chave: 'dados', nome: 'Confirmar' },
]

const ERROS: Record<string, string> = {
  horario_indisponivel: 'Esse horário acabou de ser reservado. Escolha outro, por favor.',
  telefone_invalido: 'Confira o WhatsApp: DDD e número, por exemplo (11) 98765-4321.',
  nome_invalido: 'Escreva seu nome, por favor.',
  servico_invalido: 'Esse serviço não está mais disponível.',
}

const CHAVE_CLIENTE = 'leide-app-cliente'

function lerCliente() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CLIENTE) ?? '{}') as { nome?: string; tel?: string }
  } catch {
    return {}
  }
}

type Props = {
  services: Service[]
  hours: BusinessHours[]
  carregando: boolean
  erro: string
  // Serviço escolhido em outra aba (Início ou Ofertas); o número muda a cada pedido
  pedido: { servicoId: string; n: number } | null
  aoReservar: (r: Reserva) => void
  verInicio: () => void
  conta: Conta | null
}

export function Agendar({ services, hours, carregando, erro, pedido, aoReservar, verInicio, conta }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('servico')
  const [servico, setServico] = useState<Service | null>(null)
  const [dia, setDia] = useState<Dia | null>(null)
  const [horarios, setHorarios] = useState<string[] | null>(null)
  const [erroHorarios, setErroHorarios] = useState(false)
  const [horario, setHorario] = useState<string | null>(null)
  const [nome, setNome] = useState(() => lerCliente().nome ?? '')
  const [tel, setTel] = useState(() => lerCliente().tel ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [feita, setFeita] = useState<Reserva | null>(null)
  const topo = useRef<HTMLDivElement>(null)

  // Entrou com o Google: já preenche nome e WhatsApp, se estiverem vazios
  const nomeConta = conta?.nome
  const telConta = conta?.telefone
  useEffect(() => {
    if (nomeConta) setNome((n) => n || nomeConta)
    if (telConta) setTel((t) => t || telefone(telConta))
  }, [nomeConta, telConta])

  const dias = useMemo(() => proximosDias(hours), [hours])

  function ir(e: Etapa) {
    setEtapa(e)
    topo.current?.scrollIntoView({ block: 'start' })
    window.scrollTo({ top: 0 })
  }

  function escolher(s: Service) {
    setServico(s)
    setDia((d) => d ?? dias[0] ?? null)
    setHorario(null)
    setErroForm('')
    ir('horario')
  }

  // Pedido vindo de outra aba
  useEffect(() => {
    if (!pedido) return
    const s = services.find((x) => x.id === pedido.servicoId)
    if (s) escolher(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, services])

  // Horários livres de verdade, direto do banco
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    if (!supabase || !servico || !dia) return
    let cancelado = false
    setHorarios(null)
    setErroHorarios(false)
    supabase.rpc('get_available_slots', { p_service_id: servico.id, p_date: dia.iso }).then(({ data, error }) => {
      if (cancelado) return
      if (error) setErroHorarios(true)
      setHorarios((data ?? []).map((r: { slot_start: string }) => r.slot_start))
    })
    return () => {
      cancelado = true
    }
  }, [servico, dia, recarga])

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !servico || !horario) return
    setEnviando(true)
    setErroForm('')
    const { data, error } = await supabase.rpc('book_appointment', {
      p_service_id: servico.id,
      p_starts_at: horario,
      p_client_name: nome,
      p_client_phone: tel,
    })
    setEnviando(false)
    if (error || !data) {
      setErroForm(ERROS[error?.message ?? ''] ?? 'Não foi possível concluir agora. Tente de novo em instantes.')
      if (error?.message === 'horario_indisponivel') {
        setHorario(null)
        setRecarga((n) => n + 1)
        ir('horario')
      }
      return
    }
    try {
      localStorage.setItem(CHAVE_CLIENTE, JSON.stringify({ nome, tel }))
    } catch {
      // sem armazenamento, segue normal
    }
    const fim = new Date(new Date(horario).getTime() + servico.duration_min * 60_000).toISOString()
    const reserva: Reserva = { id: String(data), servico: servico.name, inicio: horario, fim, nome }
    aoReservar(reserva)
    setFeita(reserva)
    avisarGoogle()
    ir('feito')
  }

  function recomecar() {
    setServico(null)
    setHorario(null)
    setFeita(null)
    setErroForm('')
    ir('servico')
  }

  const indice = ETAPAS.findIndex((x) => x.chave === etapa)
  const manhaLista = (horarios ?? []).filter(manha)
  const tardeLista = (horarios ?? []).filter((h) => !manha(h))

  if (!supabase) {
    return (
      <div className="tela">
        <Cabecalho titulo="Agendar" />
        <Vazio titulo="Agenda fora do ar" texto="O app ainda não está ligado ao banco de dados. Agende pelo WhatsApp.">
          <a className="botao" href={linkWhats('Olá! Gostaria de agendar um horário.')}>
            <WhatsAppIcon /> Agendar pelo WhatsApp
          </a>
        </Vazio>
      </div>
    )
  }

  return (
    <div className="tela" ref={topo}>
      {etapa !== 'feito' && (
        <>
          <Cabecalho titulo="Agendar" sub="Atendimento com a Leide" />
          <ol className="passos" aria-label="Etapas">
            {ETAPAS.map((x, i) => (
              <li key={x.chave} className={i < indice ? 'passo-ok' : i === indice ? 'atual' : ''} aria-current={i === indice ? 'step' : undefined}>
                <span className="passo-bola">{i < indice ? <CheckIcon /> : i + 1}</span>
                <span className="passo-nome">{x.nome}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {etapa === 'servico' && (
        <section aria-label="Escolha o serviço">
          {carregando && <Esqueleto linhas={5} />}
          {erro && <p className="aviso-erro">{erro}</p>}
          <ul className="lista-servicos">
            {services.map((s) => (
              <li key={s.id}>
                <button className="servico-item" onClick={() => escolher(s)}>
                  <IconeServico nome={s.name} />
                  <span className="servico-textos">
                    <span className="servico-nome">{s.name}</span>
                    {s.description && <span className="servico-desc">{s.description}</span>}
                    <span className="servico-meta">
                      <ClockIcon /> {duracao(s.duration_min)} · {precoServico(s.price_cents)}
                    </span>
                  </span>
                  <span className="seta" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {etapa === 'horario' && servico && (
        <section aria-label="Escolha o dia e o horário">
          <button className="voltar" onClick={() => ir('servico')}>
            <ChevronLeftIcon /> {servico.name}
          </button>
          {erroForm && <p className="aviso-erro">{erroForm}</p>}

          <h2 className="rotulo">{dia ? maiuscula(mesFmt.format(dia.date)) : 'Dia'}</h2>
          {dias.length === 0 && !carregando && <p className="suave">O horário de atendimento ainda não foi cadastrado.</p>}
          <div className="dias" role="listbox" aria-label="Dia">
            {dias.map((d) => {
              const sel = dia?.iso === d.iso
              return (
                <button
                  key={d.iso}
                  role="option"
                  aria-selected={sel}
                  className={`dia ${sel ? 'sel' : ''}`}
                  onClick={() => {
                    setDia(d)
                    setHorario(null)
                  }}
                >
                  <span className="dia-semana">{semanaFmt.format(d.date).replace('.', '')}</span>
                  <span className="dia-num">{diaFmt.format(d.date)}</span>
                </button>
              )
            })}
          </div>

          {dia && <h2 className="rotulo">{maiuscula(dataLongaFmt.format(dia.date))}</h2>}
          {horarios === null && dia && <Esqueleto linhas={2} />}
          {erroHorarios && <p className="aviso-erro">Não deu para ver os horários. Toque no dia de novo.</p>}
          {horarios !== null && horarios.length === 0 && !erroHorarios && (
            <div className="sem-horario">
              <Mascote humor="vazio" mini size={56} />
              <p>Esse dia está cheio. Escolha outro dia acima.</p>
            </div>
          )}
          {[
            { nome: 'Manhã', lista: manhaLista },
            { nome: 'Tarde', lista: tardeLista },
          ]
            .filter((g) => g.lista.length > 0)
            .map((g) => (
              <div key={g.nome} className="grupo-horas">
                <span className="grupo-nome">{g.nome}</span>
                <div className="horas">
                  {g.lista.map((h) => (
                    <button
                      key={h}
                      className={`hora ${horario === h ? 'sel' : ''}`}
                      aria-pressed={horario === h}
                      onClick={() => setHorario(h)}
                    >
                      {horaFmt.format(new Date(h))}
                    </button>
                  ))}
                </div>
              </div>
            ))}

          <div className="barra-acao presa">
            <button className="botao" disabled={!horario} onClick={() => ir('dados')}>
              Continuar
            </button>
          </div>
        </section>
      )}

      {etapa === 'dados' && servico && horario && (
        <form onSubmit={confirmar} aria-label="Confirmar agendamento">
          <button type="button" className="voltar" onClick={() => ir('horario')}>
            <ChevronLeftIcon /> Trocar horário
          </button>

          <div className="resumo">
            <IconeServico nome={servico.name} />
            <dl>
              <dt>Serviço</dt>
              <dd>{servico.name}</dd>
              <dt>Com</dt>
              <dd>Leide</dd>
              <dt>Quando</dt>
              <dd>
                {maiuscula(dataLongaFmt.format(new Date(horario)))}, {horaFmt.format(new Date(horario))}
              </dd>
              <dt>Duração</dt>
              <dd>{duracao(servico.duration_min)}</dd>
              <dt>Valor</dt>
              <dd>{precoServico(servico.price_cents)}</dd>
            </dl>
          </div>

          {erroForm && <p className="aviso-erro">{erroForm}</p>}
          <label className="campo">
            <span>Seu nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="campo">
            <span>Seu WhatsApp</span>
            <input
              value={tel}
              onChange={(e) => setTel(telefone(e.target.value))}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(11) 98765-4321"
              enterKeyHint="done"
              required
            />
          </label>
          <p className="suave">A Leide confirma a reserva pelo WhatsApp.</p>
          <p className="suave aviso-legal">
            Ao confirmar, você concorda com os{' '}
            <a href="/termos.html" target="_blank" rel="noreferrer">
              termos de uso
            </a>{' '}
            e com a{' '}
            <a href="/privacidade.html" target="_blank" rel="noreferrer">
              política de privacidade
            </a>
            . Seu nome e WhatsApp são usados só para o agendamento.
          </p>

          <div className="barra-acao">
            <button className="botao" type="submit" disabled={enviando}>
              {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
            </button>
          </div>
        </form>
      )}

      {etapa === 'feito' && feita && (
        <section className="feito" aria-live="polite">
          <Mascote humor="festa" size={150} titulo="A Leidinha comemorando" />
          <h1>Horário reservado!</h1>
          <p>
            {feita.servico}
            <br />
            {maiuscula(dataLongaFmt.format(new Date(feita.inicio)))}, às {horaFmt.format(new Date(feita.inicio))}
          </p>
          <span className="selo pendente">Aguardando confirmação da Leide</span>
          <div className="feito-acoes">
            <a
              className="botao"
              href={linkWhats(
                `Olá! Acabei de agendar pelo app: ${feita.servico}, ${dataLongaFmt.format(new Date(feita.inicio))} às ${horaFmt.format(new Date(feita.inicio))}. Meu nome é ${feita.nome}.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon /> Avisar a Leide
            </a>
            <a
              className="botao secundario"
              href={linkGoogleAgenda({ name: feita.servico }, feita.inicio, feita.fim)}
              target="_blank"
              rel="noreferrer"
            >
              Adicionar à minha agenda
            </a>
            <button className="botao texto" onClick={verInicio}>
              Ver na tela inicial
            </button>
            <button className="botao texto" onClick={recomecar}>
              Agendar outro serviço
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
