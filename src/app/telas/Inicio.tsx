import { useState } from 'react'
import type { Service } from '../../supabase'
import { CalendarIcon, ClockIcon } from '../../icons'
import { linkWhats, type Evento, type Oferta, type Reserva, type SituacaoReserva } from '../dados'
import { dataCurtaFmt, dataLongaFmt, duracao, horaFmt, maiuscula, preco } from '../formato'
import { AgendarIcon, ContatoIcon, OfertaIcon, ServicosIcon } from '../icones'
import { Mascote } from '../Mascote'
import { depoisDeFechar, Esqueleto, Folha, IconeServico } from '../ui'
import type { Aba } from '../AppCelular'

// Frase do topo. Troque aqui quando o slogan oficial do salão for definido.
export const FRASE = 'Seu momento de cuidado, com hora marcada.'

const SITUACAO: Record<SituacaoReserva, string> = {
  pendente: 'Aguardando confirmação',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
}

function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

type Props = {
  services: Service[]
  ofertas: Oferta[]
  eventos: Evento[]
  carregando: boolean
  proxima: Reserva | null
  situacao: Record<string, SituacaoReserva>
  cancelar: (id: string) => Promise<string>
  ir: (aba: Aba) => void
  agendarServico: (id: string) => void
  abrirOferta: (o: Oferta) => void
  abrirEvento: (e: Evento) => void
  instalar: (() => void) | null
}

