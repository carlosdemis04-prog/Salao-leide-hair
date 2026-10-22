// Serve o site (arquivos em ./dist), o link da agenda (.ics), a ligação com o Google Agenda
// e o assistente do painel (/api/assistente, ver assistente.js).
// /agenda.ics?token=... busca os agendamentos no Supabase pela função calendar_feed,
// que confere o token secreto antes de devolver qualquer coisa.
import { enviarAgendamentos, googleConfigurado, sincronizar } from './google.js'
import { assistente } from './assistente.js'

async function agendaIcs(url, env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: url.searchParams.get('token') ?? '' }),
  })
  if (!res.ok) return new Response('Link da agenda inválido.', { status: 404 })

  return new Response(await res.json(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/agenda.ics') return agendaIcs(url, env)
    if (url.pathname === '/api/assistente') return assistente(request, env)

    // O site avisa logo depois de cada agendamento, para ele aparecer no Google sem esperar
    // os 5 minutos. Só manda o que estiver pendente; não devolve nenhum dado.
    if (url.pathname === '/google/sync') {
      if (request.method !== 'POST') return new Response(null, { status: 405 })
      if (googleConfigurado(env)) {
        ctx.waitUntil(enviarAgendamentos(env).catch((e) => console.log('google/sync', e.message)))
      }
      return new Response(null, { status: 202 })
    }

    return env.ASSETS.fetch(request)
  },

  // A cada 5 minutos: manda os agendamentos e traz os compromissos da Leide
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      sincronizar(env).then(
        (r) => console.log('google agenda', JSON.stringify(r)),
        (e) => console.log('google agenda falhou', e.message),
      ),
    )
  },
}
