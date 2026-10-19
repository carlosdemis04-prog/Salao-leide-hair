import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { avisarGoogle, supabase, type BusinessHours, type Service } from './supabase'
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InstagramIcon,
  PinIcon,
  UserIcon,
  WhatsAppIcon,
} from './icons'

const TZ = 'America/Sao_Paulo'
const DAYS_AHEAD = 21
const SALAO_WHATSAPP = (import.meta.env.VITE_SALAO_WHATSAPP as string | undefined) || '5511922297887'
const WHATSAPP_LABEL = '(11) 92229-7887'
const INSTAGRAM = 'leidehair_beauty'
const ENDERECO = 'Rua Silvestre Francisco Puglia, 26'
const BAIRRO = 'Campininha, São Paulo'

// Faixa de serviços enquanto o banco ainda não respondeu
const SERVICOS_FAIXA = ['Corte', 'Escova', 'Hidratação', 'Coloração', 'Luzes', 'Progressiva', 'Manicure e pedicure', 'Sobrancelhas']

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const longDateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' })
const dayNumFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'long', year: 'numeric' })
const hourFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' })
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

const ERROR_MESSAGES: Record<string, string> = {
  horario_indisponivel: 'Esse horário acabou de ser reservado por outra cliente. Escolha outro, por favor.',
  telefone_invalido: 'Confira o WhatsApp: use DDD e número, por exemplo (11) 98765-4321.',
  nome_invalido: 'Escreva seu nome, por favor.',
  servico_invalido: 'Esse serviço não está mais disponível.',
}

const CATEGORIES: { key: string; title: string; match: RegExp }[] = [
  { key: 'cabelo', title: 'Cabelo', match: /corte|escova|hidrata|colora|luzes|progressiva|botox|selagem/i },
  { key: 'unhas', title: 'Unhas', match: /manicure|pedicure|unha/i },
  { key: 'estetica', title: 'Estética', match: /depila|sobrancelha|est[eé]tica/i },
]

type Day = { iso: string; date: Date; weekday: number }
type Step = 'servico' | 'horario' | 'dados' | 'feito'

const STEPS: { key: Step; label: string }[] = [
  { key: 'servico', label: 'Serviço' },
  { key: 'horario', label: 'Data e hora' },
  { key: 'dados', label: 'Seus dados' },
]

