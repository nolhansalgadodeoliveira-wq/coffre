// Teste public/sw.js tel quel, dans un faux environnement de service worker (sans navigateur).
import { describe, expect, it, vi } from 'vitest'
import swSource from '../../public/sw.js?raw'

type Handler = (e: Record<string, unknown>) => void

function load() {
  const handlers: Record<string, Handler> = {}
  const shown: { title: string; opts: Record<string, unknown> }[] = []
  const calls = { open: [] as string[], badge: [] as number[], fetched: [] as string[], cachePut: [] as string[] }
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async (k: unknown) => void calls.cachePut.push(typeof k === 'string' ? k : (k as { url: string }).url) }),
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  }
  const self = {
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    registration: { showNotification: async (title: string, opts: Record<string, unknown>) => void shown.push({ title, opts }) },
    location: { origin: 'https://coffre.example' },
    navigator: { setAppBadge: async (n: number) => void calls.badge.push(n) },
    clients: { claim: () => {}, matchAll: async (): Promise<unknown[]> => [], openWindow: async (u: string) => void calls.open.push(u) },
    skipWaiting: () => {},
  }
  const fetchFn = async (req: { url?: string } | string) => {
    calls.fetched.push(typeof req === 'string' ? req : req.url ?? '')
    return { ok: true, clone: () => ({}) }
  }
  new Function('self', 'caches', 'fetch', 'URL', swSource)(self, caches, fetchFn, URL)
  return { handlers, shown, calls, self }
}

const pushEvent = (data: unknown) => {
  const waits: Promise<unknown>[] = []
  return { event: { data: data === null ? null : { json: () => JSON.parse(data as string), text: () => String(data) }, waitUntil: (p: Promise<unknown>) => void waits.push(p) }, waits }
}

describe('service worker : notifications', () => {
  it('affiche la notification reçue du serveur, avec le prénom et le lien de saisie', async () => {
    const { handlers, shown, calls } = load()
    const { event, waits } = pushEvent(JSON.stringify({ title: 'Ta journée est finie ?', body: 'Alex, combien as-tu gagné aujourd’hui ?', url: './#saisir', tag: 'journee' }))
    handlers.push(event)
    await Promise.all(waits)
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('Ta journée est finie ?')
    expect(shown[0].opts).toMatchObject({ body: 'Alex, combien as-tu gagné aujourd’hui ?', tag: 'journee', icon: './icon-192.png', data: { url: './#saisir' } })
    expect(calls.badge).toEqual([1])
  })

  it('affiche toujours quelque chose, même si le message est illisible (obligatoire sur iPhone)', async () => {
    const { handlers, shown } = load()
    const { event, waits } = pushEvent('pas du json')
    handlers.push(event)
    await Promise.all(waits)
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('Coffre')
    expect(shown[0].opts.data).toEqual({ url: './#saisir' })
  })

  it('toucher la notification, app ouverte : elle passe au premier plan et ouvre la saisie', async () => {
    const { handlers, self, calls } = load()
    const log: string[] = []
    const client = { postMessage: (m: { type: string }) => log.push('message:' + m.type), focus: async () => (log.push('focus'), client) }
    self.clients.matchAll = async () => [client]
    const waits: Promise<unknown>[] = []
    let closed = false
    handlers.notificationclick({ notification: { close: () => (closed = true), data: { url: './#saisir' } }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
    expect(closed).toBe(true)
    expect(log).toEqual(['message:open-add', 'focus'])
    expect(calls.open).toEqual([])
  })

  it('toucher la notification, app fermée : ouvre l’app sur la saisie', async () => {
    const { handlers, calls } = load()
    const waits: Promise<unknown>[] = []
    handlers.notificationclick({ notification: { close: () => {}, data: { url: './#saisir' } }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
    expect(calls.open).toEqual(['./#saisir'])
  })
})

describe('service worker : cache (jamais tes données)', () => {
  function fetchEvent(url: string, mode = 'cors') {
    const responded: unknown[] = []
    return { event: { request: { method: 'GET', url, mode, clone: () => ({ url }) }, respondWith: (p: unknown) => void responded.push(p) }, responded }
  }
  it('ne touche pas aux appels vers un autre site (Supabase, Google…)', () => {
    const { handlers } = load()
    const a = fetchEvent('https://abcd.supabase.co/rest/v1/user_data?select=data')
    handlers.fetch(a.event)
    expect(a.responded).toHaveLength(0) // le navigateur s'en occupe, sans cache
    const b = fetchEvent('https://abcd.supabase.co/auth/v1/settings')
    handlers.fetch(b.event)
    expect(b.responded).toHaveLength(0)
  })
  it('ne touche pas aux requêtes qui ne sont pas des lectures', () => {
    const { handlers } = load()
    const e = { request: { method: 'POST', url: 'https://coffre.example/x', mode: 'cors' }, respondWith: vi.fn() }
    handlers.fetch(e)
    expect(e.respondWith).not.toHaveBeenCalled()
  })
  it('gère les fichiers de l’app et les pages', () => {
    const { handlers } = load()
    const icon = fetchEvent('https://coffre.example/icon-192.png')
    handlers.fetch(icon.event)
    expect(icon.responded).toHaveLength(1)
    const page = fetchEvent('https://coffre.example/', 'navigate')
    handlers.fetch(page.event)
    expect(page.responded).toHaveLength(1)
  })
})
