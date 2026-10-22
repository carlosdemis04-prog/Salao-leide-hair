import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { avisarGoogle, supabase } from '../supabase'
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, WhatsAppIcon } from '../icons'
import './painel.css'

const TZ = 'America/Sao_Paulo'
const ENDERECO = 'Rua Silvestre Francisco Puglia, 26'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const dayTitleFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const shortDateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DURATIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 15)

type Status = 'pendente' | 'confirmado' | 'cancelado' | 'concluido'
type Appointment = {
  id: string
  starts_at: string
  ends_at: string
  status: Status
  client_name: string
  client_phone: string
  service: { name: string } | null
}
type AdminService = {
  id: string
  name: string
  price_cents: number | null
  duration_min: number
  active: boolean
  sort_order: number
}
type Block = { id: string; starts_at: string; ends_at: string; reason: string | null }
type Tab = 'agenda' | 'pontos' | 'folgas' | 'servicos' | 'ajustes'
type Pendente = { codigo: string; titulo: string; phone: string; nome: string | null; criado_em: string; expira_em: string }
type Lancamento = { id: string; phone: string; pontos: number; valor_cents: number | null; nota: string | null; created_at: string }
type Prefill = { phone: string; nome: string; n: number }

const STATUS_LABEL: Record<Status, string> = {
  pendente: 'A confirmar',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'pontos', label: 'Pontos' },
  { key: 'folgas', label: 'Folgas' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'ajustes', label: 'Ajustes' },
]

function todayIso() {
  return isoDateFmt.format(new Date())
}

function addDays(iso: string, n: number) {
  return isoDateFmt.format(new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * 86_400_000))
}

