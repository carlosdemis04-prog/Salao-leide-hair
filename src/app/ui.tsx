import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Mascote, type Humor } from './Mascote'
import { ScissorsIcon } from '../icons'
import { categoria } from './formato'
import { FecharIcon, FlorIcon, UnhaIcon } from './icones'

// Folha que sobe de baixo, como nos apps. O botão voltar do celular fecha a folha.
export function Folha({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  const fechar = useRef(aoFechar)
  useEffect(() => {
    fechar.current = aoFechar
  })
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    history.pushState({ folha: true }, '')
    const voltar = () => fechar.current()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && history.back()
    window.addEventListener('popstate', voltar)
    window.addEventListener('keydown', tecla)
    document.body.classList.add('com-folha')
    caixa.current?.focus()
    return () => {
      window.removeEventListener('popstate', voltar)
      window.removeEventListener('keydown', tecla)
      document.body.classList.remove('com-folha')
    }
  }, [])

  // Vai direto para a raiz do app: assim a folha cobre a tela toda, inclusive as abas
  return createPortal(
    <div className="folha-fundo" onClick={() => history.back()}>
      <div
        className="folha"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={caixa}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="folha-alca" aria-hidden />
        <button className="folha-fechar" onClick={() => history.back()} aria-label="Fechar">
          <FecharIcon />
        </button>
        {children}
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
  )
}

export function Vazio({
  humor = 'vazio',
  titulo,
  texto,
  children,
}: {
  humor?: Humor
  titulo: string
  texto: string
  children?: ReactNode
}) {
  return (
    <div className="vazio">
      <Mascote humor={humor} size={112} />
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {children}
    </div>
  )
}

export function Cabecalho({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <header className="tela-topo">
      <h1>{titulo}</h1>
      {sub && <p>{sub}</p>}
    </header>
  )
}

export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="esqueleto" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

// Fecha a folha aberta (volta no histórico) e depois faz a ação, sem bagunçar o botão voltar
export function depoisDeFechar(acao: () => void) {
  window.addEventListener('popstate', () => setTimeout(acao), { once: true })
  history.back()
}

// Ícone redondo do serviço (o salão ainda não tem fotos de cada serviço)
export function IconeServico({ nome }: { nome: string }) {
  const c = categoria(nome)
  return (
    <span className={`icone-servico ${c}`} aria-hidden>
      {c === 'unhas' ? <UnhaIcon /> : c === 'estetica' ? <FlorIcon /> : <ScissorsIcon />}
    </span>
  )
}
