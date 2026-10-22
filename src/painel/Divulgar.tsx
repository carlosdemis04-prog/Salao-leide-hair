import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { CheckIcon, SparkleIcon, WhatsAppIcon } from '../icons'
import { carregarNumeros, resumoParaAssistente, type Numeros } from './dados'
import {
  brl,
  capitalize,
  centsToInput,
  dayTitleFmt,
  dbError,
  inputToCents,
  isoDateFmt,
  timeFmt,
  todayIso,
  type AdminService,
} from './util'

type Oferta = {
  id: string
  title: string
  description: string | null
  conditions: string | null
  price_cents: number | null
  original_price_cents: number | null
  valid_until: string | null
  active: boolean
}

type Evento = {
  id: string
  title: string
  description: string | null
  starts_at: string | null
  ends_at: string | null
  location: string | null
  spots: number | null
  active: boolean
}

// O que o assistente devolve (mesmo formato de worker/assistente.js)
type Rascunho = {
  tipo: 'oferta' | 'evento'
  titulo: string
  descricao: string
  condicoes: string | null
  preco_reais: number | null
  preco_original_reais: number | null
  valido_ate: string | null
  inicio: string | null
  fim: string | null
  local: string | null
  vagas: number | null
  texto_divulgacao: string
}

type Msg = { role: 'user' | 'assistant'; content: string; rascunhos?: Rascunho[] }

const GUARDA = 'pn-assistente'
const IDEIAS = [
  'Crie uma promoção para o dia mais vazio da semana',
  'Monte um evento especial para o fim do ano',
  'Escreva uma mensagem para chamar de volta as clientes sumidas',
  'Como foi o meu mês?',
]

const ERROS: Record<string, string> = {
  sem_chave: 'O assistente ainda não foi ligado. O Carlos precisa colocar a chave na Cloudflare (passo a passo no README).',
  chave_invalida: 'A chave do assistente na Cloudflare não está funcionando. Peça para o Carlos conferir.',
  sem_acesso: 'Sua sessão expirou. Saia e entre de novo no painel.',
  ocupado: 'O assistente está ocupado agora. Tente de novo em um minuto.',
}

const reais = (c: number) => brl.format(c / 100)
const paraCentavos = (r: number | null) => (r === null || !Number.isFinite(r) || r < 0 ? null : Math.round(r * 100))

