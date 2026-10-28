import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

// Botão oficial do Google (Google Identity Services). Quem fala com o Google é o próprio site,
// então a tela do Google mostra o endereço do salão, não o do Supabase. O Google devolve um
// "ID token" e o Supabase cria a sessão com ele (signInWithIdToken): contas e pontos não mudam.
// Sem VITE_GOOGLE_CLIENT_ID, ou se o script do Google não carregar, usa o botão antigo (reserva).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type Google = {
  accounts: {
    id: {
      initialize(opcoes: object): void
      renderButton(caixa: HTMLElement, opcoes: object): void
    }
  }
}

declare global {
  interface Window {
    google?: Google
  }
}

let carregando: Promise<Google> | null = null
function carregarGoogle() {
  if (window.google) return Promise.resolve(window.google)
  carregando ??= new Promise<Google>((ok, falhou) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google ? ok(window.google) : falhou(new Error('google')))
    s.onerror = () => {
      carregando = null
      falhou(new Error('google'))
    }
    document.head.appendChild(s)
  })
  return carregando
}

// O Google recebe o nonce embaralhado (SHA-256) e o Supabase o original, para conferir o token
async function novoNonce() {
  const bruto = crypto.randomUUID()
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bruto))
  return { bruto, hash: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('') }
}

type Props = {
  escuro?: boolean
  aoErro: (mensagem: string) => void
  reserva: ReactNode // botão antigo, que passa pelo Supabase
}

export function EntrarComGoogle({ escuro = false, aoErro, reserva }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID || !supabase) return
    let vivo = true
    Promise.all([carregarGoogle(), novoNonce()])
      .then(([google, nonce]) => {
        if (!vivo || !caixa.current) return
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hash,
          callback: async ({ credential }: { credential: string }) => {
            const { error } = await supabase!.auth.signInWithIdToken({
              provider: 'google',
              token: credential,
              nonce: nonce.bruto,
            })
            if (error) aoErro('Não deu para entrar com o Google agora. Tente de novo.')
          },
        })
        google.accounts.id.renderButton(caixa.current, {
          theme: escuro ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'pt-BR',
          width: Math.min(caixa.current.offsetWidth || 320, 400),
        })
      })
      .catch(() => vivo && setFalhou(true))
    return () => {
      vivo = false
    }
  }, [escuro, aoErro])

  if (!CLIENT_ID || falhou) return <>{reserva}</>
  return <div ref={caixa} className="google-oficial" />
}
