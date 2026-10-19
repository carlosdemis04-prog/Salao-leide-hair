// Serve o site (arquivos em ./dist) e o link da agenda para o Google Agenda.
// /agenda.ics?token=... busca os agendamentos no Supabase pela função calendar_feed,
// que confere o token secreto antes de devolver qualquer coisa.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/agenda.ics') return env.ASSETS.fetch(request)

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
  },
}
