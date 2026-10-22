import { useCallback, useEffect, useState } from 'react'
import { supabase, type BusinessHours, type Service } from '../supabase'

// Dados reais do salão (os mesmos do site e do folheto)
export const TZ = 'America/Sao_Paulo'
export const WHATSAPP = (import.meta.env.VITE_SALAO_WHATSAPP as string | undefined) || '5511922297887'
export const WHATSAPP_LABEL = '(11) 92229-7887'
export const INSTAGRAM = 'leidehair_beauty'
export const ENDERECO = 'Rua Silvestre Francisco Puglia, 26'
export const BAIRRO = 'Campininha, São Paulo'
export const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ENDERECO}, ${BAIRRO}`)}`

export function linkWhats(texto?: string) {
  return `https://wa.me/${WHATSAPP}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

export type Oferta = {
  id: string
  title: string
  description: string | null
  conditions: string | null
  image_url: string | null
  price_cents: number | null
  original_price_cents: number | null
  service_id: string | null
  valid_until: string | null
}

export type Evento = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  spots: number | null
}

// Serviços, horário, ofertas e eventos. Se ofertas e eventos ainda não existirem no banco
// (migração 0005 não rodada), as abas mostram o estado vazio em vez de quebrar.
export function useSalao() {
  const [services, setServices] = useState<Service[]>([])
  const [hours, setHours] = useState<BusinessHours[]>([])
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(Boolean(supabase))
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    if (!supabase) return
    setCarregando(true)
    setErro('')
    Promise.all([
      supabase.from('services').select('id, name, description, price_cents, duration_min').order('sort_order'),
      supabase.from('business_hours').select('weekday, open_time, close_time'),
      supabase
        .from('offers')
        .select('id, title, description, conditions, image_url, price_cents, original_price_cents, service_id, valid_until')
        .order('sort_order'),
      supabase
        .from('events')
        .select('id, title, description, image_url, starts_at, ends_at, location, spots')
        .order('starts_at'),
    ]).then(([s, h, o, e]) => {
      if (s.error || h.error) setErro('Não foi possível carregar os serviços. Confira a internet e tente de novo.')
      setServices(s.data ?? [])
      setHours(h.data ?? [])
      setOfertas(o.error ? [] : (o.data ?? []))
      setEventos(e.error ? [] : (e.data ?? []))
      setCarregando(false)
    })
  }, [])

  useEffect(carregar, [carregar])

  return { services, hours, ofertas, eventos, carregando, erro, recarregar: carregar }
}

// Reservas feitas neste celular. Guardamos só o código e o resumo; a situação vem do banco.
export type Reserva = {
  id: string
  servico: string
  inicio: string
  fim: string
  nome: string
}

export type SituacaoReserva = 'pendente' | 'confirmado' | 'cancelado' | 'concluido'

const CHAVE = 'leide-app-reservas'

function lerReservas(): Reserva[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(salvo) ? salvo : []
  } catch {
    return []
  }
}

function salvarReservas(lista: Reserva[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(-10)))
  } catch {
    // Sem armazenamento (aba anônima): a reserva continua valendo no salão
  }
}

export function useReservas() {
  const [reservas, setReservas] = useState<Reserva[]>(lerReservas)
  const [situacao, setSituacao] = useState<Record<string, SituacaoReserva>>({})

  const adicionar = useCallback((r: Reserva) => {
    setReservas((lista) => {
      const nova = [...lista.filter((x) => x.id !== r.id), r]
      salvarReservas(nova)
      return nova
    })
    setSituacao((s) => ({ ...s, [r.id]: 'pendente' }))
  }, [])

  // Atualiza a situação das reservas que ainda não passaram
  const atualizar = useCallback(() => {
    if (!supabase) return
    const agora = Date.now()
    for (const r of lerReservas()) {
      if (new Date(r.fim).getTime() < agora) continue
      supabase.rpc('consultar_reserva', { p_id: r.id }).then(({ data, error }) => {
        if (error) return // migração 0005 ainda não rodada: fica sem a situação
        const linha = (data ?? [])[0] as { status: SituacaoReserva } | undefined
        if (linha) setSituacao((s) => ({ ...s, [r.id]: linha.status }))
      })
    }
  }, [])

  useEffect(atualizar, [atualizar])

  const cancelar = useCallback(async (id: string) => {
    if (!supabase) return 'Sem conexão com o salão.'
    const { error } = await supabase.rpc('cancelar_reserva', { p_id: id })
    if (error) {
      const msg: Record<string, string> = {
        cancelamento_tarde: 'Faltam menos de 2 horas. Para cancelar, fale com a Leide no WhatsApp.',
        reserva_encerrada: 'Essa reserva já foi encerrada.',
      }
      return msg[error.message] ?? 'Não deu para cancelar pelo app. Fale com a Leide no WhatsApp.'
    }
    setSituacao((s) => ({ ...s, [id]: 'cancelado' }))
    return ''
  }, [])

  const agora = Date.now()
  const proxima =
    reservas
      .filter((r) => new Date(r.fim).getTime() > agora && situacao[r.id] !== 'cancelado')
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null

  return { proxima, situacao, adicionar, cancelar, atualizar }
}
