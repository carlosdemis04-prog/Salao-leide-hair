import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { ChevronLeftIcon, WhatsAppIcon } from '../icons'
import { diaDe, valorDe, type Cliente, type Visita } from './dados'
import { addDays, brl, capitalize, dbError, formatPhone, shortDateFmt, todayIso, whatsappLink } from './util'

const ORIGENS = ['Instagram', 'Indicação de amiga', 'Passou na frente', 'Google', 'WhatsApp', 'Outro']

type Filtro = 'todas' | 'sumidas' | 'aniversario' | 'fieis' | 'novas'
const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'sumidas', label: 'Sumidas' },
  { key: 'aniversario', label: 'Aniversário no mês' },
  { key: 'fieis', label: 'Mais fiéis' },
  { key: 'novas', label: 'Novas' },
]

type Ficha = Cliente & {
  visitas: Visita[]
  vezes: number
  gasto: number
  ultima: string | null
  proxima: string | null
  pontos: number
}

const reais = (c: number) => brl.format(c / 100)
const dataCurta = (dia: string) => capitalize(shortDateFmt.format(new Date(`${dia}T12:00:00-03:00`)).replace(/\./g, ''))
const pontosDe = (phone: string) => phone.replace(/\D/g, '').slice(-11)

function diasDesde(dia: string, hoje: string) {
  return Math.round((new Date(`${hoje}T12:00:00Z`).getTime() - new Date(`${dia}T12:00:00Z`).getTime()) / 86_400_000)
}

