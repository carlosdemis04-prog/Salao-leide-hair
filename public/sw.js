// Service worker do app para celular (/app).
// Guarda a tela do app e os arquivos do site para abrir rápido e funcionar com internet fraca.
// Não mexe no site, no painel nem nos dados: agendamentos e horários sempre vêm do banco, ao vivo.
const CACHE = 'leide-app-v1'
const BASICOS = ['/app', '/logo.webp', '/app-icone-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return

  // Abrir o app: tenta a versão nova; sem internet, usa a guardada
  if (req.mode === 'navigate') {
    if (!url.pathname.startsWith('/app')) return
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/app', copia))
          return res
        })
        .catch(() => caches.match('/app')),
    )
    return
  }

  // Arquivos com nome versionado (/assets/...) nunca mudam: usa o guardado e baixa se faltar
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copia))
            }
            return res
          }),
      ),
    )
  }
})