function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function formatPrice(cents: number | null) {
  return cents === null ? 'A consultar' : brl.format(cents / 100)
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
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

function googleCalendarLink(service: Service, startIso: string) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + service.duration_min * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${service.name} · Leide Hair`,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: `${ENDERECO}, ${BAIRRO}`,
    details: `Agendado pelo site. Dúvidas: WhatsApp ${WHATSAPP_LABEL}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function hoursLabel(hours: BusinessHours[]) {
  if (hours.length === 0) return ''
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const days = [...new Set(hours.map((h) => h.weekday))].sort()
  // Com pausa de almoço o dia tem duas linhas: vale a abertura mais cedo e o fechamento mais tarde
  const open = hours.map((h) => h.open_time).sort()[0]
  const close = hours.map((h) => h.close_time).sort().at(-1)!
  const t = (s: string) => `${Number(s.slice(0, 2))}h${s.slice(3, 5) === '00' ? '' : s.slice(3, 5)}`
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  const range =
    days.length === 1
      ? names[days[0]]
      : contiguous
        ? `${names[days[0]]} a ${names[days[days.length - 1]]}`
        : days.map((d) => names[d]).join(', ')
  return `${range}, das ${t(open)} às ${t(close)}`
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
      if (s.error || h.error) setLoadError('Não foi possível carregar os serviços. Atualize a página.')
      setServices(s.data ?? [])
      setHours(h.data ?? [])
      setLoading(false)
    })
  }, [])

  const bookingRef = useRef<HTMLElement>(null)
  const [bookingVisible, setBookingVisible] = useState(false)
  useEffect(() => {
    const el = bookingRef.current
    if (!el || !('IntersectionObserver' in window)) {
      setBookingVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setBookingVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const openDays = useMemo(() => {
    const weekdays = new Set(hours.map((h) => h.weekday))
    return upcomingDays().filter((d) => weekdays.has(d.weekday))
  }, [hours])

  const grouped = useMemo(() => {
    const groups = CATEGORIES.map((c) => ({ ...c, items: [] as Service[] }))
    const others: Service[] = []
    for (const s of services) {
      const g = groups.find((c) => c.match.test(s.name))
      if (g) g.items.push(s)
      else others.push(s)
    }
    const result = groups.filter((g) => g.items.length > 0)
    if (others.length) result.push({ key: 'outros', title: 'Outros', match: /./, items: others })
    return result
  }, [services])

  const order = useMemo(() => {
    const m = new Map<string, number>()
    grouped.flatMap((g) => g.items).forEach((s, i) => m.set(s.id, i))
    return m
  }, [grouped])

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

  const slotGroups = useMemo(() => {
    const morning: string[] = []
    const afternoon: string[] = []
    for (const s of slots ?? []) (Number(hourFmt.format(new Date(s))) < 12 ? morning : afternoon).push(s)
    return [
      { title: 'Manhã', items: morning },
      { title: 'Tarde', items: afternoon },
    ].filter((g) => g.items.length > 0)
  }, [slots])

  function goTo(next: Step) {
    setStep(next)
    // No celular o título da agenda fica em cima do painel; pula direto para as etapas
    const target = (window.innerWidth < 960 && document.querySelector('.stepper')) || document.getElementById('agendar')
    const top = (target?.getBoundingClientRect().top ?? 0) + window.scrollY - 24
    window.scrollTo({ top, behavior: 'smooth' })
  }

  function chooseService(s: Service) {
    setService(s)
    setDay((d) => d ?? openDays[0] ?? null)
    setSlot(null)
    setFormError('')
    goTo('horario')
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
        goTo('horario')
      }
      return
    }
    avisarGoogle()
    goTo('feito')
  }

  function restart() {
    setService(null)
    setSlot(null)
    setFormError('')
    goTo('servico')
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const slotDate = slot ? new Date(slot) : null
  const whatsappText =
    service && slotDate
      ? `Olá! Acabei de agendar pelo site: ${service.name}, ${longDateFmt.format(slotDate)} às ${timeFmt.format(slotDate)}. Meu nome é ${name}.`
      : 'Olá! Gostaria de agendar um horário.'

  return (
    <>
      <header className="hero">
        <nav className="topbar">
          <a href="#" className="topbar-brand" aria-label="Leide Hair, início">
            <img src="/logo.webp" alt="" width="720" height="619" />
          </a>
          <a className="topbar-link" href="#agendar">
            Agendar horário
          </a>
        </nav>

        {/* A cena abre como uma tela de cinema: uma fresta que se alarga até o quadro inteiro */}
        <div className="hero-frame" aria-hidden>
          <img src="/logo.webp" alt="" width="720" height="619" />
        </div>

        <div className="hero-copy">
          <h1 className="hero-title">Leide Hair</h1>
          <p className="hero-sub">Salão de beleza em Campininha, São Paulo. Cabelo, unhas e estética com hora marcada.</p>
          <div className="hero-actions">
            <a className="btn btn-gold" href="#agendar">
              Agendar horário
            </a>
            <a className="btn btn-outline-light" href={`https://wa.me/${SALAO_WHATSAPP}`} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      <div className="faixa" aria-label="Serviços do salão">
        {/* Duas cópias iguais: a animação anda metade da largura e recomeça sem emenda */}
        <div className="faixa-trilho">
          {[0, 1].map((copy) => (
            <ul key={copy} className="faixa-lista" aria-hidden={copy === 1}>
              {(services.length ? services.map((s) => s.name) : SERVICOS_FAIXA).map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <main className={`booking ${bookingVisible ? 'in' : ''}`} id="agendar" ref={bookingRef}>
        <div className="booking-side">
          <h2 className="booking-title">Agende seu horário</h2>
          <p className="booking-lead">
            {hours.length > 0 ? `${hoursLabel(hours)}. ` : ''}A Leide confirma cada reserva pelo WhatsApp.
          </p>
          {step !== 'feito' && (
            <ol className="stepper" aria-label="Etapas do agendamento">
              {STEPS.map((s, i) => (
                <li key={s.key} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>
                  <span className="stepper-dot">{i < stepIndex ? <CheckIcon /> : i + 1}</span>
                  <span className="stepper-label">{s.label}</span>
                </li>
              ))}
            </ol>
          )}
          {service && step !== 'servico' && step !== 'feito' && (
            <aside className="summary" aria-label="Resumo">
              <div className="summary-row">
                <span className="summary-name">{service.name}</span>
                <span className="summary-price">{formatPrice(service.price_cents)}</span>
              </div>
              <div className="summary-meta">
                <span>
                  <ClockIcon /> {formatDuration(service.duration_min)}
                </span>
                {slotDate && (
                  <span>
                    <CalendarIcon /> {capitalize(weekdayFmt.format(slotDate).replace('.', ''))},{' '}
                    {dayNumFmt.format(slotDate)} às {timeFmt.format(slotDate)}
                  </span>
                )}
              </div>
            </aside>
          )}
        </div>

        <section className="panel" key={step}>
            {!supabase && (
              <p className="notice">
                O site ainda não está ligado ao banco de dados. Configure <code>VITE_SUPABASE_URL</code> e{' '}
                <code>VITE_SUPABASE_ANON_KEY</code>.
              </p>
            )}

            {step === 'servico' && supabase && (
              <>
                <div className="panel-head">
                  <h2>Escolha o serviço</h2>
                  <p className="muted">Toque em um serviço para ver os horários livres.</p>
                </div>
                {loading && (
                  <div className="skeleton-list" aria-label="Carregando serviços">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton" />
                    ))}
                  </div>
                )}
                {loadError && <p className="error">{loadError}</p>}
                {grouped.map((g) => (
                  <div key={g.key} className="category">
                    <h3 className="category-title">{g.title}</h3>
                    <ul className="services">
                      {g.items.map((s) => (
                        <li key={s.id} className="stagger" style={{ '--i': order.get(s.id) ?? 0 } as CSSProperties}>
                          <button className="service" onClick={() => chooseService(s)}>
                            <span className="service-main">
                              <span className="service-name">{s.name}</span>
                              {s.description && <span className="service-desc">{s.description}</span>}
                              <span className="service-meta">
                                <span className="service-duration">
                                  <ClockIcon /> {formatDuration(s.duration_min)}
                                </span>
                                <span className="service-price">{formatPrice(s.price_cents)}</span>
                              </span>
                            </span>
                            <ChevronRightIcon className="service-chevron" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}

            {step === 'horario' && service && (
              <>
                <div className="panel-head">
                  <button className="back" onClick={restart}>
                    <ChevronLeftIcon /> Trocar serviço
                  </button>
                  <h2>Escolha o dia e o horário</h2>
                </div>
                {formError && <p className="error">{formError}</p>}

                <div className="field-label">
                  <CalendarIcon /> {day ? capitalize(monthFmt.format(day.date)) : 'Dia'}
                </div>
                <div className="days" role="listbox" aria-label="Dia">
                  {openDays.map((d) => {
                    const selected = day?.iso === d.iso
                    return (
                      <button
                        key={d.iso}
                        role="option"
                        aria-selected={selected}
                        className={`day ${selected ? 'selected' : ''}`}
                        onClick={() => {
                          setDay(d)
                          setSlot(null)
                        }}
                      >
                        <span className="day-week">{weekdayFmt.format(d.date).replace('.', '')}</span>
                        <span className="day-num">{dayNumFmt.format(d.date)}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="field-label">
                  <ClockIcon /> Horários livres
                </div>
                {slots === null && (
                  <div className="slots">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="skeleton slot-skeleton" />
                    ))}
                  </div>
                )}
                {slots?.length === 0 && (
                  <p className="empty">Nenhum horário livre nesse dia. Que tal escolher outro?</p>
                )}
                {slotGroups.map((g, gi) => (
                  <div key={g.title} className="slot-group">
                    <span className="slot-group-title">{g.title}</span>
                    <div className="slots">
                      {g.items.map((s, si) => (
                        <button
                          key={s}
                          style={{ '--i': gi * 6 + si } as CSSProperties}
                          className={`slot stagger ${slot === s ? 'selected' : ''}`}
                          aria-pressed={slot === s}
                          onClick={() => setSlot(s)}
                        >
                          {timeFmt.format(new Date(s))}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="actions">
                  <button className="btn btn-primary" disabled={!slot} onClick={() => goTo('dados')}>
                    Continuar
                  </button>
                </div>
              </>
            )}

            {step === 'dados' && service && slotDate && (
              <>
                <div className="panel-head">
                  <button className="back" onClick={() => goTo('horario')}>
                    <ChevronLeftIcon /> Trocar horário
                  </button>
                  <h2>Seus dados</h2>
                  <p className="muted">Usamos só para confirmar o seu horário pelo WhatsApp.</p>
                </div>
                <form onSubmit={confirm} className="form">
                  <label className="input">
                    <span>Nome</span>
                    <div className="input-wrap">
                      <UserIcon />
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Seu nome"
                        required
                      />
                    </div>
                  </label>
                  <label className="input">
                    <span>WhatsApp</span>
                    <div className="input-wrap">
                      <WhatsAppIcon />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 98765-4321"
                        required
                      />
                    </div>
                  </label>
                  {formError && <p className="error">{formError}</p>}
                  <div className="actions">
                    <button className="btn btn-primary" disabled={sending}>
                      {sending ? 'Reservando…' : 'Confirmar agendamento'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === 'feito' && service && slotDate && (
              <div className="done">
                <div className="done-check">
                  <CheckIcon />
                </div>
                <h2>Horário reservado</h2>
                <p className="muted">
                  Obrigada, {name.split(' ')[0]}. A Leide vai confirmar pelo WhatsApp.
                </p>
                <dl className="ticket">
                  <div>
                    <dt>Serviço</dt>
                    <dd>{service.name}</dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>{capitalize(longDateFmt.format(slotDate))}</dd>
                  </div>
                  <div>
                    <dt>Horário</dt>
                    <dd>{timeFmt.format(slotDate)}</dd>
                  </div>
                  <div>
                    <dt>Local</dt>
                    <dd>{ENDERECO}</dd>
                  </div>
                </dl>
                <div className="actions stacked">
                  <a
                    className="btn btn-primary"
                    href={`https://wa.me/${SALAO_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon /> Avisar no WhatsApp
                  </a>
                  <a className="btn btn-ghost" href={googleCalendarLink(service, slot!)} target="_blank" rel="noreferrer">
                    <CalendarIcon /> Salvar na minha agenda
                  </a>
                  <button className="btn btn-link" onClick={restart}>
                    Fazer outro agendamento
                  </button>
                </div>
              </div>
            )}
          </section>

      </main>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <span className="footer-title">Endereço</span>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(`${ENDERECO}, ${BAIRRO}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <PinIcon />
              <span>
                {ENDERECO}
                <br />
                {BAIRRO}
              </span>
            </a>
          </div>
          {hours.length > 0 && (
            <div>
              <span className="footer-title">Horário</span>
              <span>
                <ClockIcon /> {hoursLabel(hours)}
              </span>
            </div>
          )}
          <div>
            <span className="footer-title">Contato</span>
            <a href={`https://wa.me/${SALAO_WHATSAPP}`} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> {WHATSAPP_LABEL}
            </a>
            <a href={`https://instagram.com/${INSTAGRAM}`} target="_blank" rel="noreferrer">
              <InstagramIcon /> @{INSTAGRAM}
            </a>
          </div>
        </div>
        <p className="footer-wordmark" aria-hidden>
          Leide Hair
        </p>
        <p className="footer-copy">© {new Date().getFullYear()} Leide Hair</p>
      </footer>
    </>
  )
}