// Data e hora de São Paulo no formato do campo "datetime-local" (AAAA-MM-DDTHH:MM)
function paraCampo(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${isoDateFmt.format(d)}T${timeFmt.format(d)}`
}
const doCampo = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null)
const valido = (v: string | null, re: RegExp) => (v && re.test(v) ? v : '')

function lerConversa(): Msg[] {
  try {
    const m = JSON.parse(localStorage.getItem(GUARDA) ?? '[]')
    return Array.isArray(m) ? m.slice(-30) : []
  } catch {
    return []
  }
}

function guardarConversa(m: Msg[]) {
  try {
    localStorage.setItem(GUARDA, JSON.stringify(m.slice(-30)))
  } catch {
    // sem espaço ou modo privado: a conversa só não fica guardada
  }
}

function quandoEvento(e: { starts_at: string | null; ends_at: string | null }) {
  if (!e.starts_at) return 'Sem data: fica sempre no app'
  const s = new Date(e.starts_at)
  const fim = e.ends_at ? ` até ${timeFmt.format(new Date(e.ends_at))}` : ''
  return `${capitalize(dayTitleFmt.format(s))}, ${timeFmt.format(s)}${fim}`
}

export default function Divulgar({ services }: { services: AdminService[] }) {
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null)
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [numeros, setNumeros] = useState<Numeros | null>(null)
  const [editando, setEditando] = useState<
    { tipo: 'oferta'; valor: Partial<Oferta> } | { tipo: 'evento'; valor: Partial<Evento> } | null
  >(null)
  const [formN, setFormN] = useState(0)
  const formRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [o, e] = await Promise.all([
      supabase!
        .from('offers')
        .select('id, title, description, conditions, price_cents, original_price_cents, valid_until, active')
        .order('created_at', { ascending: false }),
      supabase!
        .from('events')
        .select('id, title, description, starts_at, ends_at, location, spots, active')
        .order('starts_at', { ascending: false, nullsFirst: true }),
    ])
    setOfertas((o.data as Oferta[]) ?? [])
    setEventos((e.data as Evento[]) ?? [])
  }, [])

  useEffect(() => {
    load()
    carregarNumeros().then(setNumeros, () => {})
  }, [load])

  function editar(x: NonNullable<typeof editando>) {
    setEditando(x)
    setFormN((n) => n + 1)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function deRascunho(r: Rascunho) {
    if (r.tipo === 'oferta')
      editar({
        tipo: 'oferta',
        valor: {
          title: r.titulo,
          description: r.descricao,
          conditions: r.condicoes,
          price_cents: paraCentavos(r.preco_reais),
          original_price_cents: paraCentavos(r.preco_original_reais),
          valid_until: valido(r.valido_ate, /^\d{4}-\d{2}-\d{2}$/) || null,
          active: true,
        },
      })
    else
      editar({
        tipo: 'evento',
        valor: {
          title: r.titulo,
          description: r.descricao,
          starts_at: doCampo(valido(r.inicio, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
          ends_at: doCampo(valido(r.fim, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
          location: r.local,
          spots: r.vagas,
          active: true,
        },
      })
  }

  const hoje = todayIso()
  const situacaoOferta = (o: Oferta) =>
    !o.active ? 'Escondida' : o.valid_until && o.valid_until < hoje ? 'Vencida' : 'No app'
  const situacaoEvento = (e: Evento) =>
    !e.active ? 'Escondido' : e.starts_at && new Date(e.ends_at ?? e.starts_at) < new Date() ? 'Já passou' : 'No app'

  async function alternar(tabela: 'offers' | 'events', id: string, active: boolean) {
    await supabase!.from(tabela).update({ active }).eq('id', id)
    load()
  }

  async function apagar(tabela: 'offers' | 'events', id: string, titulo: string) {
    if (!window.confirm(`Apagar "${titulo}" de vez?`)) return
    await supabase!.from(tabela).delete().eq('id', id)
    load()
  }

  return (
    <>
      <Assistente services={services} numeros={numeros} onPublicado={load} onAjustar={deRascunho} />

      <div ref={formRef}>
        {editando?.tipo === 'oferta' && (
          <OfertaForm
            key={formN}
            inicial={editando.valor}
            onDone={() => {
              setEditando(null)
              load()
            }}
          />
        )}
        {editando?.tipo === 'evento' && (
          <EventoForm
            key={formN}
            inicial={editando.valor}
            onDone={() => {
              setEditando(null)
              load()
            }}
          />
        )}
      </div>

      <section className="pn-section">
        <h2>Ofertas no app</h2>
        <p className="pn-muted">Aparecem na aba Ofertas do app enquanto estiverem ligadas e dentro da validade.</p>
        {ofertas?.length === 0 && <p className="pn-empty">Nenhuma oferta ainda.</p>}
        <ul className="pn-list">
          {ofertas?.map((o) => (
            <li key={o.id} className={`pn-card pn-service ${situacaoOferta(o) === 'No app' ? '' : 'off'}`}>
              <div className="pn-service-head">
                <span className="pn-card-service">{o.title}</span>
                <span className={`pn-badge ${situacaoOferta(o) === 'No app' ? 'b-confirmado' : ''}`}>{situacaoOferta(o)}</span>
              </div>
              {o.description && <span className="pn-card-client">{o.description}</span>}
              <span className="pn-muted-inline">
                {o.price_cents !== null && `${reais(o.price_cents)}`}
                {o.original_price_cents !== null && ` (de ${reais(o.original_price_cents)})`}
                {o.valid_until && ` · até ${o.valid_until.split('-').reverse().join('/')}`}
              </span>
              <div className="pn-card-actions">
                <button className="pn-btn" onClick={() => editar({ tipo: 'oferta', valor: o })}>
                  Editar
                </button>
                <button className="pn-btn pn-btn-quiet" onClick={() => alternar('offers', o.id, !o.active)}>
                  {o.active ? 'Esconder' : 'Mostrar no app'}
                </button>
                <button className="pn-btn pn-btn-quiet" onClick={() => apagar('offers', o.id, o.title)}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button className="pn-chip pn-chip-dark pn-mt" onClick={() => editar({ tipo: 'oferta', valor: { active: true } })}>
          Nova oferta sem o assistente
        </button>
      </section>

      <section className="pn-section">
        <h2>Eventos no app</h2>
        <p className="pn-muted">Dias especiais, workshops e campanhas. A inscrição é pelo WhatsApp.</p>
        {eventos?.length === 0 && <p className="pn-empty">Nenhum evento ainda.</p>}
        <ul className="pn-list">
          {eventos?.map((e) => (
            <li key={e.id} className={`pn-card pn-service ${situacaoEvento(e) === 'No app' ? '' : 'off'}`}>
              <div className="pn-service-head">
                <span className="pn-card-service">{e.title}</span>
                <span className={`pn-badge ${situacaoEvento(e) === 'No app' ? 'b-confirmado' : ''}`}>{situacaoEvento(e)}</span>
              </div>
              <span className="pn-card-client">{quandoEvento(e)}</span>
              {e.location && <span className="pn-muted-inline">{e.location}</span>}
              <div className="pn-card-actions">
                <button className="pn-btn" onClick={() => editar({ tipo: 'evento', valor: e })}>
                  Editar
                </button>
                <button className="pn-btn pn-btn-quiet" onClick={() => alternar('events', e.id, !e.active)}>
                  {e.active ? 'Esconder' : 'Mostrar no app'}
                </button>
                <button className="pn-btn pn-btn-quiet" onClick={() => apagar('events', e.id, e.title)}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button className="pn-chip pn-chip-dark pn-mt" onClick={() => editar({ tipo: 'evento', valor: { active: true } })}>
          Novo evento sem o assistente
        </button>
      </section>
    </>
  )
}

/* ---------------- Assistente ---------------- */

function Assistente({
  services,
  numeros,
  onPublicado,
  onAjustar,
}: {
  services: AdminService[]
  numeros: Numeros | null
  onPublicado: () => void
  onAjustar: (r: Rascunho) => void
}) {
  const [msgs, setMsgs] = useState<Msg[]>(lerConversa)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    guardarConversa(msgs)
    fim.current?.scrollIntoView({ block: 'nearest' })
  }, [msgs])

  async function enviar(pergunta: string) {
    const p = pergunta.trim()
    if (!p || pensando) return
    setErro('')
    const nova: Msg[] = [...msgs, { role: 'user', content: p }]
    setMsgs(nova)
    setTexto('')
    setPensando(true)

    const contexto = [
      resumoParaAssistente(numeros),
      'Serviços (preço vazio = a consultar):',
      ...services
        .filter((s) => s.active)
        .map((s) => `- ${s.name}: ${s.price_cents === null ? 'a consultar' : reais(s.price_cents)}, ${s.duration_min} min`),
    ].join('\n')

    try {
      const { data } = await supabase!.auth.getSession()
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({
          contexto,
          // Os rascunhos já criados vão como texto, para ela poder pedir "muda o preço"
          mensagens: nova.map((m) => ({
            role: m.role,
            content: m.rascunhos?.length ? `${m.content}\n\nRascunhos criados: ${JSON.stringify(m.rascunhos)}` : m.content,
          })),
        }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.erro ?? 'falhou')
      setMsgs([...nova, { role: 'assistant', content: r.resposta, rascunhos: r.rascunhos }])
    } catch (e) {
      const codigo = e instanceof Error ? e.message : ''
      setErro(ERROS[codigo] ?? 'Não consegui responder agora. Confira a internet e tente de novo.')
      setMsgs(msgs)
      setTexto(p)
    }
    setPensando(false)
  }

  return (
    <section className="pn-section">
      <h2>Assistente</h2>
      <p className="pn-muted">
        Peça uma promoção ou um evento com suas palavras. Ele escreve tudo, inclusive o texto para WhatsApp e Instagram, e
        você confere antes de publicar.
      </p>

      <div className="pn-chat">
        {msgs.length === 0 && (
          <div className="pn-ideias">
            {IDEIAS.map((i) => (
              <button key={i} className="pn-chip" onClick={() => enviar(i)}>
                <SparkleIcon /> {i}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`pn-bolha ${m.role === 'user' ? 'eu' : 'ela'}`}>
            <p>{m.content}</p>
            {m.rascunhos?.map((r, j) => (
              <RascunhoCard key={j} r={r} onPublicado={onPublicado} onAjustar={() => onAjustar(r)} />
            ))}
          </div>
        ))}
        {pensando && (
          <div className="pn-bolha ela pn-pensando" aria-live="polite">
            <p>Pensando…</p>
          </div>
        )}
        <div ref={fim} />
      </div>

      {erro && <p className="pn-error">{erro}</p>}
      <form
        className="pn-chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          enviar(texto)
        }}
      >
        <label className="pn-field">
          <span className="sr-only">Mensagem para o assistente</span>
          <textarea
            rows={2}
            value={texto}
            placeholder="Ex.: promoção de escova para terça e quarta"
            maxLength={2000}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(texto)
              }
            }}
          />
        </label>
        <button className="btn btn-primary" disabled={pensando || !texto.trim()}>
          Enviar
        </button>
      </form>
      {msgs.length > 0 && (
        <button className="pn-link-dark" onClick={() => setMsgs([])} disabled={pensando}>
          Começar conversa nova
        </button>
      )}
    </section>
  )
}

function RascunhoCard({ r, onPublicado, onAjustar }: { r: Rascunho; onPublicado: () => void; onAjustar: () => void }) {
  const [estado, setEstado] = useState<'' | 'publicando' | 'publicado' | string>('')
  const [copiado, setCopiado] = useState(false)
  const inicio = valido(r.inicio, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  const fim = valido(r.fim, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  const validade = valido(r.valido_ate, /^\d{4}-\d{2}-\d{2}$/)

  async function publicar() {
    setEstado('publicando')
    const { error } =
      r.tipo === 'oferta'
        ? await supabase!.from('offers').insert({
            title: r.titulo,
            description: r.descricao || null,
            conditions: r.condicoes,
            price_cents: paraCentavos(r.preco_reais),
            original_price_cents: paraCentavos(r.preco_original_reais),
            valid_until: validade || null,
          })
        : await supabase!.from('events').insert({
            title: r.titulo,
            description: r.descricao || null,
            starts_at: doCampo(inicio),
            ends_at: inicio ? doCampo(fim) : null,
            location: r.local,
            spots: r.vagas,
          })
    if (error) return setEstado(dbError(error))
    setEstado('publicado')
    onPublicado()
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(r.texto_divulgacao)
      setCopiado(true)
    } catch {
      window.prompt('Copie o texto:', r.texto_divulgacao)
    }
  }

  const preco = paraCentavos(r.preco_reais)
  const original = paraCentavos(r.preco_original_reais)

  return (
    <div className="pn-rascunho">
      <span className="pn-rascunho-tipo">{r.tipo === 'oferta' ? 'Rascunho de oferta' : 'Rascunho de evento'}</span>
      <strong className="pn-card-service">{r.titulo}</strong>
      {r.descricao && <p>{r.descricao}</p>}
      {r.tipo === 'oferta' ? (
        <p className="pn-muted-inline">
          {preco !== null ? reais(preco) : 'Sem preço'}
          {original !== null && ` (de ${reais(original)})`}
          {validade && ` · até ${validade.split('-').reverse().join('/')}`}
          {r.condicoes && ` · ${r.condicoes}`}
        </p>
      ) : (
        <p className="pn-muted-inline">
          {quandoEvento({ starts_at: doCampo(inicio), ends_at: inicio ? doCampo(fim) : null })}
          {r.local && ` · ${r.local}`}
          {r.vagas !== null && ` · ${r.vagas} vagas`}
        </p>
      )}
      {r.texto_divulgacao && <blockquote>{r.texto_divulgacao}</blockquote>}
      <div className="pn-card-actions">
        {estado === 'publicado' ? (
          <span className="pn-ok">
            <CheckIcon /> Publicado no app
          </span>
        ) : (
          <button className="pn-btn pn-btn-dark" onClick={publicar} disabled={estado === 'publicando'}>
            {estado === 'publicando' ? 'Publicando…' : 'Publicar no app'}
          </button>
        )}
        {estado !== 'publicado' && (
          <button className="pn-btn" onClick={onAjustar}>
            Ajustar antes
          </button>
        )}
        {r.texto_divulgacao && (
          <>
            <button className="pn-btn pn-btn-quiet" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar texto'}
            </button>
            <a
              className="pn-btn pn-btn-quiet"
              href={`https://wa.me/?text=${encodeURIComponent(r.texto_divulgacao)}`}
              target="_blank"
              rel="noreferrer"
            >
              <WhatsAppIcon /> Enviar
            </a>
          </>
        )}
      </div>
      {estado && estado !== 'publicado' && estado !== 'publicando' && <p className="pn-error">{estado}</p>}
    </div>
  )
}

