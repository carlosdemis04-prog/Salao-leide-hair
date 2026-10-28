import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Lady Family: quem indicou 5 amigas e fez 15 serviços entra para a família da Leide
// e ganha 10% de desconto permanente. Para continuar: 1 serviço por mês e 1 amiga a cada 3 meses.
// As contas ficam no banco (migração 0014); aqui só mostramos.

export const AMIGAS_PARA_ENTRAR = 5
export const SERVICOS_PARA_ENTRAR = 15
export const DESCONTO_FAMILIA = 10

export type MinhaFamilia =
  | { participando: false }
  | {
      participando: true
      nome: string | null
      servicos: number
      amigas: number
      membro: boolean
      desde: string | null
      primeira_vez: string | null
      saiu_em: string | null
      servico_ate: string | null
      indicacao_ate: string | null
      volta_servico: boolean | null
      volta_indicacao: boolean | null
    }

const CHAVE_TOKEN = 'leide-app-lady'

function token() {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

export function useFamilia() {
  // null = carregando; undefined = programa ainda não existe no banco (migração 0014 não rodada)
  const [familia, setFamilia] = useState<MinhaFamilia | null | undefined>(supabase ? null : undefined)

  const carregar = useCallback(async () => {
    const t = token()
    if (!supabase) return setFamilia(undefined)
    if (!t) return setFamilia({ participando: false })
    const { data, error } = await supabase.rpc('family_minha', { p_token: t })
    setFamilia(error ? undefined : (data as MinhaFamilia))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { familia, carregar }
}

// Dias até um prazo (0 = vence hoje)
export function diasAte(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}
