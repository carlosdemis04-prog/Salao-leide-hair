import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// O painel da Leide só é baixado por quem abre /painel
const Painel = lazy(() => import('./painel/Painel.tsx'))
const isPainel = window.location.pathname.startsWith('/painel')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPainel ? (
      <Suspense fallback={null}>
        <Painel />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
