import type { BusinessHours, Service } from '../supabase'
import { BAIRRO, ENDERECO, TZ, WHATSAPP_LABEL } from './dados'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const horaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
export const dataLongaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
export const dataCurtaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short' })
export const semanaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' })
export const diaFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric' })
export const mesFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'long' })
const horaNumFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' })
const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

export function preco(cents: number | null) {
  return cents === null ? 'Valor a consultar' : brl.format(cents / 100)
}

// O Carlos pediu para não mostrar o preço dos serviços por enquanto (2026-10-26).
// Quando a Leide quiser mostrar, troque para true: o site e o app voltam a usar o preço do painel.
export const MOSTRAR_PRECO_SERVICOS = false

export function precoServico(cents: number | null) {
  return MOSTRAR_PRECO_SERVICOS ? preco(cents) : 'Valor a consultar'
}

export function duracao(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function maiuscula(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function telefone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function manha(iso: string) {
  return Number(horaNumFmt.format(new Date(iso))) < 12
}

export type Dia = { iso: string; date: Date; weekday: number }

export function proximosDias(hours: BusinessHours[], quantos = 21): Dia[] {
  const abertos = new Set(hours.map((h) => h.weekday))
  const dias: Dia[] = []
  const agora = Date.now()
  for (let i = 0; i < quantos; i++) {
    // Meio-dia evita a virada de dia por causa do fuso
    const iso = isoFmt.format(new Date(agora + i * 86_400_000))
    const date = new Date(`${iso}T12:00:00-03:00`)
    if (abertos.has(date.getUTCDay())) dias.push({ iso, date, weekday: date.getUTCDay() })
  }
  return dias
}

export function horarioTexto(hours: BusinessHours[]) {
  if (hours.length === 0) return ''
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const dias = [...new Set(hours.map((h) => h.weekday))].sort()
  const abre = hours.map((h) => h.open_time).sort()[0]
  const fecha = hours.map((h) => h.close_time).sort().at(-1)!
  const t = (s: string) => `${Number(s.slice(0, 2))}h${s.slice(3, 5) === '00' ? '' : s.slice(3, 5)}`
  const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1)
  const faixa =
    dias.length === 1
      ? nomes[dias[0]]
      : seguidos
        ? `${nomes[dias[0]]} a ${nomes[dias[dias.length - 1]]}`
        : dias.map((d) => nomes[d]).join(', ')
  return `${faixa}, das ${t(abre)} às ${t(fecha)}`
}

export function linkGoogleAgenda(servico: Pick<Service, 'name'>, inicio: string, fim: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${servico.name} · Leide Hair`,
    dates: `${f(new Date(inicio))}/${f(new Date(fim))}`,
    location: `${ENDERECO}, ${BAIRRO}`,
    details: `Agendado pelo app. Dúvidas: WhatsApp ${WHATSAPP_LABEL}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

// Categoria do serviço, para a cor do ícone e os atalhos
export function categoria(nome: string): 'cabelo' | 'unhas' | 'estetica' {
  if (/manicure|pedicure|unha/i.test(nome)) return 'unhas'
  if (/depila|sobrancelha|est[eé]tica/i.test(nome)) return 'estetica'
  return 'cabelo'
}