/* ---------------- Formulários ---------------- */

function OfertaForm({ inicial, onDone }: { inicial: Partial<Oferta>; onDone: () => void }) {
  const [title, setTitle] = useState(inicial.title ?? '')
  const [description, setDescription] = useState(inicial.description ?? '')
  const [conditions, setConditions] = useState(inicial.conditions ?? '')
  const [price, setPrice] = useState(centsToInput(inicial.price_cents ?? null))
  const [original, setOriginal] = useState(centsToInput(inicial.original_price_cents ?? null))
  const [validUntil, setValidUntil] = useState(inicial.valid_until ?? '')
  const [active, setActive] = useState(inicial.active ?? true)
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const p = inputToCents(price)
    const o = inputToCents(original)
    if (p === 'erro' || o === 'erro') return setErro('Preço inválido. Use, por exemplo, 60 ou 59,90.')
    const linha = {
      title: title.trim(),
      description: description.trim() || null,
      conditions: conditions.trim() || null,
      price_cents: p,
      original_price_cents: o,
      valid_until: validUntil || null,
      active,
    }
    const { error } = inicial.id
      ? await supabase!.from('offers').update(linha).eq('id', inicial.id)
      : await supabase!.from('offers').insert(linha)
    if (error) return setErro(dbError(error))
    onDone()
  }

  return (
    <section className="pn-section">
      <form className="pn-form pn-box" onSubmit={salvar}>
        <h3>{inicial.id ? 'Editar oferta' : 'Nova oferta'}</h3>
        <label className="pn-field">
          <span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={80} required />
        </label>
        <label className="pn-field">
          <span>Descrição</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="pn-grid2">
          <label className="pn-field">
            <span>Preço da oferta (R$)</span>
            <input inputMode="decimal" value={price} placeholder="Opcional" onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="pn-field">
            <span>Preço normal (R$)</span>
            <input inputMode="decimal" value={original} placeholder="Opcional" onChange={(e) => setOriginal(e.target.value)} />
          </label>
        </div>
        <label className="pn-field">
          <span>Condições</span>
          <input value={conditions} placeholder="Ex.: válido de terça a quinta" onChange={(e) => setConditions(e.target.value)} />
        </label>
        <label className="pn-field">
          <span>Vale até (deixe vazio se não tiver fim)</span>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
        <label className="pn-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Mostrar no app</span>
        </label>
        {erro && <p className="pn-error">{erro}</p>}
        <div className="pn-save">
          <button className="btn btn-primary">{inicial.id ? 'Salvar' : 'Publicar oferta'}</button>
          <button type="button" className="pn-link-dark" onClick={onDone}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}

