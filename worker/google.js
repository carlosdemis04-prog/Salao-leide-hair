// Ligação direta com o Google Agenda da Leide.
// Usa uma "conta de serviço" do Google Cloud: a Leide compartilha a agenda dela com o e-mail
// dessa conta, e o worker entra com a chave dela (segredo GOOGLE_SERVICE_ACCOUNT na Cloudflare).
//
// Segredos que o Carlos coloca no painel da Cloudflare (nunca no código):
//   GOOGLE_SERVICE_ACCOUNT  o arquivo .json da chave, inteiro
//   GOOGLE_CALENDAR_ID      o Gmail da Leide (o id da agenda dela)
//   GOOGLE_SYNC_TOKEN       a senha google_token da tabela settings do Supabase

const TZ = 'America/Sao_Paulo'
const DIAS_LIDOS = 30
// Marca que diferencia os eventos criados pelo site dos compromissos da própria Leide
const MARCA = 'leidehair'

const SEGREDOS = ['GOOGLE_SERVICE_ACCOUNT', 'GOOGLE_CALENDAR_ID', 'GOOGLE_SYNC_TOKEN']

// Nomes (nunca os valores) dos segredos que o worker não está recebendo
export function segredosFaltando(env) {
  return SEGREDOS.filter((nome) => !env[nome])
}

export function googleConfigurado(env) {
  return segredosFaltando(env).length === 0
}

function base64url(bytes) {
  const bin = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Troca a chave da conta de serviço por um acesso temporário (1 hora) à agenda
async function acessoGoogle(env) {
  const conta = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT)
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])

  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat: agora,
      exp: agora + 3600,
    }),
  )
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cabecalho}.${corpo}`))

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${base64url(assinatura)}`,
    }),
  })
  if (!res.ok) throw new Error(`Google recusou a chave: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

async function rpc(env, nome, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: env.GOOGLE_SYNC_TOKEN, ...args }),
  })
  if (!res.ok) throw new Error(`Supabase ${nome}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

function formatarTelefone(d) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

function eventoDoAgendamento(a) {
  const pendente = a.status === 'pendente'
  const whatsapp = a.client_phone.length >= 12 ? a.client_phone : `55${a.client_phone}`
  return {
    summary: `${pendente ? '(a confirmar) ' : ''}${a.servico} - ${a.client_name}`,
    description: `WhatsApp: ${formatarTelefone(a.client_phone)}\nhttps://wa.me/${whatsapp}\nSituação: ${a.status}\nAgendado pelo site.`,
    start: { dateTime: a.starts_at, timeZone: TZ },
    end: { dateTime: a.ends_at, timeZone: TZ },
    // Amarelo enquanto espera confirmação, verde depois
    colorId: pendente ? '5' : '10',
    status: 'confirmed',
    extendedProperties: { private: { [MARCA]: '1' } },
  }
}

// O id do evento no Google sai do id do agendamento, então reenviar nunca duplica
export function idDoEvento(appointmentId) {
  return `lh${appointmentId.replace(/-/g, '')}`
}

// 1. Agendamentos novos ou alterados vão para o Google
export async function enviarAgendamentos(env, acesso) {
  const pendentes = await rpc(env, 'google_pendentes', {})
  if (!pendentes.length) return 0
  acesso ??= await acessoGoogle(env)
  const agenda = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`
  const headers = { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' }

  let enviados = 0
  for (const a of pendentes) {
    const id = idDoEvento(a.id)
    let ok
    if (a.status === 'cancelado') {
      const res = await fetch(`${agenda}/${id}`, { method: 'DELETE', headers })
      ok = res.ok || res.status === 404 || res.status === 410
    } else {
      const corpo = JSON.stringify(eventoDoAgendamento(a))
      let res = await fetch(`${agenda}/${id}`, { method: 'PUT', headers, body: corpo })
      if (res.status === 404) res = await fetch(agenda, { method: 'POST', headers, body: JSON.stringify({ id, ...JSON.parse(corpo) }) })
      ok = res.ok
      if (!ok) console.log('Google não aceitou o agendamento', a.id, res.status, await res.text())
    }
    if (ok) {
      await rpc(env, 'google_enviado', { p_id: a.id, p_versao: a.versao })
      enviados++
    }
  }
  return enviados
}

// 2. Compromissos que a Leide marcou no Google bloqueiam o horário no site
export async function lerCompromissos(env, acesso) {
  acesso ??= await acessoGoogle(env)
  const inicio = new Date()
  const fim = new Date(inicio.getTime() + DIAS_LIDOS * 86_400_000)
  const eventos = []
  let pagina = ''
  do {
    const params = new URLSearchParams({
      timeMin: inicio.toISOString(),
      timeMax: fim.toISOString(),
      singleEvents: 'true',
      maxResults: '250',
      ...(pagina ? { pageToken: pagina } : {}),
    })
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?${params}`,
      { headers: { Authorization: `Bearer ${acesso}` } },
    )
    if (!res.ok) throw new Error(`Google não deixou ler a agenda: ${res.status} ${await res.text()}`)
    const dados = await res.json()
    for (const e of dados.items ?? []) {
      if (e.status === 'cancelled') continue
      if (e.extendedProperties?.private?.[MARCA]) continue // agendamento do próprio site
      if (e.transparency === 'transparent') continue // marcado como "livre" na agenda
      // Evento de dia inteiro: bloqueia o dia todo no horário de Brasília
      const ini = e.start.dateTime ?? `${e.start.date}T00:00:00-03:00`
      const f = e.end.dateTime ?? `${e.end.date}T00:00:00-03:00`
      eventos.push({ id: e.id, inicio: new Date(ini).toISOString(), fim: new Date(f).toISOString() })
    }
    pagina = dados.nextPageToken ?? ''
  } while (pagina)

  await rpc(env, 'google_bloqueios', { p_inicio: inicio.toISOString(), p_fim: fim.toISOString(), p_eventos: eventos })
  return eventos.length
}

export async function sincronizar(env) {
  if (!googleConfigurado(env)) {
    const nomes = Object.keys(env).filter((k) => k.toUpperCase().includes('GOOGLE'))
    return { configurado: false, faltando: segredosFaltando(env), recebidos: nomes }
  }
  const acesso = await acessoGoogle(env)
  const enviados = await enviarAgendamentos(env, acesso)
  const bloqueios = await lerCompromissos(env, acesso)
  return { configurado: true, enviados, bloqueios }
}