// São Paulo não tem mais horário de verão, então -03:00 vale o ano todo
function atSaoPaulo(iso: string, time: string) {
  return new Date(`${iso}T${time}:00-03:00`).toISOString()
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function whatsappLink(phone: string, text: string) {
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`
}

function centsToInput(cents: number | null) {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')
}

function inputToCents(value: string): number | null | 'erro' {
  const v = value.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 'erro'
}

function durationLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function dbError(error: { code?: string; message?: string }) {
  if (error.code === '23P01') return 'Já tem um agendamento nesse horário.'
  if (error.code === '42501') return 'Sua conta não tem permissão para isso.'
  return 'Não foi possível salvar. Confira a internet e tente de novo.'
}

export default function Painel() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true))
  }, [session])

  if (!supabase) return <p className="pn-center">O painel ainda não está ligado ao banco de dados.</p>
  if (checking) return <p className="pn-center">Carregando…</p>
  if (!session) return <Login />
  if (isAdmin === null) return <p className="pn-center">Carregando…</p>
  if (!isAdmin)
    return (
      <div className="pn-center">
        <p>Esta conta não tem acesso ao painel.</p>
        <button className="btn btn-ghost" onClick={() => supabase!.auth.signOut()}>
          Sair
        </button>
      </div>
    )
  return <Dashboard />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setSending(false)
    if (error) setError('E-mail ou senha incorretos.')
  }

  return (
    <main className="pn-login">
      <img src="/logo.webp" alt="Leide Hair" width="720" height="619" />
      <h1>Painel do salão</h1>
      <form onSubmit={submit} className="pn-form">
        <label className="pn-field">
          <span>E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="pn-field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="pn-error">{error}</p>}
        <button className="btn btn-primary" disabled={sending}>
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>('agenda')
  const [services, setServices] = useState<AdminService[]>([])

  const loadServices = useCallback(async () => {
    const { data } = await supabase!
      .from('services')
      .select('id, name, price_cents, duration_min, active, sort_order')
      .order('sort_order')
    setServices(data ?? [])
  }, [])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  // Resgates de Lady Points esperando a Leide. Confere de minuto em minuto e quando ela volta ao painel.
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const loadPendentes = useCallback(async () => {
    const { data, error } = await supabase!.rpc('lady_pendentes')
    setPendentes(error ? [] : ((data as Pendente[]) ?? []))
  }, [])
  useEffect(() => {
    loadPendentes()
    const t = setInterval(loadPendentes, 60_000)
    const ver = () => document.visibilityState === 'visible' && loadPendentes()
    document.addEventListener('visibilitychange', ver)
    return () => (clearInterval(t), document.removeEventListener('visibilitychange', ver))
  }, [loadPendentes])

  // "+ Lady Points" num atendimento: abre a aba Pontos com o telefone da cliente
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  function pontosPara(a: Appointment) {
    setPrefill((p) => ({ phone: a.client_phone, nome: a.client_name, n: (p?.n ?? 0) + 1 }))
    setTab('pontos')
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="pn">
      <header className="pn-top">
        <a href="/" className="pn-brand" aria-label="Ver o site">
          <img src="/logo.webp" alt="" width="720" height="619" />
          <span>Painel</span>
        </a>
        <button className="pn-link" onClick={() => supabase!.auth.signOut()}>
          Sair
        </button>
      </header>
      <nav className="pn-tabs" aria-label="Seções do painel">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} aria-current={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'pontos' && pendentes.length > 0 && (
              <span className="pn-dot" aria-label={`${pendentes.length} resgates esperando`}>
                {pendentes.length}
              </span>
            )}
          </button>
        ))}
      </nav>
      <main className="pn-main">
        {tab !== 'pontos' && pendentes.length > 0 && (
          <button className="pn-alerta" onClick={() => setTab('pontos')}>
            <strong>
              {pendentes.length === 1
                ? `${pendentes[0].nome?.split(' ')[0] ?? 'Uma cliente'} resgatou: ${pendentes[0].titulo}`
                : `${pendentes.length} clientes resgataram Lady Points`}
            </strong>
            <span>Valide o código quando ela mostrar no salão ›</span>
          </button>
        )}
        {tab === 'agenda' && <Agenda services={services} onPontos={pontosPara} />}
        {tab === 'pontos' && <LadyPoints pendentes={pendentes} reload={loadPendentes} prefill={prefill} />}
        {tab === 'folgas' && <Folgas />}
        {tab === 'servicos' && <Servicos services={services} reload={loadServices} />}
        {tab === 'ajustes' && <Ajustes />}
      </main>
    </div>
  )
}

/* ---------------- Agenda ---------------- */

function Agenda({ services, onPontos }: { services: AdminService[]; onPontos: (a: Appointment) => void }) {
  const [day, setDay] = useState(todayIso())
  const [items, setItems] = useState<Appointment[] | null>(null)
  const [pending, setPending] = useState<Appointment[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const cols = 'id, starts_at, ends_at, status, client_name, client_phone, service:services(name)'
    const [d, p] = await Promise.all([
      supabase!
        .from('appointments')
        .select(cols)
        .gte('starts_at', atSaoPaulo(day, '00:00'))
        .lt('starts_at', atSaoPaulo(addDays(day, 1), '00:00'))
        .order('starts_at'),
      supabase!
        .from('appointments')
        .select(cols)
        .eq('status', 'pendente')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(30),
    ])
    if (d.error || p.error) setError('Não foi possível carregar a agenda. Confira a internet.')
    setItems((d.data as unknown as Appointment[]) ?? [])
    setPending((p.data as unknown as Appointment[]) ?? [])
  }, [day])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(a: Appointment, status: Status) {
    setError('')
    const { error } = await supabase!.from('appointments').update({ status }).eq('id', a.id)
    if (error) setError(dbError(error))
    else avisarGoogle()
    load()
  }

  const isToday = day === todayIso()

  return (
    <>
      {pending.length > 0 && (
        <section className="pn-section">
          <h2>A confirmar</h2>
          <p className="pn-muted">Clientes que agendaram pelo site e ainda esperam sua confirmação.</p>
          <ul className="pn-list">
            {pending.map((a) => (
              <AppointmentCard key={a.id} a={a} showDate onStatus={setStatus} onPontos={onPontos} />
            ))}
          </ul>
        </section>
      )}

      <section className="pn-section">
        <div className="pn-daybar">
          <button className="pn-icon" aria-label="Dia anterior" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeftIcon />
          </button>
          <h2>{capitalize(dayTitleFmt.format(new Date(`${day}T12:00:00-03:00`)))}</h2>
          <button className="pn-icon" aria-label="Próximo dia" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRightIcon />
          </button>
        </div>
        <div className="pn-row">
          {!isToday && (
            <button className="pn-chip" onClick={() => setDay(todayIso())}>
              Voltar para hoje
            </button>
          )}
          <label className="pn-chip pn-date">
            <CalendarIcon />
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Escolher dia" />
          </label>
          <button className="pn-chip pn-chip-dark" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Fechar' : 'Novo agendamento'}
          </button>
        </div>

        {adding && (
          <NewAppointment
            services={services}
            day={day}
            onDone={() => {
              setAdding(false)
              load()
            }}
          />
        )}

        {error && <p className="pn-error">{error}</p>}
        {items === null && <p className="pn-muted">Carregando…</p>}
        {items?.length === 0 && <p className="pn-empty">Nenhum agendamento neste dia.</p>}
        <ul className="pn-list">
          {items?.map((a) => (
            <AppointmentCard key={a.id} a={a} onStatus={setStatus} onPontos={onPontos} />
          ))}
        </ul>
      </section>
    </>
  )
}

function AppointmentCard({
  a,
  showDate,
  onStatus,
  onPontos,
}: {
  a: Appointment
  showDate?: boolean
  onStatus: (a: Appointment, s: Status) => void
  onPontos: (a: Appointment) => void
}) {
  const start = new Date(a.starts_at)
  const firstName = a.client_name.split(' ')[0]
  const when = `${dayTitleFmt.format(start)} às ${timeFmt.format(start)}`
  const service = a.service?.name ?? 'Serviço'
  const confirmText = `Olá, ${firstName}! Seu horário de ${service} está confirmado para ${when}. Endereço: ${ENDERECO}. Até lá! Leide Hair`
  const cancelText = `Olá, ${firstName}. Infelizmente precisei cancelar seu horário de ${service} em ${when}. Me chama aqui para remarcar. Leide Hair`

  function confirm() {
    onStatus(a, 'confirmado')
    window.open(whatsappLink(a.client_phone, confirmText), '_blank', 'noreferrer')
  }

  function cancel() {
    if (!window.confirm(`Cancelar o horário de ${a.client_name}?`)) return
    onStatus(a, 'cancelado')
    if (window.confirm('Quer avisar a cliente pelo WhatsApp?')) {
      window.open(whatsappLink(a.client_phone, cancelText), '_blank', 'noreferrer')
    }
  }

  return (
    <li className={`pn-card st-${a.status}`}>
      <div className="pn-card-time">
        <strong>{timeFmt.format(start)}</strong>
        <span>{timeFmt.format(new Date(a.ends_at))}</span>
      </div>
      <div className="pn-card-body">
        {showDate && <span className="pn-card-date">{capitalize(shortDateFmt.format(start).replace(/\./g, ''))}</span>}
        <span className="pn-card-service">{service}</span>
        <span className="pn-card-client">
          {a.client_name} · <a href={whatsappLink(a.client_phone, `Olá, ${firstName}!`)} target="_blank" rel="noreferrer">
            {formatPhone(a.client_phone)}
          </a>
        </span>
        <span className={`pn-badge b-${a.status}`}>{STATUS_LABEL[a.status]}</span>
        <div className="pn-card-actions">
          {a.status === 'pendente' && (
            <button className="pn-btn pn-btn-dark" onClick={confirm}>
              <WhatsAppIcon /> Confirmar
            </button>
          )}
          {a.status === 'confirmado' && (
            <button className="pn-btn" onClick={() => onStatus(a, 'concluido')}>
              <CheckIcon /> Atendida
            </button>
          )}
          {(a.status === 'pendente' || a.status === 'confirmado') && (
            <button className="pn-btn pn-btn-quiet" onClick={cancel}>
              Cancelar
            </button>
          )}
          {a.status === 'concluido' && (
            <button className="pn-btn pn-btn-dark" onClick={() => onPontos(a)}>
              + Lady Points
            </button>
          )}
          {(a.status === 'cancelado' || a.status === 'concluido') && (
            <button className="pn-btn pn-btn-quiet" onClick={() => onStatus(a, 'confirmado')}>
              Desfazer
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function NewAppointment({ services, day, onDone }: { services: AdminService[]; day: string; onDone: () => void }) {
  const active = services.filter((s) => s.active)
  const [serviceId, setServiceId] = useState(active[0]?.id ?? '')
  const [date, setDate] = useState(day)
  const [time, setTime] = useState('09:00')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const svc = services.find((s) => s.id === serviceId)
    const digits = phone.replace(/\D/g, '')
    if (!svc) return setError('Escolha o serviço.')
    if (digits.length < 10) return setError('Confira o WhatsApp: use DDD e número.')
    setSending(true)
    setError('')
    const starts = atSaoPaulo(date, time)
    const ends = new Date(new Date(starts).getTime() + svc.duration_min * 60_000).toISOString()
    const { error } = await supabase!.from('appointments').insert({
      service_id: svc.id,
      starts_at: starts,
      ends_at: ends,
      client_name: name.trim(),
      client_phone: digits,
      status: 'confirmado',
    })
    setSending(false)
    if (error) return setError(dbError(error))
    avisarGoogle()
    onDone()
  }

  return (
    <form className="pn-form pn-box" onSubmit={submit}>
      <p className="pn-muted">Para clientes que marcaram pelo WhatsApp ou pessoalmente. Já entra como confirmado.</p>
      <label className="pn-field">
        <span>Serviço</span>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {active.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({durationLabel(s.duration_min)})
            </option>
          ))}
        </select>
      </label>
      <div className="pn-grid2">
        <label className="pn-field">
          <span>Dia</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="pn-field">
          <span>Horário</span>
          <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>
      <label className="pn-field">
        <span>Nome da cliente</span>
        <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
      </label>
      <label className="pn-field">
        <span>WhatsApp</span>
        <input
          inputMode="tel"
          value={phone}
          placeholder="(11) 98765-4321"
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          required
        />
      </label>
      {error && <p className="pn-error">{error}</p>}
      <button className="btn btn-primary" disabled={sending}>
        {sending ? 'Salvando…' : 'Salvar agendamento'}
      </button>
    </form>
  )
}

/* ---------------- Folgas ---------------- */

function Folgas() {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [date, setDate] = useState(todayIso())
  const [allDay, setAllDay] = useState(true)
  const [from, setFrom] = useState('12:00')
  const [to, setTo] = useState('13:00')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase!
      .from('blocked_times')
      .select('id, starts_at, ends_at, reason')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')
    setBlocks(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    const starts = atSaoPaulo(date, allDay ? '00:00' : from)
    const ends = allDay ? atSaoPaulo(addDays(date, 1), '00:00') : atSaoPaulo(date, to)
    if (ends <= starts) return setError('O horário final precisa ser depois do inicial.')
    const { error } = await supabase!
      .from('blocked_times')
      .insert({ starts_at: starts, ends_at: ends, reason: reason.trim() || null })
    if (error) return setError(dbError(error))
    setReason('')
    load()
  }

  async function remove(b: Block) {
    if (!window.confirm('Liberar esse período de novo para agendamentos?')) return
    await supabase!.from('blocked_times').delete().eq('id', b.id)
    load()
  }

  return (
    <section className="pn-section">
      <h2>Folgas e compromissos</h2>
      <p className="pn-muted">O site não oferece horários nesses períodos.</p>
      <form className="pn-form pn-box" onSubmit={add}>
        <label className="pn-field">
          <span>Dia</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="pn-check">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>O dia inteiro</span>
        </label>
        {!allDay && (
          <div className="pn-grid2">
            <label className="pn-field">
              <span>Das</span>
              <input type="time" step={900} value={from} onChange={(e) => setFrom(e.target.value)} required />
            </label>
            <label className="pn-field">
              <span>Até</span>
              <input type="time" step={900} value={to} onChange={(e) => setTo(e.target.value)} required />
            </label>
          </div>
        )}
        <label className="pn-field">
          <span>Motivo (opcional)</span>
          <input value={reason} placeholder="Feriado, consulta, viagem…" onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <p className="pn-error">{error}</p>}
        <button className="btn btn-primary">Bloquear período</button>
      </form>

      {blocks?.length === 0 && <p className="pn-empty">Nenhuma folga marcada.</p>}
      <ul className="pn-list">
        {blocks?.map((b) => {
          const s = new Date(b.starts_at)
          const e = new Date(b.ends_at)
          const whole = timeFmt.format(s) === '00:00' && timeFmt.format(e) === '00:00'
          const lastDay = new Date(e.getTime() - 1)
          const label = whole
            ? isoDateFmt.format(s) === isoDateFmt.format(lastDay)
              ? `${capitalize(dayTitleFmt.format(s))}, o dia inteiro`
              : `${capitalize(shortDateFmt.format(s))} até ${shortDateFmt.format(lastDay)}`
            : `${capitalize(dayTitleFmt.format(s))}, das ${timeFmt.format(s)} às ${timeFmt.format(e)}`
          return (
            <li key={b.id} className="pn-card pn-card-flat">
              <div className="pn-card-body">
                <span className="pn-card-service">{label}</span>
                {b.reason && <span className="pn-card-client">{b.reason}</span>}
              </div>
              <button className="pn-btn pn-btn-quiet" onClick={() => remove(b)}>
                Liberar
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------------- Lady Points ---------------- */

const LADY_ERRO: Record<string, string> = {
  codigo_invalido: 'Esse código não existe. Confira as letras com a cliente.',
  codigo_usado: 'Esse código já foi usado.',
  codigo_expirado: 'Esse código venceu. Peça para a cliente resgatar de novo no app.',
  telefone_invalido: 'Confira o telefone (com DDD).',
  valor_invalido: 'Digite o valor pago.',
  sem_permissao: 'Sua conta não tem permissão para isso.',
}

function ladyErro(error: { message?: string }) {
  return LADY_ERRO[error.message ?? ''] ?? 'Não deu certo. Confira a internet e tente de novo. (Já rodou o arquivo 0008 no Supabase?)'
}

const pontosFmt = new Intl.NumberFormat('pt-BR')

function LadyPoints({ pendentes, reload, prefill }: { pendentes: Pendente[]; reload: () => void; prefill: Prefill | null }) {
  const [codigo, setCodigo] = useState('')
  const [validado, setValidado] = useState<{ titulo: string; nome: string | null; phone: string } | null>(null)
  const [erroCodigo, setErroCodigo] = useState('')

  const [phone, setPhone] = useState(prefill ? formatPhone(prefill.phone) : '')
  const [nome, setNome] = useState(prefill?.nome ?? '')
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [lancado, setLancado] = useState('')
  const [erroLanc, setErroLanc] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [extrato, setExtrato] = useState<Lancamento[] | null>(null)

  // Veio do "+ Lady Points" de um atendimento
  const [vindoDe, setVindoDe] = useState(prefill?.n)
  if (prefill && prefill.n !== vindoDe) {
    setVindoDe(prefill.n)
    setPhone(formatPhone(prefill.phone))
    setNome(prefill.nome)
    setLancado('')
  }

  const loadExtrato = useCallback(async () => {
    const { data } = await supabase!
      .from('lady_pontos')
      .select('id, phone, pontos, valor_cents, nota, created_at')
      .order('created_at', { ascending: false })
      .limit(15)
    setExtrato(data ?? [])
  }, [])

  useEffect(() => {
    loadExtrato()
  }, [loadExtrato])

  async function validar(c: string) {
    setErroCodigo('')
    setValidado(null)
    const { data, error } = await supabase!.rpc('lady_validar', { p_codigo: c })
    if (error) return setErroCodigo(ladyErro(error))
    setValidado(data as { titulo: string; nome: string | null; phone: string })
    setCodigo('')
    reload()
  }

  const cents = inputToCents(valor)

  async function lancar(e: FormEvent) {
    e.preventDefault()
    setErroLanc('')
    setLancado('')
    if (cents === 'erro' || cents === null || cents === 0) return setErroLanc('Digite o valor pago, por exemplo 120,00.')
    setEnviando(true)
    const { data, error } = await supabase!.rpc('lady_lancar', {
      p_phone: phone,
      p_valor_cents: cents,
      p_nota: nota.trim() || (nome ? nome : null),
    })
    setEnviando(false)
    if (error) return setErroLanc(ladyErro(error))
    setLancado(`${pontosFmt.format(cents)} pontos lançados. ${nome ? nome.split(' ')[0] : 'A cliente'} agora tem ${pontosFmt.format(data as number)} pontos.`)
    setValor('')
    setNota('')
    loadExtrato()
  }

  async function desfazer(l: Lancamento) {
    if (!window.confirm(`Apagar o lançamento de ${pontosFmt.format(l.pontos)} pontos para ${formatPhone(l.phone)}?`)) return
    await supabase!.from('lady_pontos').delete().eq('id', l.id)
    loadExtrato()
  }

  return (
    <>
      <section className="pn-section">
        <h2>Validar código</h2>
        <p className="pn-muted">A cliente mostra o código no app. Digite aqui para conferir e dar baixa.</p>
        <form
          className="pn-form pn-box"
          onSubmit={(e) => {
            e.preventDefault()
            validar(codigo)
          }}
        >
          <label className="pn-field">
            <span>Código</span>
            <input
              className="pn-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
              required
              minLength={6}
            />
          </label>
          {erroCodigo && <p className="pn-error">{erroCodigo}</p>}
          {validado && (
            <p className="pn-ok">
              <CheckIcon /> Código válido: <strong>{validado.titulo}</strong>
              {validado.nome ? ` para ${validado.nome}` : ` para ${formatPhone(validado.phone)}`}. Já demos baixa.
            </p>
          )}
          <button className="btn btn-primary">Validar código</button>
        </form>
      </section>

      <section className="pn-section">
        <h2>Resgates esperando</h2>
        <p className="pn-muted">Recompensas que as clientes resgataram no app e ainda vão usar no salão.</p>
        {pendentes.length === 0 && <p className="pn-empty">Nenhum resgate esperando.</p>}
        <ul className="pn-list">
          {pendentes.map((r) => (
            <li key={r.codigo} className="pn-card pn-card-flat">
              <div className="pn-card-body">
                <span className="pn-card-service">{r.titulo}</span>
                <span className="pn-card-client">
                  {r.nome ?? 'Cliente'} · {formatPhone(r.phone)}
                </span>
                <span className="pn-muted-inline">
                  Código <strong>{r.codigo}</strong> · vale até {timeFmt.format(new Date(r.expira_em))} de{' '}
                  {shortDateFmt.format(new Date(r.expira_em))}
                </span>
              </div>
              <button className="pn-btn pn-btn-dark" onClick={() => validar(r.codigo)}>
                <CheckIcon /> Usou
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="pn-section">
        <h2>Lançar pontos</h2>
        <p className="pn-muted">Quando a cliente pagar, lance o valor. Cada R$ 1,00 vale 100 Lady Points.</p>
        <form className="pn-form pn-box" onSubmit={lancar}>
          {nome && <p className="pn-muted-inline">Cliente: {nome}</p>}
          <label className="pn-field">
            <span>Telefone da cliente (o mesmo do agendamento)</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => (setPhone(formatPhone(e.target.value)), setNome(''))}
              placeholder="(11) 90000-0000"
              required
            />
          </label>
          <label className="pn-field">
            <span>Valor pago (R$)</span>
            <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="120,00" required />
          </label>
          {typeof cents === 'number' && cents > 0 && (
            <p className="pn-muted-inline">= {pontosFmt.format(cents)} Lady Points</p>
          )}
          <label className="pn-field">
            <span>Anotação (opcional)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escova e hidratação" />
          </label>
          {erroLanc && <p className="pn-error">{erroLanc}</p>}
          {lancado && (
            <p className="pn-ok">
              <CheckIcon /> {lancado}
            </p>
          )}
          <button className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Lançando…' : 'Lançar pontos'}
          </button>
        </form>
      </section>

      <section className="pn-section">
        <h3>Últimos lançamentos</h3>
        {extrato?.length === 0 && <p className="pn-empty">Nenhum ponto lançado ainda.</p>}
        <ul className="pn-list">
          {extrato?.map((l) => (
            <li key={l.id} className="pn-card pn-card-flat">
              <div className="pn-card-body">
                <span className="pn-card-service">
                  {l.pontos > 0 ? '+' : ''}
                  {pontosFmt.format(l.pontos)} pontos
                </span>
                <span className="pn-card-client">
                  {formatPhone(l.phone)}
                  {l.nota ? ` · ${l.nota}` : ''}
                </span>
                <span className="pn-muted-inline">{capitalize(shortDateFmt.format(new Date(l.created_at)))}</span>
              </div>
              <button className="pn-btn pn-btn-quiet" onClick={() => desfazer(l)}>
                Apagar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

/* ---------------- Serviços ---------------- */

function Servicos({ services, reload }: { services: AdminService[]; reload: () => Promise<void> }) {
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [newPrice, setNewPrice] = useState('')
  const [error, setError] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const cents = inputToCents(newPrice)
    if (cents === 'erro') return setError('Preço inválido. Use, por exemplo, 60 ou 59,90.')
    setError('')
    const { error } = await supabase!.from('services').insert({
      name: newName.trim(),
      duration_min: newDuration,
      price_cents: cents,
      sort_order: Math.max(0, ...services.map((s) => s.sort_order)) + 1,
    })
    if (error) return setError(error.code === '23505' ? 'Já existe um serviço com esse nome.' : dbError(error))
    setNewName('')
    setNewPrice('')
    reload()
  }

  return (
    <section className="pn-section">
      <h2>Serviços e preços</h2>
      <p className="pn-muted">
        Deixe o preço vazio para aparecer "A consultar". A duração define quanto tempo o horário fica ocupado.
      </p>
      <ul className="pn-list">
        {services.map((s) => (
          <ServiceRow key={s.id} s={s} reload={reload} />
        ))}
      </ul>

      <form className="pn-form pn-box" onSubmit={add}>
        <h3>Novo serviço</h3>
        <label className="pn-field">
          <span>Nome</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} minLength={2} required />
        </label>
        <div className="pn-grid2">
          <label className="pn-field">
            <span>Preço (R$)</span>
            <input inputMode="decimal" value={newPrice} placeholder="A consultar" onChange={(e) => setNewPrice(e.target.value)} />
          </label>
          <label className="pn-field">
            <span>Duração</span>
            <select value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {durationLabel(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="pn-error">{error}</p>}
        <button className="btn btn-primary">Adicionar serviço</button>
      </form>
    </section>
  )
}

function ServiceRow({ s, reload }: { s: AdminService; reload: () => Promise<void> }) {
  const [price, setPrice] = useState(centsToInput(s.price_cents))
  const [duration, setDuration] = useState(s.duration_min)
  const [active, setActive] = useState(s.active)
  const [state, setState] = useState<'' | 'salvando' | 'salvo' | string>('')

  const changed = price !== centsToInput(s.price_cents) || duration !== s.duration_min || active !== s.active

  async function save() {
    const cents = inputToCents(price)
    if (cents === 'erro') return setState('Preço inválido. Use, por exemplo, 60 ou 59,90.')
    setState('salvando')
    const { error } = await supabase!
      .from('services')
      .update({ price_cents: cents, duration_min: duration, active })
      .eq('id', s.id)
    if (error) return setState(dbError(error))
    await reload()
    setState('salvo')
  }

  return (
    <li className={`pn-card pn-service ${active ? '' : 'off'}`}>
      <div className="pn-service-head">
        <span className="pn-card-service">{s.name}</span>
        <label className="pn-switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>{active ? 'No site' : 'Escondido'}</span>
        </label>
      </div>
      <div className="pn-grid2">
        <label className="pn-field">
          <span>Preço (R$)</span>
          <input
            inputMode="decimal"
            value={price}
            placeholder="A consultar"
            onChange={(e) => {
              setPrice(e.target.value)
              setState('')
            }}
          />
        </label>
        <label className="pn-field">
          <span>Duração</span>
          <select
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value))
              setState('')
            }}
          >
            {(DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b)).map((d) => (
              <option key={d} value={d}>
                {durationLabel(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pn-service-foot">
        {state === 'salvo' && !changed && (
          <span className="pn-ok">
            <CheckIcon /> Salvo
          </span>
        )}
        {state && state !== 'salvo' && state !== 'salvando' && <span className="pn-error-inline">{state}</span>}
        {changed && (
          <button className="pn-btn pn-btn-dark" onClick={save} disabled={state === 'salvando'}>
            {state === 'salvando' ? 'Salvando…' : 'Salvar'}
          </button>
        )}
        {!changed && s.price_cents !== null && state !== 'salvo' && (
          <span className="pn-muted-inline">{brl.format(s.price_cents / 100)}</span>
        )}
      </div>
    </li>
  )
}

/* ---------------- Ajustes ---------------- */

type DayHours = { open: boolean; from: string; to: string; lunch: boolean; lunchFrom: string; lunchTo: string }

function Ajustes() {
  const [days, setDays] = useState<DayHours[] | null>(null)
  const [token, setToken] = useState('')
  const [state, setState] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([
      supabase!.from('business_hours').select('weekday, open_time, close_time').order('open_time'),
      supabase!.from('settings').select('calendar_token').maybeSingle(),
    ])
    const rows = h.data ?? []
    setDays(
      WEEKDAYS.map((_, wd) => {
        const r = rows.filter((x) => x.weekday === wd)
        const t = (v: string) => v.slice(0, 5)
        if (r.length === 0) return { open: false, from: '09:00', to: '18:00', lunch: false, lunchFrom: '12:00', lunchTo: '13:00' }
        const last = r[r.length - 1]
        return {
          open: true,
          from: t(r[0].open_time),
          to: t(last.close_time),
          lunch: r.length > 1,
          lunchFrom: r.length > 1 ? t(r[0].close_time) : '12:00',
          lunchTo: r.length > 1 ? t(r[1].open_time) : '13:00',
        }
      }),
    )
    setToken(s.data?.calendar_token ?? '')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function update(wd: number, patch: Partial<DayHours>) {
    setDays((d) => d && d.map((x, i) => (i === wd ? { ...x, ...patch } : x)))
    setState('')
  }

  async function save() {
    if (!days) return
    const rows: { weekday: number; open_time: string; close_time: string }[] = []
    for (const [wd, d] of days.entries()) {
      if (!d.open) continue
      const ok = d.lunch ? d.from < d.lunchFrom && d.lunchFrom < d.lunchTo && d.lunchTo < d.to : d.from < d.to
      if (!ok) return setState(`Confira os horários de ${WEEKDAYS[wd].toLowerCase()}.`)
      if (d.lunch) {
        rows.push({ weekday: wd, open_time: d.from, close_time: d.lunchFrom })
        rows.push({ weekday: wd, open_time: d.lunchTo, close_time: d.to })
      } else rows.push({ weekday: wd, open_time: d.from, close_time: d.to })
    }
    setState('Salvando…')
    const del = await supabase!.from('business_hours').delete().gte('weekday', 0)
    const ins = del.error ? del : await supabase!.from('business_hours').insert(rows)
    if (ins.error) return setState(dbError(ins.error))
    setState('Horário salvo.')
  }

  const feedUrl = useMemo(() => (token ? `${window.location.origin}/agenda.ics?token=${token}` : ''), [token])

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
    } catch {
      window.prompt('Copie o link:', feedUrl)
    }
  }

  return (
    <>
      <section className="pn-section">
        <h2>Horário de atendimento</h2>
        <p className="pn-muted">O site só oferece horários dentro destes períodos.</p>
        {!days && <p className="pn-muted">Carregando…</p>}
        <ul className="pn-list">
          {days?.map((d, wd) => (
            <li key={wd} className={`pn-card pn-hours ${d.open ? '' : 'off'}`}>
              <label className="pn-switch">
                <input type="checkbox" checked={d.open} onChange={(e) => update(wd, { open: e.target.checked })} />
                <span className="pn-hours-day">{WEEKDAYS[wd]}</span>
              </label>
              {d.open ? (
                <div className="pn-hours-body">
                  <div className="pn-grid2">
                    <label className="pn-field">
                      <span>Abre</span>
                      <input type="time" step={1800} value={d.from} onChange={(e) => update(wd, { from: e.target.value })} />
                    </label>
                    <label className="pn-field">
                      <span>Fecha</span>
                      <input type="time" step={1800} value={d.to} onChange={(e) => update(wd, { to: e.target.value })} />
                    </label>
                  </div>
                  <label className="pn-check">
                    <input type="checkbox" checked={d.lunch} onChange={(e) => update(wd, { lunch: e.target.checked })} />
                    <span>Pausa para almoço</span>
                  </label>
                  {d.lunch && (
                    <div className="pn-grid2">
                      <label className="pn-field">
                        <span>Das</span>
                        <input
                          type="time"
                          step={1800}
                          value={d.lunchFrom}
                          onChange={(e) => update(wd, { lunchFrom: e.target.value })}
                        />
                      </label>
                      <label className="pn-field">
                        <span>Até</span>
                        <input type="time" step={1800} value={d.lunchTo} onChange={(e) => update(wd, { lunchTo: e.target.value })} />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <span className="pn-muted-inline">Fechado</span>
              )}
            </li>
          ))}
        </ul>
        {days && (
          <div className="pn-save">
            <button className="btn btn-primary" onClick={save}>
              Salvar horário
            </button>
            {state && <span className={state === 'Horário salvo.' ? 'pn-ok' : 'pn-muted-inline'}>{state}</span>}
          </div>
        )}
      </section>

      <section className="pn-section">
        <h2>Google Agenda</h2>
        <p className="pn-muted">
          Coloque este link no Google Agenda uma vez e os agendamentos do site aparecem lá sozinhos. O Google atualiza a
          cada poucas horas; para ver um agendamento na hora, use a aba Agenda deste painel. Depois que a ligação direta
          com o Google estiver feita (passo a passo no README), este link não é mais necessário.
        </p>
        {feedUrl ? (
          <>
            <div className="pn-feed">
              <code>{feedUrl}</code>
              <button className="pn-btn pn-btn-dark" onClick={copy}>
                {copied ? (
                  <>
                    <CheckIcon /> Copiado
                  </>
                ) : (
                  'Copiar link'
                )}
              </button>
            </div>
            <ol className="pn-steps">
              <li>No computador, abra calendar.google.com com a conta do salão.</li>
              <li>
                Na esquerda, ao lado de <b>Outras agendas</b>, clique em <b>+</b> e depois em <b>Do URL</b>.
              </li>
              <li>
                Cole o link e clique em <b>Adicionar agenda</b>. Pronto: ela aparece também no app do celular.
              </li>
            </ol>
            <p className="pn-muted">
              <ClockIcon /> Não compartilhe esse link: quem tiver ele vê os nomes e telefones das clientes.
            </p>
          </>
        ) : (
          <p className="pn-muted">Carregando…</p>
        )}
      </section>
    </>
  )
}
