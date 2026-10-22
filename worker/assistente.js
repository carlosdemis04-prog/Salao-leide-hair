// Assistente do painel: a Leide conversa e ele devolve a resposta e rascunhos de ofertas
// e eventos. Ele nunca publica nada sozinho: o painel mostra o rascunho e só salva
// quando a Leide aperta "Publicar". A chave da Anthropic fica como segredo na Cloudflare
// (ANTHROPIC_API_KEY) e nunca vai para o navegador.
import Anthropic from '@anthropic-ai/sdk'

const MAX_MENSAGENS = 16
const MAX_TEXTO = 2000

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

// Confere no Supabase, com o login de quem chamou, se é a administradora
async function ehAdmin(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  })
  return res.ok && (await res.json()) === true
}

const textoOuNulo = { type: ['string', 'null'] }
const numeroOuNulo = { type: ['number', 'null'] }

const FORMATO = {
  type: 'json_schema',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['resposta', 'rascunhos'],
    properties: {
      resposta: { type: 'string' },
      rascunhos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'tipo', 'titulo', 'descricao', 'condicoes', 'preco_reais', 'preco_original_reais',
            'valido_ate', 'inicio', 'fim', 'local', 'vagas', 'texto_divulgacao',
          ],
          properties: {
            tipo: { type: 'string', enum: ['oferta', 'evento'] },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            condicoes: textoOuNulo,
            preco_reais: numeroOuNulo,
            preco_original_reais: numeroOuNulo,
            valido_ate: textoOuNulo,
            inicio: textoOuNulo,
            fim: textoOuNulo,
            local: textoOuNulo,
            vagas: { type: ['integer', 'null'] },
            texto_divulgacao: { type: 'string' },
          },
        },
      },
    },
  },
}

const SISTEMA = `Você é a assistente do painel do Leide Hair, um salão de beleza pequeno em Campininha, São Paulo, da cabeleireira Leide. Quem conversa com você é a própria Leide, que não tem experiência com tecnologia.

Seu trabalho:
- Ajudar a criar ofertas (promoções) e eventos (dia especial, workshop, campanha) para o app do salão. Quando ela pedir uma oferta ou evento, ou aceitar uma sugestão sua, coloque o rascunho em "rascunhos". Ela revisa e publica com um botão; você não publica nada.
- Dar ideias de promoções para dias fracos, datas comemorativas e clientes sumidas, usando os números do salão que vêm no contexto.
- Explicar os números do painel em palavras simples quando ela perguntar.

Regras:
- Escreva em português do Brasil, frases curtas, tom carinhoso e direto. Sem jargão (nada de "ticket médio", "CRM", "KPI"; diga "valor médio por cliente", "lista de clientes").
- Nunca invente preços. Use os preços dos serviços do contexto; se o serviço não tiver preço, ou ela não disser, pergunte e deixe o preço nulo no rascunho.
- O salão atende de terça a sábado. Não marque eventos em domingo ou segunda.
- Datas no formato AAAA-MM-DD; início e fim de evento no formato AAAA-MM-DDTHH:MM, no horário de São Paulo. Use a data de hoje do contexto para entender "sábado que vem", "mês que vem" etc.
- Evento sem data marcada (como atendimento domiciliar) fica com início nulo.
- "texto_divulgacao" é uma mensagem pronta para WhatsApp ou Instagram, curta, com no máximo 2 emojis, terminando com o convite para agendar pelo app ou WhatsApp (11) 92229-7887.
- Campos que não se aplicam ficam nulos (ex.: preço em evento, vagas em oferta).
- Se ela pedir algo fora disso, ajude se for sobre o salão; se não, diga com gentileza que só sabe ajudar com o salão.
- Na "resposta", fale com ela. Se criou rascunhos, diga em uma frase o que criou e que ela pode revisar e apertar "Publicar".`

function limpa(mensagens) {
  if (!Array.isArray(mensagens)) return null
  const ok = mensagens
    .slice(-MAX_MENSAGENS)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXTO) }))
  while (ok.length && ok[0].role !== 'user') ok.shift()
  return ok.length && ok[ok.length - 1].role === 'user' ? ok : null
}

export async function assistente(request, env) {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  if (!env.ANTHROPIC_API_KEY) return json({ erro: 'sem_chave' }, 503)
  if (!(await ehAdmin(request, env))) return json({ erro: 'sem_acesso' }, 401)

  let corpo
  try {
    corpo = await request.json()
  } catch {
    return json({ erro: 'pedido_invalido' }, 400)
  }
  const mensagens = limpa(corpo?.mensagens)
  if (!mensagens) return json({ erro: 'pedido_invalido' }, 400)
  const contexto = typeof corpo?.contexto === 'string' ? corpo.contexto.slice(0, 6000) : ''

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const resposta = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: FORMATO },
      system: [
        { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Contexto do salão agora:\n${contexto}` },
      ],
      messages: mensagens,
    })
    if (resposta.stop_reason === 'refusal') {
      return json({ resposta: 'Desculpe, não consigo ajudar com esse pedido. Tente pedir de outro jeito.', rascunhos: [] })
    }
    const texto = resposta.content.find((b) => b.type === 'text')?.text
    if (resposta.stop_reason === 'max_tokens' || !texto) return json({ erro: 'resposta_incompleta' }, 502)
    const dados = JSON.parse(texto)
    return json({
      resposta: String(dados.resposta ?? ''),
      rascunhos: Array.isArray(dados.rascunhos) ? dados.rascunhos.slice(0, 5) : [],
    })
  } catch (e) {
    console.log('assistente', e?.status ?? '', e?.message ?? e)
    if (e instanceof Anthropic.AuthenticationError) return json({ erro: 'chave_invalida' }, 503)
    if (e instanceof Anthropic.RateLimitError) return json({ erro: 'ocupado' }, 429)
    return json({ erro: 'falhou' }, 502)
  }
}