export function Inicio(p: Props) {
  const [detalhe, setDetalhe] = useState<Service | null>(null)
  const [verReserva, setVerReserva] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [certeza, setCerteza] = useState(false)
  const [erroCancelar, setErroCancelar] = useState('')
  const destaque = p.services.slice(0, 6)
  const sit = p.proxima ? (p.situacao[p.proxima.id] ?? 'pendente') : null

  async function cancelar() {
    if (!p.proxima) return
    setCancelando(true)
    const erro = await p.cancelar(p.proxima.id)
    setCancelando(false)
    setErroCancelar(erro)
    if (!erro) history.back()
  }

  return (
    <div className="tela inicio">
      <header className="inicio-topo">
        <img src="/logo.webp" alt="Leide Hair" className="inicio-logo" width="56" height="49" />
        <div>
          <p className="inicio-oi">{saudacao()}!</p>
          <p className="inicio-nome">Leide Hair</p>
        </div>
        {p.instalar && (
          <button className="chip" onClick={p.instalar}>
            Instalar app
          </button>
        )}
      </header>

      <section className="banner">
        <div className="banner-texto">
          <p className="banner-frase">{FRASE}</p>
          <button className="botao" onClick={() => p.ir('agendar')}>
            Agendar horário
          </button>
        </div>
        <Mascote humor="oi" size={112} className="banner-mascote" titulo="A Leidinha dando oi" />
      </section>

      <nav className="atalhos" aria-label="Atalhos">
        <button onClick={() => p.ir('agendar')}>
          <span className="atalho-icone">
            <AgendarIcon />
          </span>
          Agendar
        </button>
        <button onClick={() => document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' })}>
          <span className="atalho-icone">
            <ServicosIcon />
          </span>
          Serviços
        </button>
        <button onClick={() => p.ir('ofertas')}>
          <span className="atalho-icone">
            <OfertaIcon />
          </span>
          Ofertas
        </button>
        <button onClick={() => p.ir('contato')}>
          <span className="atalho-icone">
            <ContatoIcon />
          </span>
          Contato
        </button>
      </nav>

      <section aria-labelledby="t-proximo">
        <h2 className="secao" id="t-proximo">
          Próximo horário
        </h2>
        {p.proxima ? (
          <button className="cartao proximo" onClick={() => setVerReserva(true)}>
            <span className="proximo-data">
              <span className="proximo-dia">{dataCurtaFmt.format(new Date(p.proxima.inicio)).replace('.', '')}</span>
              <span className="proximo-hora">{horaFmt.format(new Date(p.proxima.inicio))}</span>
            </span>
            <span className="proximo-info">
              <span className="proximo-servico">{p.proxima.servico}</span>
              <span className={`selo ${sit}`}>{SITUACAO[sit!]}</span>
            </span>
            <span className="seta" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <div className="cartao convite">
            <Mascote humor="agendar" mini size={64} />
            <div>
              <p>Você ainda não tem horário marcado.</p>
              <button className="link" onClick={() => p.ir('agendar')}>
                Marcar meu primeiro horário
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="t-servicos" id="servicos">
        <div className="secao-linha">
          <h2 className="secao" id="t-servicos">
            Serviços
          </h2>
          <button className="link" onClick={() => p.ir('agendar')}>
            Ver todos
          </button>
        </div>
        {p.carregando && <Esqueleto linhas={2} />}
        <ul className="carrossel">
          {destaque.map((s) => (
            <li key={s.id}>
              <button className="cartao servico-card" onClick={() => setDetalhe(s)}>
                <IconeServico nome={s.name} />
                <span className="servico-nome">{s.name}</span>
                <span className="servico-meta">
                  {duracao(s.duration_min)}
                  {s.price_cents !== null && ` · ${preco(s.price_cents)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {(p.ofertas.length > 0 || p.eventos.length > 0) && (
        <section aria-labelledby="t-novidades">
          <h2 className="secao" id="t-novidades">
            Novidades
          </h2>
          <ul className="lista-cartoes">
            {p.ofertas.slice(0, 2).map((o) => (
              <li key={o.id}>
                <button className="cartao novidade" onClick={() => p.abrirOferta(o)}>
                  <span className="novidade-tipo">Oferta</span>
                  <span className="novidade-titulo">{o.title}</span>
                </button>
              </li>
            ))}
            {p.eventos.slice(0, 2).map((e) => (
              <li key={e.id}>
                <button className="cartao novidade" onClick={() => p.abrirEvento(e)}>
                  <span className="novidade-tipo">
                    {e.starts_at ? `Evento · ${dataCurtaFmt.format(new Date(e.starts_at)).replace('.', '')}` : 'Evento'}
                  </span>
                  <span className="novidade-titulo">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detalhe && (
        <Folha titulo={detalhe.name} aoFechar={() => setDetalhe(null)}>
          <div className="detalhe-servico">
            <IconeServico nome={detalhe.name} />
            <h2>{detalhe.name}</h2>
            {detalhe.description && <p>{detalhe.description}</p>}
            <p className="servico-meta">
              <ClockIcon /> {duracao(detalhe.duration_min)} · {preco(detalhe.price_cents)}
            </p>
            <button className="botao" onClick={() => depoisDeFechar(() => p.agendarServico(detalhe.id))}>
              Agendar este serviço
            </button>
          </div>
        </Folha>
      )}

      {verReserva && p.proxima && (
        <Folha titulo="Meu agendamento" aoFechar={() => (setVerReserva(false), setErroCancelar(''), setCerteza(false))}>
          <div className="detalhe-servico">
            <Mascote humor="agendar" size={96} />
            <h2>{p.proxima.servico}</h2>
            <p>
              <CalendarIcon /> {maiuscula(dataLongaFmt.format(new Date(p.proxima.inicio)))}, às{' '}
              {horaFmt.format(new Date(p.proxima.inicio))}
            </p>
            <span className={`selo ${sit}`}>{SITUACAO[sit!]}</span>
            {erroCancelar && <p className="aviso-erro">{erroCancelar}</p>}
            <a
              className="botao secundario"
              href={linkWhats(`Olá! Sobre meu horário de ${p.proxima.servico} em ${dataLongaFmt.format(new Date(p.proxima.inicio))}.`)}
              target="_blank"
              rel="noreferrer"
            >
              Falar com a Leide
            </a>
            {certeza ? (
              <button className="botao perigo" onClick={cancelar} disabled={cancelando}>
                {cancelando ? 'Cancelando…' : 'Sim, cancelar o horário'}
              </button>
            ) : (
              <button className="botao texto perigo" onClick={() => setCerteza(true)}>
                Cancelar este horário
              </button>
            )}
          </div>
        </Folha>
      )}
    </div>
  )
}
