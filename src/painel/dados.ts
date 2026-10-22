// Contas do painel: quanto entrou, quanto saiu, quanto sobrou e como estão as clientes.
// Tudo calculado aqui no navegador a partir dos agendamentos e das despesas.
import { supabase } from '../supabase'
import { addDays, isoDateFmt, todayIso, type Status } from './util'

export type Visita = {
  id: string
  starts_at: string
  created_at: string
  status: Status
  client_name: string
  client_phone: string
  amount_cents: number | null
  payment_method: string | null
  service: { name: string; price_cents: number | null } | null
}

export type Despesa = { id: string; spent_on: string; description: string; category: string; amount_cents: number }

export type Cliente = {
  phone: string
  name: string
  birthday: string | null
  origin: string | null
  notes: string | null
  created_at: string
}

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Sem valor anotado, conta o preço do serviço (se tiver)
export function valorDe(v: Visita) {
  return v.amount_cents ?? v.service?.price_cents ?? 0
}

export const diaDe = (iso: string) => isoDateFmt.format(new Date(iso))
export const mesDe = (dia: string) => dia.slice(0, 7)

export function mesAnterior(mes: string, n = 1) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nomeDoMes(mes: string, longo = false) {
  const m = Number(mes.slice(5, 7)) - 1
  return longo ? MESES_LONGOS[m] : MESES[m]
}

const COLS_VISITA =
  'id, starts_at, created_at, status, client_name, client_phone, amount_cents, payment_method, service:services(name, price_cents)'

// Agendamentos de um período (dias no fuso de São Paulo, fim exclusivo)
export async function carregarVisitas(desde: string, ate: string) {
  const { data, error } = await supabase!
    .from('appointments')
    .select(COLS_VISITA)
    .gte('starts_at', `${desde}T00:00:00-03:00`)
    .lt('starts_at', `${ate}T00:00:00-03:00`)
    .order('starts_at')
  if (error) throw error
  return (data as unknown as Visita[]) ?? []
}

export async function carregarDespesas(desde: string, ate: string) {
  const { data, error } = await supabase!
    .from('expenses')
    .select('id, spent_on, description, category, amount_cents')
    .gte('spent_on', desde)
    .lt('spent_on', ate)
    .order('spent_on', { ascending: false })
  if (error) throw error
  return (data as Despesa[]) ?? []
}

export type Mes = { mes: string; entrou: number; saiu: number; sobrou: number; atendimentos: number }

export type Numeros = {
  hoje: string
  mes: string
  // este mês até hoje, e o mês passado até o mesmo dia
  entrou: number
  saiu: number
  sobrou: number
  entrouAntes: number
  sobrouAntes: number
  atendimentos: number
  atendimentosAntes: number
  medio: number
  novas: number
  cancelados: number
  marcados: number
  semValor: number
  meses: Mes[]
  topServicos: { nome: string; valor: number; vezes: number }[]
  porDia: { dia: string; vezes: number }[]
  visitas: Visita[]
}

