/* Conecta: funciona sem internet (abre a última versão) e mostra as
   notificações que chegam com o app fechado. */
const VERSION = 'conecta-2'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const SHELL_FILES = ['./', './manifest.webmanifest', './icon-192.png', './favicon.svg']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)).catch(() => {}))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Supabase, fontes e vídeos vão direto para a rede.
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL).then(cache => cache.put('./', copy)).catch(() => {})
          }
          return response
        })
        .catch(async () => (await caches.match('./')) || Response.error()),
    )
    return
  }

  // Arquivos com nome versionado (assets/…-hash.js) nunca mudam: cache primeiro.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ||
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSETS).then(cache => cache.put(request, copy)).catch(() => {})
            }
            return response
          }),
      ),
    )
    return
  }

  // Ícones e manifesto: usa o salvo e atualiza por trás.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL).then(cache => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => cached || Response.error())
      return cached || network
    }),
  )
})

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Conecta'
  event.waitUntil(
    (async () => {
      // Com o Conecta aberto e na tela, o próprio app já mostra a novidade.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some(client => client.focused && client.visibilityState === 'visible')) return
      await self.registration.showNotification(title, {
        body: typeof data.body === 'string' ? data.body : '',
        tag: typeof data.tag === 'string' ? data.tag : undefined,
        renotify: typeof data.tag === 'string',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        data: { url: typeof data.url === 'string' && data.url.startsWith('#/') ? data.url : '#/inicio' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const hash = (event.notification.data && event.notification.data.url) || '#/inicio'
  const base = self.registration.scope.split('#')[0]
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find(client => client.url.startsWith(base))
      if (open) {
        await open.focus()
        open.postMessage({ type: 'conecta-open', url: hash })
        return
      }
      await self.clients.openWindow(base + hash)
    })(),
  )
})