function haQuanto(dia: string, hoje: string) {
  const n = diasDesde(dia, hoje)
  return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`
}

export default function Clientes() {
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [aberta, setAberta] = useState<string | null>(null)
  const [nova, setNova] = useState(false)
  const hoje = todayIso()

  const load = useCallback(async () => {
    const [c, a, p] = await Promise.all([
      supabase!.from('clients').select('phone, name, birthday, origin, notes, created_at').order('name'),
      supabase!
        .from('appointments')
        .select('id, starts_at, created_at, status, client_name, client_phone, amount_cents, payment_method, service:services(name, price_cents)')
        .order('starts_at', { ascending: false })
        .limit(5000),
      supabase!.from('lady_pontos').select('phone, pontos'),
    ])
    if (c.error) {
      setErro('Não foi possível carregar as clientes. (Já rodou o arquivo 0009 no Supabase?)')
      setFichas([])
      return
    }
    const visitas = (a.data as unknown as Visita[]) ?? []
    const pontos = new Map<string, number>()
    for (const l of (p.data as { phone: string; pontos: number }[]) ?? []) pontos.set(l.phone, (pontos.get(l.phone) ?? 0) + l.pontos)
    const hojeIso = todayIso()
    setFichas(
      ((c.data as Cliente[]) ?? []).map((cl) => {
        const vs = visitas.filter((v) => v.client_phone === cl.phone)
        const feitas = vs.filter((v) => v.status === 'concluido')
        const futuras = vs
          .filter((v) => (v.status === 'pendente' || v.status === 'confirmado') && diaDe(v.starts_at) >= hojeIso)
          .map((v) => diaDe(v.starts_at))
          .sort()
        return {
          ...cl,
          visitas: vs,
          vezes: feitas.length,
          gasto: feitas.reduce((s, v) => s + valorDe(v), 0),
          ultima: feitas.length ? diaDe(feitas[0].starts_at) : null,
          proxima: futuras[0] ?? null,
          pontos: pontos.get(pontosDe(cl.phone)) ?? 0,
        }
      }),
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const lista = useMemo(() => {
    if (!fichas) return []
    const mes = hoje.slice(5, 7)
    const termo = busca.trim().toLowerCase()
    const digitos = busca.replace(/\D/g, '')
    let l = fichas.filter(
      (f) => !termo || f.name.toLowerCase().includes(termo) || (digitos.length >= 3 && f.phone.includes(digitos)),
    )
    if (filtro === 'sumidas') l = l.filter((f) => f.ultima && !f.proxima && diasDesde(f.ultima, hoje) > 60)
    if (filtro === 'aniversario') l = l.filter((f) => f.birthday?.slice(5, 7) === mes).sort((a, b) => a.birthday!.localeCompare(b.birthday!))
    if (filtro === 'fieis') l = [...l].filter((f) => f.vezes > 0).sort((a, b) => b.vezes - a.vezes || b.gasto - a.gasto).slice(0, 20)
    if (filtro === 'novas') l = l.filter((f) => diaDe(f.created_at) >= addDays(hoje, -30))
    return l
  }, [fichas, busca, filtro, hoje])

  const ficha = fichas?.find((f) => f.phone === aberta)
  if (ficha) return <FichaCliente f={ficha} hoje={hoje} voltar={() => setAberta(null)} reload={load} />

  function baixar() {
    if (!fichas) return
    const linhas = [
      ['Nome', 'WhatsApp', 'Aniversário', 'Como conheceu', 'Atendimentos', 'Total gasto (R$)', 'Última visita', 'Anotações'],
      ...fichas.map((f) => [
        f.name,
        formatPhone(f.phone),
        f.birthday ? `${f.birthday.slice(8, 10)}/${f.birthday.slice(5, 7)}` : '',
        f.origin ?? '',
        String(f.vezes),
        (f.gasto / 100).toFixed(2).replace('.', ','),
        f.ultima ? f.ultima.split('-').reverse().join('/') : '',
        f.notes ?? '',
      ]),
    ]
    const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `clientes-leide-hair-${hoje}.csv` })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="pn-section">
      <h2>Clientes</h2>
      <p className="pn-muted">
        Toda cliente que agenda entra aqui sozinha. Toque no nome para ver o histórico e anotar aniversário e preferências.
      </p>

      <label className="pn-field pn-busca">
        <span className="sr-only">Procurar</span>
        <input type="search" value={busca} placeholder="Procurar por nome ou telefone" onChange={(e) => setBusca(e.target.value)} />
      </label>
      <div className="pn-row pn-row-left">
        {FILTROS.map((f) => (
          <button key={f.key} className={`pn-chip ${filtro === f.key ? 'pn-chip-dark' : ''}`} onClick={() => setFiltro(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {filtro === 'sumidas' && (
        <p className="pn-muted">Vieram pelo menos uma vez, não voltam há mais de 2 meses e não têm horário marcado.</p>
      )}

      {erro && <p className="pn-error">{erro}</p>}
      {fichas === null && <p className="pn-muted">Carregando…</p>}
      {fichas && lista.length === 0 && !erro && <p className="pn-empty">Nenhuma cliente aqui.</p>}

      <ul className="pn-list">
        {lista.map((f) => (
          <li key={f.phone}>
            <button className="pn-card pn-card-flat pn-cliente" onClick={() => setAberta(f.phone)}>
              <div className="pn-card-body">
                <span className="pn-card-service">{f.name}</span>
                <span className="pn-card-client">
                  {f.vezes === 0 ? 'Ainda não veio' : `${f.vezes} ${f.vezes === 1 ? 'visita' : 'visitas'} · ${reais(f.gasto)}`}
                  {f.ultima && ` · última vez ${haQuanto(f.ultima, hoje)}`}
                </span>
                {f.proxima && <span className="pn-badge b-confirmado">Volta {dataCurta(f.proxima)}</span>}
              </div>
              <span aria-hidden="true" className="pn-seta">›</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="pn-row pn-row-left">
        <button className="pn-chip pn-chip-dark" onClick={() => setNova((v) => !v)}>
          {nova ? 'Fechar' : 'Adicionar cliente'}
        </button>
        {fichas && fichas.length > 0 && (
          <button className="pn-chip" onClick={baixar}>
            Baixar lista (Excel)
          </button>
        )}
      </div>
      {nova && (
        <NovaCliente
          onDone={(phone) => {
            setNova(false)
            load().then(() => setAberta(phone))
          }}
        />
      )}
    </section>
  )
}

function NovaCliente({ onDone }: { onDone: (phone: string) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const d = phone.replace(/\D/g, '')
    if (d.length < 10 || d.length > 11) return setErro('Confira o WhatsApp: use DDD e número.')
    const { error } = await supabase!.from('clients').insert({ phone: d, name: name.trim() })
    if (error) return setErro(error.code === '23505' ? 'Já existe uma cliente com esse WhatsApp.' : dbError(error))
    onDone(d)
  }

  return (
    <form className="pn-form pn-box" onSubmit={salvar}>
      <label className="pn-field">
        <span>Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
      </label>
      <label className="pn-field">
        <span>WhatsApp</span>
        <input inputMode="tel" value={phone} placeholder="(11) 98765-4321" onChange={(e) => setPhone(formatPhone(e.target.value))} required />
      </label>
      {erro && <p className="pn-error">{erro}</p>}
      <button className="btn btn-primary">Salvar cliente</button>
    </form>
  )
}

const STATUS_CURTO: Record<string, string> = {
  pendente: 'a confirmar',
  confirmado: 'marcado',
  cancelado: 'cancelado',
  concluido: 'atendida',
}

function FichaCliente({ f, hoje, voltar, reload }: { f: Ficha; hoje: string; voltar: () => void; reload: () => Promise<void> }) {
  const [name, setName] = useState(f.name)
  const [birthday, setBirthday] = useState(f.birthday ?? '')
  const [origin, setOrigin] = useState(f.origin ?? '')
  const [notes, setNotes] = useState(f.notes ?? '')
  const [estado, setEstado] = useState('')

  const mudou = name !== f.name || birthday !== (f.birthday ?? '') || origin !== (f.origin ?? '') || notes !== (f.notes ?? '')
  const primeiro = f.name.split(' ')[0]

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setEstado('Salvando…')
    const { error } = await supabase!
      .from('clients')
      .update({ name: name.trim() || f.name, birthday: birthday || null, origin: origin || null, notes: notes.trim() || null })
      .eq('phone', f.phone)
    if (error) return setEstado(dbError(error))
    await reload()
    setEstado('Salvo.')
  }

  async function apagarDados() {
    const aviso =
      `Apagar os dados de ${f.name}?\n\n` +
      'Some a ficha, os Lady Points, os cupons, os convites e a conta Google dela. ' +
      'Os atendimentos continuam nos números do salão, mas sem nome nem telefone. Não dá para desfazer.'
    if (!window.confirm(aviso)) return
    setEstado('Apagando…')
    const { error } = await supabase!.rpc('lgpd_apagar_cliente', { p_phone: f.phone })
    if (error) {
      return setEstado(
        error.message.includes('lgpd_apagar_cliente') ? 'Rode o arquivo 0013 no Supabase para poder apagar.' : dbError(error),
      )
    }
    await reload()
    voltar()
  }

  const mensagens = [
    { rotulo: 'Oi', texto: `Oi, ${primeiro}! Tudo bem? Aqui é a Leide, do Leide Hair.` },
    {
      rotulo: 'Saudade',
      texto: `Oi, ${primeiro}! Que saudade de você aqui no salão 💛 Que tal marcar um horário essa semana? É só responder aqui ou agendar pelo app. Beijos, Leide`,
    },
    {
      rotulo: 'Aniversário',
      texto: `Feliz aniversário, ${primeiro}! 🎉 Que seu dia seja lindo. Para comemorar, seu próximo atendimento aqui no salão tem um mimo especial. Beijos, Leide Hair`,
    },
    {
      rotulo: 'Obrigada',
      texto: `Oi, ${primeiro}! Obrigada pela visita hoje 💛 Se puder, me conta o que achou. Até a próxima! Leide Hair`,
    },
  ]

  return (
    <section className="pn-section">
      <button className="pn-chip" onClick={voltar}>
        <ChevronLeftIcon /> Todas as clientes
      </button>
      <h2 className="pn-ficha-nome">{f.name}</h2>
      <p className="pn-muted">
        <a href={whatsappLink(f.phone, `Oi, ${primeiro}!`)} target="_blank" rel="noreferrer">
          {formatPhone(f.phone)}
        </a>
        {' · '}cliente desde {dataCurta(diaDe(f.created_at)).toLowerCase()}
      </p>

      <div className="pn-kpis">
        <div className="pn-kpi">
          <span>Visitas</span>
          <strong>{f.vezes}</strong>
        </div>
        <div className="pn-kpi">
          <span>Já gastou</span>
          <strong>{reais(f.gasto)}</strong>
        </div>
        <div className="pn-kpi">
          <span>Última vez</span>
          <strong>{f.ultima ? haQuanto(f.ultima, hoje) : '–'}</strong>
        </div>
        <div className="pn-kpi">
          <span>Lady Points</span>
          <strong>{f.pontos.toLocaleString('pt-BR')}</strong>
        </div>
      </div>

      <h3 className="pn-sub">Mandar mensagem</h3>
      <div className="pn-row pn-row-left">
        {mensagens.map((m) => (
          <a key={m.rotulo} className="pn-btn" href={whatsappLink(f.phone, m.texto)} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> {m.rotulo}
          </a>
        ))}
      </div>

      <form className="pn-form pn-box" onSubmit={salvar}>
        <h3>Ficha</h3>
        <label className="pn-field">
          <span>Nome</span>
          <input value={name} onChange={(e) => (setName(e.target.value), setEstado(''))} />
        </label>
        <div className="pn-grid2">
          <label className="pn-field">
            <span>Aniversário</span>
            <input type="date" value={birthday} onChange={(e) => (setBirthday(e.target.value), setEstado(''))} />
          </label>
          <label className="pn-field">
            <span>Como conheceu</span>
            <select value={origin} onChange={(e) => (setOrigin(e.target.value), setEstado(''))}>
              <option value="">Não sei</option>
              {[...new Set([...ORIGENS, ...(f.origin ? [f.origin] : [])])].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="pn-field">
          <span>Anotações</span>
          <textarea
            rows={4}
            value={notes}
            placeholder="Cor da tinta, produto que prefere, do que ela gosta…"
            onChange={(e) => (setNotes(e.target.value), setEstado(''))}
          />
        </label>
        <p className="pn-muted">Se não souber o ano do aniversário, use qualquer ano: só o dia e o mês contam.</p>
        <p className="pn-muted">
          Privacidade: anote só o que ajuda no atendimento. Alergia ou outro dado de saúde, só se a cliente concordar.
        </p>
        <div className="pn-save">
          <button className="btn btn-primary" disabled={!mudou}>
            Salvar ficha
          </button>
          {estado && <span className={estado === 'Salvo.' ? 'pn-ok' : 'pn-muted-inline'}>{estado}</span>}
        </div>
      </form>

      <div className="pn-box">
        <h3>Privacidade</h3>
        <p className="pn-muted">
          Se a cliente pedir para apagar os dados dela (direito garantido pela LGPD), toque aqui. Faça isso em até 15 dias
          do pedido.
        </p>
        <button type="button" className="pn-btn pn-btn-quiet" onClick={apagarDados}>
          Apagar dados da cliente
        </button>
      </div>

      <h3 className="pn-sub">Histórico</h3>
      {f.visitas.length === 0 && <p className="pn-empty">Nenhum agendamento ainda.</p>}
      <ul className="pn-list">
        {f.visitas.slice(0, 30).map((v) => (
          <li key={v.id} className={`pn-card pn-card-flat st-${v.status}`}>
            <div className="pn-card-body">
              <span className="pn-card-service">{v.service?.name ?? 'Serviço'}</span>
              <span className="pn-card-client">
                {dataCurta(diaDe(v.starts_at))} · {STATUS_CURTO[v.status]}
              </span>
            </div>
            {v.status === 'concluido' && <span className="pn-muted-inline">{reais(valorDe(v))}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