// Seis meses de agendamentos e despesas, mais a próxima semana
export async function carregarNumeros(): Promise<Numeros> {
  const hoje = todayIso()
  const mes = mesDe(hoje)
  const inicio = `${mesAnterior(mes, 5)}-01`
  const [visitas, despesas] = await Promise.all([
    carregarVisitas(inicio, addDays(hoje, 8)),
    carregarDespesas(inicio, addDays(hoje, 1)),
  ])

  const feitas = visitas.filter((v) => v.status === 'concluido')
  const meses: Mes[] = Array.from({ length: 6 }, (_, i) => {
    const m = mesAnterior(mes, 5 - i)
    const f = feitas.filter((v) => mesDe(diaDe(v.starts_at)) === m)
    const entrou = f.reduce((s, v) => s + valorDe(v), 0)
    const saiu = despesas.filter((d) => mesDe(d.spent_on) === m).reduce((s, d) => s + d.amount_cents, 0)
    return { mes: m, entrou, saiu, sobrou: entrou - saiu, atendimentos: f.length }
  })

  // Mesmo período do mês passado: do dia 1 até o mesmo dia de hoje
  const diaHoje = hoje.slice(8, 10)
  const antes = mesAnterior(mes)
  const noPeriodoAntes = (dia: string) => mesDe(dia) === antes && dia.slice(8, 10) <= diaHoje
  const noMes = (dia: string) => mesDe(dia) === mes && dia <= hoje

  const fMes = feitas.filter((v) => noMes(diaDe(v.starts_at)))
  const fAntes = feitas.filter((v) => noPeriodoAntes(diaDe(v.starts_at)))
  const entrou = fMes.reduce((s, v) => s + valorDe(v), 0)
  const saiu = despesas.filter((d) => noMes(d.spent_on)).reduce((s, d) => s + d.amount_cents, 0)
  const entrouAntes = fAntes.reduce((s, v) => s + valorDe(v), 0)
  const saiuAntes = despesas.filter((d) => noPeriodoAntes(d.spent_on)).reduce((s, d) => s + d.amount_cents, 0)

  // Cliente nova: primeira visita feita neste mês (olhando os seis meses)
  const primeira = new Map<string, string>()
  for (const v of feitas) if (!primeira.has(v.client_phone)) primeira.set(v.client_phone, diaDe(v.starts_at))
  const novas = [...primeira.values()].filter(noMes).length

  const doMes = visitas.filter((v) => noMes(diaDe(v.starts_at)))
  const cancelados = doMes.filter((v) => v.status === 'cancelado').length

  const servicos = new Map<string, { nome: string; valor: number; vezes: number }>()
  for (const v of fMes) {
    const nome = v.service?.name ?? 'Serviço'
    const s = servicos.get(nome) ?? { nome, valor: 0, vezes: 0 }
    s.valor += valorDe(v)
    s.vezes += 1
    servicos.set(nome, s)
  }

  // Dias da semana mais procurados nos últimos 90 dias (só de terça a sábado)
  const desde90 = addDays(hoje, -90)
  const contagem = [0, 0, 0, 0, 0, 0, 0]
  for (const v of visitas) {
    const d = diaDe(v.starts_at)
    if (v.status !== 'cancelado' && d >= desde90 && d <= hoje) contagem[new Date(`${d}T12:00:00-03:00`).getDay()]++
  }

  return {
    hoje,
    mes,
    entrou,
    saiu,
    sobrou: entrou - saiu,
    entrouAntes,
    sobrouAntes: entrouAntes - saiuAntes,
    atendimentos: fMes.length,
    atendimentosAntes: fAntes.length,
    medio: fMes.length ? Math.round(entrou / fMes.length) : 0,
    novas,
    cancelados,
    marcados: doMes.length,
    semValor: fMes.filter((v) => v.amount_cents === null).length,
    meses,
    topServicos: [...servicos.values()].sort((a, b) => b.valor - a.valor || b.vezes - a.vezes).slice(0, 5),
    porDia: [2, 3, 4, 5, 6].map((d) => ({ dia: DIAS_CURTOS[d], vezes: contagem[d] })),
    visitas,
  }
}

// Variação em porcentagem, ou null quando não dá para comparar
export function variacao(agora: number, antes: number) {
  if (antes <= 0) return null
  return Math.round(((agora - antes) / antes) * 100)
}

// Resumo em texto para o assistente entender como o salão está
export function resumoParaAssistente(n: Numeros | null) {
  if (!n) return 'Números do salão: ainda não carregados.'
  const r = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`
  const linhas = [
    `Hoje é ${n.hoje} (${DIAS_CURTOS[new Date(`${n.hoje}T12:00:00-03:00`).getDay()]}).`,
    `Neste mês até hoje: entrou ${r(n.entrou)}, despesas ${r(n.saiu)}, sobrou ${r(n.sobrou)}, ${n.atendimentos} atendimentos, valor médio por cliente ${r(n.medio)}, ${n.novas} clientes novas, ${n.cancelados} cancelamentos de ${n.marcados} marcados.`,
    `Mesmo período do mês passado: entrou ${r(n.entrouAntes)}, ${n.atendimentosAntes} atendimentos.`,
    `Últimos meses (entrou / sobrou): ${n.meses.map((m) => `${nomeDoMes(m.mes)} ${r(m.entrou)} / ${r(m.sobrou)}`).join('; ')}.`,
    `Movimento por dia da semana nos últimos 90 dias: ${n.porDia.map((d) => `${d.dia} ${d.vezes}`).join(', ')}.`,
    n.topServicos.length
      ? `Serviços que mais renderam no mês: ${n.topServicos.map((s) => `${s.nome} (${s.vezes}x, ${r(s.valor)})`).join('; ')}.`
      : 'Ainda não há atendimentos concluídos neste mês.',
  ]
  return linhas.join('\n')
}
