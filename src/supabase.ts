import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// pkce: a volta do login com Google chega como ?code= e não mexe no #aba do app.
// O painel guarda o login num lugar só dele: entrar no painel como a Leide não deixa o app
// do mesmo navegador logado na conta dela (e vice-versa).
const painel = location.pathname.startsWith('/painel')
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: 'pkce', ...(painel ? { storageKey: 'leide-painel-login' } : {}) },
      })
    : null

// Pede para o site mandar já os agendamentos novos para o Google Agenda da Leide,
// sem esperar a rodada de 5 minutos. Se a ligação com o Google não estiver feita, não faz nada.
export function avisarGoogle() {
  fetch('/google/sync', { method: 'POST' }).catch(() => {})
}

export type Service = {
  id: string
  name: string
  description: string | null
  price_cents: number | null
  duration_min: number
}

export type BusinessHours = {
  weekday: number
  open_time: string
  close_time: string
}
