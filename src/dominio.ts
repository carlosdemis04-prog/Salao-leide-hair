// Domínio próprio do salão. Quem abre o endereço antigo (workers.dev) ou o www é mandado para
// leidehair.com.br. Cada endereço tem a sua memória no celular, então a ida leva junto o que o
// app guardou (código das Lady Points, reservas, convite e dados da cliente) para ninguém perder
// os pontos. O link da agenda (.ics) e o resto do worker continuam no endereço antigo.

export const DOMINIO = 'leidehair.com.br'
const ANTIGOS = ['salao-leide-hair.carlosdemis04.workers.dev', `www.${DOMINIO}`]
const CHAVES = ['leide-app-lady', 'leide-app-reservas', 'leide-app-convite', 'leide-app-cliente']
const PARAM = '_memoria'

function ler(chave: string) {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

// true = está indo para o domínio novo (não precisa desenhar a página)
export function irParaDominio() {
  if (ANTIGOS.includes(location.hostname)) {
    const destino = new URL(location.pathname + location.search + location.hash, `https://${DOMINIO}`)
    destino.searchParams.delete(PARAM)
    const memoria: Record<string, string> = {}
    for (const k of CHAVES) {
      const v = ler(k)
      if (v !== null) memoria[k] = v
    }
    if (Object.keys(memoria).length) destino.searchParams.set(PARAM, JSON.stringify(memoria))
    location.replace(destino)
    return true
  }
  receberMemoria()
  return false
}

// Chegou do endereço antigo: guarda a memória que veio junto, sem apagar nada que já exista aqui.
// Só aceita quando veio mesmo do endereço antigo, para um link de fora não trocar o código de ninguém.
function receberMemoria() {
  const url = new URL(location.href)
  const bruto = url.searchParams.get(PARAM)
  if (bruto === null) return
  url.searchParams.delete(PARAM)
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)

  let veio = ''
  try {
    veio = new URL(document.referrer).hostname
  } catch {
    /* sem referência: não veio do endereço antigo */
  }
  if (!ANTIGOS.includes(veio) || ler('leide-app-lady') !== null) return
  try {
    const memoria = JSON.parse(bruto) as Record<string, unknown>
    for (const k of CHAVES) {
      const v = memoria[k]
      if (typeof v === 'string' && ler(k) === null) localStorage.setItem(k, v)
    }
  } catch {
    /* memória quebrada ou sem armazenamento: segue sem ela */
  }
}
