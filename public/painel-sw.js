// Service worker do painel da Leide (/painel). Existe para o celular deixar "instalar" o painel
// na tela de início, como um app. Não guarda dados: agenda e clientes sempre vêm do banco, ao vivo.
// Só guarda a tela do painel para abrir mesmo com a internet fraca (os dados carregam quando ela volta).
const CACHE = 'leide-painel-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('leide-painel-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || !url.pathname.startsWith('/painel')) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/painel', copia))
        }
        return res
      })
      .catch(() => caches.match('/painel').then((r) => r || Response.error())),
  )
})
