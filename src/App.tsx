import { useEffect, useMemo, useState } from 'react'
import { supabase, type BusinessHours, type Service } from './supabase'

const TZ = 'America/Sao_Paulo'
const DAYS_AHEAD = 21
const SALAO_WHATSAPP = (import.meta.env.VITE_SALAO_WHATSAPP as string | undefined) ?? ''

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const longDateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' })
const dayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' })
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

const ERROR_MESSAGES: Record<string, string> = {
  horario_indisponivel: 'Esse horário acabou de ser ocupado. Escolha outro, por favor.',
  telefone_invalido: 'Confira o WhatsApp: use DDD e número, por exemplo (11) 98765-4321.',
  nome_invalido: 'Escreva seu nome, por favor.',
  servico_invalido: 'Esse serviço não está mais disponível.',
}

type Day = { iso: string; date: Date; weekday: number }
type Step = 'servico' | 'horario' | 'dados' | 'feito'

function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function upcomingDays(): Day[] {
  const days: Day[] = []
  const now = Date.now()
  for (let i = 0; i < DAYS_AHEAD; i++) {
    // Meio-dia evita problemas de virada de dia por causa do fuso
    const iso = isoDateFmt.format(new Date(now + i * 86_400_000))
    const date = new Date(`${iso}T12:00:00-03:00`)
    days.push({ iso, date, weekday: date.getUTCDay() })
  }
  return days
}

function errorMessage(err: { message?: string } | null) {
  const code = err?.message ?? ''
  return ERROR_MESSAGES[code] ?? 'Não foi possível concluir agora. Tente de novo em instantes.'
}

