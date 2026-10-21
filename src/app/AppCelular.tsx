import { useCallback, useEffect, useState, type ComponentType } from 'react'
import './app.css'
import { useReservas, useSalao, type Evento, type Oferta } from './dados'
import { AgendarIcon, ContatoIcon, EventoIcon, InicioIcon, OfertaIcon } from './icones'
import { Mascote } from './Mascote'
import { Agendar } from './telas/Agendar'
import { Contato } from './telas/Contato'
import { EventoFolha, Eventos } from './telas/Eventos'
import { Inicio } from './telas/Inicio'
import { OfertaFolha, Ofertas } from './telas/Ofertas'
import { Folha } from './ui'

export type Aba = 'inicio' | 'agendar' | 'ofertas' | 'eventos' | 'contato'

const ABAS: { chave: Aba; nome: string; Icone: ComponentType }[] = [
  { chave: 'inicio', nome: 'Início', Icone: InicioIcon },
  { chave: 'agendar', nome: 'Agendar', Icone: AgendarIcon },
  { chave: 'ofertas', nome: 'Ofertas', Icone: OfertaIcon },
  { chave: 'eventos', nome: 'Eventos', Icone: EventoIcon },
  { chave: 'contato', nome: 'Contato', Icone: ContatoIcon },
]

function abaDoEndereco(): Aba {
  const h = location.hash.slice(1)
  return ABAS.some((a) => a.chave === h) ? (h as Aba) : 'inicio'
}

type PedidoInstalacao = Event & { prompt: () => Promise<void> }

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

export default function AppCelular() {
  const salao = useSalao()
  const reservas = useReservas()
  const [aba, setAba] = useState<Aba>(abaDoEndereco)
  const [pedido, setPedido] = useState<{ servicoId: string; n: number } | null>(null)
  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [evento, setEvento] = useState<Evento | null>(null)

  // Tela de carregamento com a Leidinha: fica até os dados chegarem (no mínimo 1s, no máximo 4s)
  const [abrindo, setAbrindo] = useState(true)
  const [tempoMinimo, setTempoMinimo] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setTempoMinimo(true), 1000)
    const t2 = setTimeout(() => setAbrindo(false), 4000)
    return () => (clearTimeout(t1), clearTimeout(t2))
  }, [])
  useEffect(() => {
    if (tempoMinimo && !salao.carregando) setAbrindo(false)
  }, [tempoMinimo, salao.carregando])

  // Trocar de aba não cria histórico: o voltar do celular fecha folhas e sai do app
  const ir = useCallback((a: Aba) => {
    setAba(a)
    history.replaceState(history.state, '', a === 'inicio' ? location.pathname : `#${a}`)
    window.scrollTo({ top: 0 })
  }, [])

  const agendarServico = useCallback(
    (servicoId: string) => {
      setPedido((p) => ({ servicoId, n: (p?.n ?? 0) + 1 }))
      ir('agendar')
    },
    [ir],
  )

  // Quando a cliente volta para o app, atualiza a situação da reserva
  const { atualizar } = reservas
  useEffect(() => {
    const ver = () => document.visibilityState === 'visible' && atualizar()
    document.addEventListener('visibilitychange', ver)
    return () => document.removeEventListener('visibilitychange', ver)
  }, [atualizar])

  // Botão "Instalar app": Android mostra o pedido do sistema; no iPhone explicamos o caminho
  const [pedidoInstalar, setPedidoInstalar] = useState<PedidoInstalacao | null>(null)
  const [ajudaIos, setAjudaIos] = useState(false)
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault()
      setPedidoInstalar(e as PedidoInstalacao)
    }
    window.addEventListener('beforeinstallprompt', guardar)
    return () => window.removeEventListener('beforeinstallprompt', guardar)
  }, [])
  const instalar = instalado
    ? null
    : pedidoInstalar
      ? () => pedidoInstalar.prompt().then(() => setPedidoInstalar(null))
      : ios
        ? () => setAjudaIos(true)
        : null

  return (
    <div className="app">
      {abrindo && (
        <div className="abertura" role="status" aria-label="Abrindo o app">
          <Mascote humor="oi" size={140} className="abertura-mascote" />
          <p className="abertura-nome">Leide Hair</p>
          <span className="abertura-pontos" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </div>
      )}

      <main className="conteudo">
        {/* As abas ficam montadas para não perder o que a cliente já escolheu */}
        <div hidden={aba !== 'inicio'}>
          <Inicio
            services={salao.services}
            ofertas={salao.ofertas}
            eventos={salao.eventos}
            carregando={salao.carregando}
            proxima={reservas.proxima}
            situacao={reservas.situacao}
            cancelar={reservas.cancelar}
            ir={ir}
            agendarServico={agendarServico}
            abrirOferta={setOferta}
            abrirEvento={setEvento}
            instalar={instalar}
          />
        </div>
        <div hidden={aba !== 'agendar'}>
          <Agendar
            services={salao.services}
            hours={salao.hours}
            carregando={salao.carregando}
            erro={salao.erro}
            pedido={pedido}
            aoReservar={reservas.adicionar}
            verInicio={() => ir('inicio')}
          />
        </div>
        <div hidden={aba !== 'ofertas'}>
          <Ofertas ofertas={salao.ofertas} carregando={salao.carregando} abrir={setOferta} />
        </div>
        <div hidden={aba !== 'eventos'}>
          <Eventos eventos={salao.eventos} carregando={salao.carregando} abrir={setEvento} />
        </div>
        <div hidden={aba !== 'contato'}>
          <Contato hours={salao.hours} />
        </div>
      </main>

      <nav className="barra-abas" aria-label="Navegação">
        {ABAS.map(({ chave, nome, Icone }) => (
          <button
            key={chave}
            className={`aba-app ${aba === chave ? 'ativa' : ''}`}
            aria-current={aba === chave ? 'page' : undefined}
            onClick={() => ir(chave)}
          >
            <span className="aba-icone">
              <Icone />
            </span>
            <span className="aba-nome">{nome}</span>
          </button>
        ))}
      </nav>

      {oferta && <OfertaFolha oferta={oferta} fechar={() => setOferta(null)} agendar={agendarServico} />}
      {evento && <EventoFolha evento={evento} fechar={() => setEvento(null)} />}
      {ajudaIos && (
        <Folha titulo="Instalar no iPhone" aoFechar={() => setAjudaIos(false)}>
          <div className="detalhe-servico">
            <Mascote humor="agendar" size={96} />
            <h2>Instalar no iPhone</h2>
            <ol className="passos-ios">
              <li>
                Toque no botão <strong>Compartilhar</strong> do Safari (o quadrado com a seta para cima).
              </li>
              <li>
                Escolha <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                Toque em <strong>Adicionar</strong>. A Leidinha aparece junto com seus apps.
              </li>
            </ol>
          </div>
        </Folha>
      )}
    </div>
  )
}