function EventoForm({ inicial, onDone }: { inicial: Partial<Evento>; onDone: () => void }) {
  const [title, setTitle] = useState(inicial.title ?? '')
  const [description, setDescription] = useState(inicial.description ?? '')
  const [semData, setSemData] = useState(inicial.id ? !inicial.starts_at : false)
  const [inicio, setInicio] = useState(paraCampo(inicial.starts_at ?? null))
  const [fim, setFim] = useState(paraCampo(inicial.ends_at ?? null))
  const [location, setLocation] = useState(inicial.location ?? '')
  const [spots, setSpots] = useState(inicial.spots?.toString() ?? '')
  const [active, setActive] = useState(inicial.active ?? true)
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!semData && !inicio) return setErro('Escolha o dia e a hora, ou marque "Sem data".')
    if (!semData && fim && fim <= inicio) return setErro('O fim precisa ser depois do início.')
    const vagas = spots.trim() ? Number(spots) : null
    if (vagas !== null && (!Number.isInteger(vagas) || vagas < 0)) return setErro('Vagas precisa ser um número inteiro.')
    const linha = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: semData ? null : doCampo(inicio),
      ends_at: semData ? null : doCampo(fim),
      location: location.trim() || null,
      spots: vagas,
      active,
    }
    const { error } = inicial.id
      ? await supabase!.from('events').update(linha).eq('id', inicial.id)
      : await supabase!.from('events').insert(linha)
    if (error) return setErro(dbError(error))
    onDone()
  }

  return (
    <section className="pn-section">
      <form className="pn-form pn-box" onSubmit={salvar}>
        <h3>{inicial.id ? 'Editar evento' : 'Novo evento'}</h3>
        <label className="pn-field">
          <span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={80} required />
        </label>
        <label className="pn-field">
          <span>Descrição</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="pn-check">
          <input type="checkbox" checked={semData} onChange={(e) => setSemData(e.target.checked)} />
          <span>Sem data (fica sempre no app)</span>
        </label>
        {!semData && (
          <div className="pn-grid2">
            <label className="pn-field">
              <span>Começa</span>
              <input type="datetime-local" step={900} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </label>
            <label className="pn-field">
              <span>Termina (opcional)</span>
              <input type="datetime-local" step={900} value={fim} onChange={(e) => setFim(e.target.value)} />
            </label>
          </div>
        )}
        <div className="pn-grid2">
          <label className="pn-field">
            <span>Local</span>
            <input value={location} placeholder="No salão" onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="pn-field">
            <span>Vagas</span>
            <input inputMode="numeric" value={spots} placeholder="Sem limite" onChange={(e) => setSpots(e.target.value)} />
          </label>
        </div>
        <label className="pn-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Mostrar no app</span>
        </label>
        {erro && <p className="pn-error">{erro}</p>}
        <div className="pn-save">
          <button className="btn btn-primary">{inicial.id ? 'Salvar' : 'Publicar evento'}</button>
          <button type="button" className="pn-link-dark" onClick={onDone}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
