import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { token } from './lady'

// Login com Google (opcional). A conta guarda o telefone da cliente no banco (migração 0012),
// então os Lady Points e os cupons acompanham a cliente em qualquer celular em que ela entrar.

export type Conta = {
  nome: string | null
  email: string | null
  foto: string | null
  telefone: string | null // DDD + número, só dígitos. null = ainda não agendou com esta conta
}

// O Google voltou com erro (a cliente cancelou ou o login não está configurado): lê e limpa o endereço
function erroDaVolta() {
  const url = new URL(location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const erro = url.searchParams.get('error_description') ?? hash.get('error_description')
  if (!erro) return ''
  for (const k of ['error', 'error_code', 'error_description']) url.searchParams.delete(k)
  history.replaceState(history.state, '', url.pathname + url.search + (hash.has('error') ? '' : url.hash))
  return 'Não deu para entrar com o Google agora. Tente de novo.'
}

export function useConta(aoLigar: () => void) {
  const [session, setSession] = useState<Session | null>(null)
  const [telefone, setTelefone] = useState<string | null>(null)
  const [erro, setErro] = useState(erroDaVolta)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Liga a conta a este celular: traz os pontos de outro aparelho ou guarda o telefone da reserva
  const ligar = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('conta_ligar', { p_token: token() })
    if (error) return // migração 0012 ainda não rodada: o login funciona, só não leva os pontos
    setTelefone((data as { phone: string | null }).phone)
    aoLigar()
  }, [aoLigar])

  const uid = session?.user.id
  useEffect(() => {
    if (uid) ligar()
    else setTelefone(null)
  }, [uid, ligar])

  const entrar = useCallback(async () => {
    if (!supabase) return
    setErro('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
    })
    if (error) setErro('Não deu para abrir o Google. Confira a internet e tente de novo.')
  }, [])

  const sair = useCallback(async () => {
    await supabase?.auth.signOut({ scope: 'local' })
  }, [])

  const meta = session?.user.user_metadata ?? {}
  const conta: Conta | null = session
    ? {
        nome: (meta.full_name ?? meta.name ?? null) as string | null,
        email: session.user.email ?? null,
        foto: (meta.avatar_url ?? meta.picture ?? null) as string | null,
        telefone,
      }
    : null

  return { conta, erro, entrar, sair, ligar }
}
