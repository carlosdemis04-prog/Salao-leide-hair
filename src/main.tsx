import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { irParaDominio } from './dominio'

// O painel da Leide só é baixado por quem abre /painel
const Painel = lazy(() => import('./painel/Painel.tsx'))
const isPainel = window.location.pathname.startsWith('/painel')

// O app para celular (/app) também vem separado, para não pesar no site
const AppCelular = lazy(() => import('./app/AppCelular.tsx'))
const isApp = window.location.pathname.startsWith('/app')

// O site vem em separado também, assim quem abre o app não baixa as animações do site
const Site = lazy(() => import('./App.tsx'))

if (isApp) {
  // Só o /app pode ser instalado na tela do celular
  const manifesto = document.createElement('link')
  manifesto.rel = 'manifest'
  manifesto.href = '/manifest.webmanifest'
  document.head.append(manifesto)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fbf7f2')
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/app-icone-180.png')
  document.title = 'Leide Hair'
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
}

if (isPainel) {
  // O painel também pode ser instalado no celular da Leide, com ícone próprio (preto e dourado)
  const manifesto = document.createElement('link')
  manifesto.rel = 'manifest'
  manifesto.href = '/painel.webmanifest'
  document.head.append(manifesto)
  const tituloIos = document.createElement('meta')
  tituloIos.name = 'apple-mobile-web-app-title'
  tituloIos.content = 'Painel Leide'
  document.head.append(tituloIos)
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', '/painel-icone-180.png')
  document.title = 'Painel Leide Hair'
  // O Android avisa cedo que dá para instalar; guardamos o aviso para o botão "Baixar no celular"
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.pedidoInstalarPainel = e
    window.dispatchEvent(new Event('painel-instalavel'))
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/painel-sw.js', { scope: '/painel' }).catch(() => {})
  }
  // Pede ao navegador para não apagar o login do painel quando o celular faz faxina
  navigator.storage?.persist?.().catch(() => {})
}

// Endereço antigo ou www: vai para leidehair.com.br antes de desenhar qualquer coisa
if (!irParaDominio())
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {isPainel ? (
        <Suspense fallback={null}>
          <Painel />
        </Suspense>
      ) : isApp ? (
        <Suspense fallback={null}>
          <AppCelular />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <Site />
        </Suspense>
      )}
    </StrictMode>,
  )
