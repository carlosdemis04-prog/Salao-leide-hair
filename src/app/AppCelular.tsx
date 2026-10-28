import { useCallback, useEffect, useState, type ComponentType } from 'react'
import './app.css'
import { useConta } from './conta'
import { useConvite, type CupomConvite } from './convite'
import { useFamilia } from './familia'
import { useReservas, useSalao, type Evento, type Oferta, type Reserva } from './dados'
import { AgendarIcon, ContatoIcon, EventoIcon, InicioIcon, OfertaIcon } from './icones'
import { useLady } from './lady'
import { Mascote } from './Mascote'
import { Agendar } from './telas/Agendar'
import { Contato } from './telas/Contato'
import { ContaFolha } from './telas/Conta'
import { BoasVindasFolha, IndiqueFolha, PresenteFolha } from './telas/Convite'
import { CorridaFolha } from './telas/Corrida'
import { EventoFolha, Eventos } from './telas/Eventos'
import { FamiliaFolha } from './telas/Familia'
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
  const lady = useLady()
  const convite = useConvite()
  const familia = useFamilia()
  // Login com Google: ao ligar a conta, os pontos, os convites e a Lady Family podem mudar
  const { carregar: recarregarPontos } = lady
  const { carregar: recarregarConvite } = convite
  const { carregar: carregarFamilia } = familia
  const aoLigarConta = useCallback(() => {
    recarregarPontos()
    recarregarConvite()
    carregarFamilia()
  }, [recarregarPontos, recarregarConvite, carregarFamilia])
  const conta = useConta(aoLigarConta)
  // Voltou do Google com erro: abre a folha da conta para mostrar o aviso
  const [verConta, setVerConta] = useState(conta.erro !== '')
  const [verCorrida, setVerCorrida] = useState(false)
  const [verConvite, setVerConvite] = useState(false)
  const [verFamilia, setVerFamilia] = useState(false)
  // Abriu pelo link de uma amiga: mostra o convite depois da abertura
  const [verBoasVindas, setVerBoasVindas] = useState(convite.convidada?.agora ?? false)
  const [presente, setPresente] = useState<{ cupom: CupomConvite; madrinha: string | null } | null>(null)
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

  // Reservou pelo app: entra na corrida das Lady Points com o telefone da reserva.
  // Se veio pelo convite de uma amiga, conta a indicação e mostra o cupom de 10%.
  const { adicionar } = reservas
  const { vincular } = lady
  const { registrar, carregar: carregarConvite } = convite
  const { ligar: ligarConta } = conta
  const aoReservar = useCallback(
    async (r: Reserva) => {
      adicionar(r)
      await vincular(r.id)
      await ligarConta()
      const ganhou = await registrar(r.id)
      carregarConvite()
      carregarFamilia()
      if (ganhou) setTimeout(() => setPresente(ganhou), 1200)
    },
    [adicionar, vincular, ligarConta, registrar, carregarConvite, carregarFamilia],
  )

  // Quando a cliente volta para o app, atualiza a situação da reserva e os pontos
  const { atualizar } = reservas
  const { carregar: carregarPontos } = lady
  useEffect(() => {
    const ver = () => {
      if (document.visibilityState !== 'visible') return
      atualizar()
      carregarPontos()
      carregarConvite()
      carregarFamilia()
    }
    document.addEventListener('visibilitychange', ver)
    return () => document.removeEventListener('visibilitychange', ver)
  }, [atualizar, carregarPontos, carregarConvite, carregarFamilia])

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
            conta={conta.conta}
            abrirConta={() => setVerConta(true)}
          />
        </div>
        <div hidden={aba !== 'agendar'}>
          <Agendar
            services={salao.services}
            hours={salao.hours}
            carregando={salao.carregando}
            erro={salao.erro}
            pedido={pedido}
            conta={conta.conta}
            aoReservar={aoReservar}
            verInicio={() => ir('inicio')}
            ativa={aba === 'agendar'}
          />
        </div>
        <div hidden={aba !== 'ofertas'}>
          <Ofertas
            ofertas={salao.ofertas}
            carregando={salao.carregando}
            abrir={setOferta}
            corrida={lady.corrida}
            abrirCorrida={() => setVerCorrida(true)}
          />
        </div>
        <div hidden={aba !== 'eventos'}>
          <Eventos
            eventos={salao.eventos}
            carregando={salao.carregando}
            abrir={setEvento}
            convite={convite.meu}
            abrirConvite={() => (carregarConvite(), setVerConvite(true))}
            familia={familia.familia}
            abrirFamilia={() => (carregarFamilia(), setVerFamilia(true))}
          />
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
      {verCorrida && lady.corrida && (
        <CorridaFolha
          corrida={lady.corrida}
          resgatar={lady.resgatar}
          atualizar={lady.carregar}
          agendar={() => ir('agendar')}
          fechar={() => setVerCorrida(false)}
        />
      )}
      {verConvite && (
        <IndiqueFolha meu={convite.meu} agendar={() => ir('agendar')} fechar={() => setVerConvite(false)} />
      )}
      {verFamilia && (
        <FamiliaFolha
          familia={familia.familia}
          agendar={() => ir('agendar')}
          convidar={() => (carregarConvite(), setVerConvite(true))}
          fechar={() => setVerFamilia(false)}
        />
      )}
      {verBoasVindas && !abrindo && (
        <BoasVindasFolha
          madrinha={convite.convidada?.madrinha ?? null}
          agendar={() => ir('agendar')}
          fechar={() => setVerBoasVindas(false)}
        />
      )}
      {presente && (
        <PresenteFolha
          cupom={presente.cupom}
          madrinha={presente.madrinha}
          convidar={() => (ir('eventos'), setVerConvite(true))}
          fechar={() => setPresente(null)}
        />
      )}
      {verConta && !abrindo && (
        <ContaFolha
          conta={conta.conta}
          erro={conta.erro}
          entrar={conta.entrar}
          avisarErro={conta.avisarErro}
          sair={conta.sair}
          agendar={() => ir('agendar')}
          fechar={() => setVerConta(false)}
        />
      )}
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
