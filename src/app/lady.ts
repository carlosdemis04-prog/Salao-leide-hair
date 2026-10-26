import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Corrida das Lady Points: R$ 1,00 gasto no salão = 100 pontos.
// O celular guarda um código aleatório e o liga ao telefone de uma reserva feita nele.
// Os pontos e os resgates ficam no banco; aqui só mostramos e pedimos o resgate.

export type SituacaoMeta = 'bloqueada' | 'disponivel' | 'ativa' | 'usada'

export type Meta = {
  id: string
  pontos: number
  titulo: string
  descricao: string | null
  final: boolean
  situacao: SituacaoMeta
  codigo: string | null
  expira_em: string | null
}

export type Corrida = { participando: boolean; pontos: number; metas: Meta[] }

const CHAVE_TOKEN = 'leide-app-lady'
const CHAVE_RESERVAS = 'leide-app-reservas'

export function token() {
  try {
    let t = localStorage.getItem(CHAVE_TOKEN)
    if (!t) {
      t = crypto.randomUUID()
      localStorage.setItem(CHAVE_TOKEN, t)
    }
    return t
  } catch {
    return null // Sem armazenamento (aba anônima): fica fora da corrida
  }
}

function ultimaReserva(): string | null {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_RESERVAS) ?? '[]') as { id: string; inicio: string }[]
    return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio)).pop()?.id ?? null
  } catch {
    return null
  }
}

export const pontosFmt = new Intl.NumberFormat('pt-BR')

export function useLady() {
  // null = carregando; undefined = corrida ainda não existe no banco (migração 0008 não rodada)
  const [corrida, setCorrida] = useState<Corrida | null | undefined>(supabase ? null : undefined)

  const carregar = useCallback(async () => {
    const t = token()
    if (!supabase || !t) return setCorrida(undefined)
    const { data, error } = await supabase.rpc('lady_minha_corrida', { p_token: t })
    setCorrida(error ? undefined : (data as Corrida))
  }, [])

  const vincular = useCallback(
    async (reserva: string) => {
      const t = token()
      if (!supabase || !t) return
      await supabase.rpc('lady_vincular', { p_token: t, p_reserva: reserva })
      carregar()
    },
    [carregar],
  )

  useEffect(() => {
    const reserva = ultimaReserva()
    if (reserva) vincular(reserva)
    else carregar()
  }, [vincular, carregar])

  const resgatar = useCallback(
    async (meta: string): Promise<{ codigo: string; expira_em: string } | string> => {
      const t = token()
      if (!supabase || !t) return 'Sem conexão com o salão.'
      const { data, error } = await supabase.rpc('lady_resgatar', { p_token: t, p_meta: meta })
      if (error) {
        const msg: Record<string, string> = {
          pontos_insuficientes: 'Ainda faltam pontos para essa recompensa.',
          recompensa_usada: 'Você já usou essa recompensa.',
          fora_da_corrida: 'Agende um horário pelo app para entrar na corrida.',
        }
        return msg[error.message] ?? 'Não deu para resgatar agora. Tente de novo.'
      }
      carregar()
      return data as { codigo: string; expira_em: string }
    },
    [carregar],
  )

  return { corrida, carregar, vincular, resgatar }
}

// Contagem regressiva até o código vencer (atualiza a cada segundo)
export function useFaltam(ate: string | null) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ate) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [ate])
  if (!ate) return null
  const ms = Math.max(0, new Date(ate).getTime() - agora)
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const dois = (n: number) => String(n).padStart(2, '0')
  return { acabou: ms === 0, texto: `${dois(h)}:${dois(m)}:${dois(s % 60)}` }
}
