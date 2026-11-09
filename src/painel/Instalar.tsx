import { useEffect, useState } from 'react'

// Botão "Baixar no celular": coloca o painel na tela de início do celular da Leide, como um app.
// Android: abre o pedido do próprio sistema. iPhone: o Safari não tem esse pedido, então mostramos o caminho.
// Instalado, o painel abre direto e continua logado (o celular não apaga o login de app instalado).

type PedidoInstalacao = Event & { prompt: () => Promise<void> }

declare global {
  interface Window {
    pedidoInstalarPainel?: Event
  }
}

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const painelInstalado =
  window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

export function useInstalar() {
  const [pedido, setPedido] = useState<PedidoInstalacao | null>((window.pedidoInstalarPainel as PedidoInstalacao) ?? null)
  const [ajudaIos, setAjudaIos] = useState(false)

  useEffect(() => {
    const pegar = () => setPedido((window.pedidoInstalarPainel as PedidoInstalacao) ?? null)
    window.addEventListener('painel-instalavel', pegar)
    return () => window.removeEventListener('painel-instalavel', pegar)
  }, [])

  const instalar = painelInstalado
    ? null
    : pedido
      ? () =>
          pedido.prompt().then(() => {
            window.pedidoInstalarPainel = undefined
            setPedido(null)
          })
      : ios
        ? () => setAjudaIos(true)
        : null

  return { instalar, ajudaIos, fecharAjuda: () => setAjudaIos(false) }
}

export function AjudaIphone({ fechar }: { fechar: () => void }) {
  return (
    <div className="pn-box pn-instalar-ajuda" role="dialog" aria-label="Baixar o painel no iPhone">
      <h3>Baixar o painel no iPhone</h3>
      <ol className="pn-steps">
        <li>
          Abra este painel no <b>Safari</b>.
        </li>
        <li>
          Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).
        </li>
        <li>
          Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.
        </li>
        <li>Abra o ícone preto e dourado "Painel Leide" e entre uma vez. Depois ele já abre logado.</li>
      </ol>
      <button className="pn-btn pn-btn-dark" onClick={fechar}>
        Entendi
      </button>
    </div>
  )
}
