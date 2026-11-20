// Service worker : garde l'app disponible hors ligne.
//
// Règle importante : on ne met en cache QUE les fichiers de l'app (même adresse que l'app).
// Les appels vers le serveur de sauvegarde (Google Drive) ou tout autre site ne passent jamais par le cache :
// sinon l'app lirait une copie périmée de tes données.
const CACHE = 'coffre-v6'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './apple-touch-icon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Autre site (Google…) : le navigateur s'en occupe normalement, sans cache.
  if (url.origin !== self.location.origin) return

  // Pages : réseau d'abord (pour recevoir les mises à jour), cache en secours hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Fichiers de l'app (icônes, manifeste) : cache d'abord, mis à jour en arrière-plan.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => hit)
      return hit || net
    }),
  )
})

// ---- Rappels de fin de journée (Web Push) ----
// Le serveur envoie un message ; on affiche toujours une notification (obligatoire sur iPhone).
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { body: e.data ? e.data.text() : '' }
  }
  const title = data.title || 'Coffre'
  const jobs = [
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'coffre',
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: data.url || './#saisir' },
    }),
  ]
  if (self.navigator && self.navigator.setAppBadge) jobs.push(self.navigator.setAppBadge(1).catch(() => {}))
  e.waitUntil(Promise.all(jobs))
})

// Toucher la notification ouvre l'app sur la saisie de la journée.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || './#saisir'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'open-add' })
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
