// Pedaços usados em várias telas do painel: datas no fuso de São Paulo, dinheiro, telefone e WhatsApp

export const TZ = 'America/Sao_Paulo'
export const ENDERECO = 'Rua Silvestre Francisco Puglia, 26'

export const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
export const dayTitleFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
export const shortDateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
export const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export type Status = 'pendente' | 'confirmado' | 'cancelado' | 'concluido'
export type Appointment = {
  id: string
  starts_at: string
  ends_at: string
  status: Status
  client_name: string
  client_phone: string
  amount_cents: number | null
  payment_method: string | null
  service: { name: string; price_cents?: number | null } | null
}

export type AdminService = {
  id: string
  name: string
  price_cents: number | null
  duration_min: number
  active: boolean
  sort_order: number
}

export function todayIso() {
  return isoDateFmt.format(new Date())
}

export function addDays(iso: string, n: number) {
  return isoDateFmt.format(new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * 86_400_000))
}

// São Paulo não tem mais horário de verão, então -03:00 vale o ano todo
export function atSaoPaulo(iso: string, time: string) {
  return new Date(`${iso}T${time}:00-03:00`).toISOString()
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function whatsappLink(phone: string, text: string) {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`
}

export function centsToInput(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

export function inputToCents(value: string): number | null | 'erro' {
  const v = value.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 'erro'
}

export function durationLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function dbError(error: { code?: string; message?: string }) {
  if (error.code === '23P01') return 'Já tem um agendamento nesse horário.'
  if (error.code === '42501') return 'Sua conta não tem permissão para isso.'
  // Coluna do valor cobrado ainda não existe: falta rodar a migração 0009 no Supabase
  if (error.code === '42703' || error.code === 'PGRST204') return 'Falta atualizar o banco (migração 0009) para guardar o valor cobrado.'
  return 'Não foi possível salvar. Confira a internet e tente de novo.'
}