export default function App() {
  const [step, setStep] = useState<Step>('servico')
  const [services, setServices] = useState<Service[]>([])
  const [hours, setHours] = useState<BusinessHours[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [service, setService] = useState<Service | null>(null)
  const [day, setDay] = useState<Day | null>(null)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [slot, setSlot] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase.from('services').select('id, name, description, price_cents, duration_min').order('sort_order'),
      supabase.from('business_hours').select('weekday, open_time, close_time'),
    ]).then(([s, h]) => {
      if (s.error || h.error) setLoadError('Não foi possível carregar os serviços.')
      setServices(s.data ?? [])
      setHours(h.data ?? [])
      setLoading(false)
    })
  }, [])

  const openDays = useMemo(() => {
    const weekdays = new Set(hours.map((h) => h.weekday))
    return upcomingDays().filter((d) => weekdays.has(d.weekday))
  }, [hours])

  useEffect(() => {
    if (!supabase || !service || !day) return
    let cancelled = false
    setSlots(null)
    supabase
      .rpc('get_available_slots', { p_service_id: service.id, p_date: day.iso })
      .then(({ data }) => {
        if (!cancelled) setSlots((data ?? []).map((r: { slot_start: string }) => r.slot_start))
      })
    return () => {
      cancelled = true
    }
  }, [service, day])

  function chooseService(s: Service) {
    setService(s)
    setDay(openDays[0] ?? null)
    setSlot(null)
    setStep('horario')
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !service || !slot) return
    setSending(true)
    setFormError('')
    const { error } = await supabase.rpc('book_appointment', {
      p_service_id: service.id,
      p_starts_at: slot,
      p_client_name: name,
      p_client_phone: phone,
    })
    setSending(false)
    if (error) {
      setFormError(errorMessage(error))
      if (error.message === 'horario_indisponivel') {
        setSlot(null)
        setDay((d) => (d ? { ...d } : d)) // recarrega os horários
        setStep('horario')
      }
      return
    }
    setStep('feito')
  }

  function restart() {
    setService(null)
    setDay(null)
    setSlot(null)
    setFormError('')
    setStep('servico')
  }

  const summary =
    service && slot ? `${service.name}, ${longDateFmt.format(new Date(slot))} às ${timeFmt.format(new Date(slot))}` : ''

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Salão</p>
        <h1>Leide Hair</h1>
        <p className="tagline">Agende seu horário em poucos toques</p>
      </header>

      <main className="card">
        {!supabase && (
          <p className="notice">
            O site ainda não está ligado ao banco de dados. Configure <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        )}

        {step === 'servico' && supabase && (
          <section>
            <h2>Escolha o serviço</h2>
            {loading && <p className="muted">Carregando…</p>}
            {loadError && <p className="error">{loadError}</p>}
            <ul className="services">
              {services.map((s) => (
                <li key={s.id}>
                  <button className="service" onClick={() => chooseService(s)}>
                    <span className="service-main">
                      <strong>{s.name}</strong>
                      {s.description && <span className="muted">{s.description}</span>}
                    </span>
                    <span className="service-meta">
                      <strong>{brl.format(s.price_cents / 100)}</strong>
                      <span className="muted">{formatDuration(s.duration_min)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 'horario' && service && (
          <section>
            <button className="back" onClick={restart}>
              ← Serviços
            </button>
            <h2>{service.name}</h2>
            <p className="muted">
              {brl.format(service.price_cents / 100)} · {formatDuration(service.duration_min)}
            </p>
            {formError && <p className="error">{formError}</p>}

            <h3>Dia</h3>
            <div className="days" role="listbox" aria-label="Dia">
              {openDays.map((d) => (
                <button
                  key={d.iso}
                  role="option"
                  aria-selected={day?.iso === d.iso}
                  className={`day ${day?.iso === d.iso ? 'selected' : ''}`}
                  onClick={() => {
                    setDay(d)
                    setSlot(null)
                  }}
                >
                  <span className="day-week">{weekdayFmt.format(d.date).replace('.', '')}</span>
                  <span className="day-num">{dayFmt.format(d.date)}</span>
                </button>
              ))}
            </div>

            <h3>Horário</h3>
            {slots === null && <p className="muted">Buscando horários…</p>}
            {slots?.length === 0 && <p className="muted">Sem horários livres nesse dia. Tente outro.</p>}
            <div className="slots">
              {slots?.map((s) => (
                <button key={s} className={`slot ${slot === s ? 'selected' : ''}`} onClick={() => setSlot(s)}>
                  {timeFmt.format(new Date(s))}
                </button>
              ))}
            </div>

            <button className="primary" disabled={!slot} onClick={() => setStep('dados')}>
              Continuar
            </button>
          </section>
        )}

        {step === 'dados' && service && slot && (
          <section>
            <button className="back" onClick={() => setStep('horario')}>
              ← Horários
            </button>
            <h2>Seus dados</h2>
            <p className="summary">{summary}</p>
            <form onSubmit={confirm}>
              <label>
                Nome
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
              <label>
                WhatsApp
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(11) 98765-4321"
                  required
                />
              </label>
              {formError && <p className="error">{formError}</p>}
              <button className="primary" disabled={sending}>
                {sending ? 'Agendando…' : 'Confirmar agendamento'}
              </button>
            </form>
          </section>
        )}

        {step === 'feito' && (
          <section className="done">
            <div className="check" aria-hidden>
              ✓
            </div>
            <h2>Horário reservado!</h2>
            <p className="summary">{summary}</p>
            <p className="muted">A Leide vai confirmar pelo WhatsApp.</p>
            {SALAO_WHATSAPP && (
              <a
                className="primary link"
                href={`https://wa.me/${SALAO_WHATSAPP}?text=${encodeURIComponent(
                  `Olá! Acabei de agendar pelo site: ${summary}. Meu nome é ${name}.`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Avisar no WhatsApp
              </a>
            )}
            <button className="secondary" onClick={restart}>
              Fazer outro agendamento
            </button>
          </section>
        )}
      </main>

      <footer className="muted">Leide Hair</footer>
    </div>
  )
}
