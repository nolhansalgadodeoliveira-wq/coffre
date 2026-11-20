import { beforeEach, describe, expect, it, vi } from 'vitest'

// Faux serveur de comptes : e-mail → { id, mot de passe }.
const users = new Map<string, { id: string; password: string }>()
vi.mock('./cloud', () => ({
  setRemember: () => {},
  friendlyError: (m: string) => (/invalid login/i.test(m) ? 'E-mail ou mot de passe incorrect.' : m),
  supabase: {
    auth: {
      signUp: async ({ email, password }: { email: string; password: string }) => {
        if (users.has(email)) return { data: { user: { id: 'x', identities: [] }, session: null }, error: null }
        const u = { id: 'u-' + email, password }
        users.set(email, u)
        return { data: { user: { id: u.id, identities: [{}] }, session: {} }, error: null }
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const u = users.get(email)
        return u && u.password === password ? { data: { user: { id: u.id } }, error: null } : { data: { user: null }, error: { message: 'Invalid login credentials' } }
      },
      verifyOtp: async ({ email, token }: { email: string; token: string }) => {
        const u = users.get(email)
        return u && token === '123456' ? { data: { user: { id: u.id } }, error: null } : { data: { user: null }, error: { message: 'Token has expired or is invalid' } }
      },
      signOut: async () => ({}),
      updateUser: async ({ password }: { password: string }) => {
        for (const u of users.values()) if (u.id === 'u-a@b.fr' || u.id === 'u-n@ex.com') u.password = password
        return { error: null }
      },
    },
  },
}))

const { createAccount, currentAccount, resetPassword, signIn, signOutEverywhere } = await import('./accounts')
const { loadData, saveData } = await import('./storage')
const { EMPTY_DATA } = await import('./types')

function store(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size }, clear: () => m.clear() } as Storage
}
beforeEach(() => {
  users.clear()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = store()
  ;(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = store()
})
const day = (date: string) => ({ ...EMPTY_DATA, entries: [{ id: date, date, gross: 20000, amount: 10000, updatedAt: '2026-11-01T00:00:00.000Z' }] })

describe('comptes en ligne', () => {
  it('création puis connexion mémorisée', async () => {
    const r = await createAccount('Nolhan@Example.com ', 'secret123')
    expect(r.ok).toBe(true)
    expect(currentAccount()?.email).toBe('nolhan@example.com')
    await signOutEverywhere()
    expect(currentAccount()).toBeNull()
    expect((await signIn('nolhan@example.com', 'mauvais')).ok).toBe(false)
    expect((await signIn('NOLHAN@example.com', 'secret123')).ok).toBe(true)
  })
  it('refuse e-mail invalide, mot de passe court, doublon', async () => {
    expect((await createAccount('pas-un-mail', 'secret123')).ok).toBe(false)
    expect((await createAccount('a@b.fr', '123')).ok).toBe(false)
    await createAccount('a@b.fr', 'secret123')
    expect((await createAccount('a@b.fr', 'autre123')).ok).toBe(false)
  })
  it('sans « rester connecté » : rien de mémorisé durablement', async () => {
    await createAccount('a@b.fr', 'secret123', false)
    expect(localStorage.getItem('coffre-session:v1')).toBeNull()
    expect(currentAccount()?.email).toBe('a@b.fr')
  })
  it('les données déjà sur le téléphone sont reprises par le premier compte, pas par le suivant', async () => {
    saveData(day('2026-11-01')) // données d'avant les comptes
    await createAccount('a@b.fr', 'secret123')
    expect(loadData().entries.map((e) => e.date)).toEqual(['2026-11-01'])
    await signOutEverywhere()
    await createAccount('c@d.fr', 'secret456')
    expect(loadData().entries).toHaveLength(0)
  })
  it('un ancien compte « sur l’appareil » est créé en ligne à la connexion, avec ses données', async () => {
    // Ancien compte local (version précédente) : mot de passe « secret123 », données sous son préfixe.
    const salt = new Uint8Array(16)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret123'), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256)
    const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('coffre-comptes:v1', JSON.stringify([{ id: 'loc', email: 'n@ex.com', salt: '00'.repeat(16), hash: hex(bits), ns: 'loc' }]))
    localStorage.setItem('coffre-donnees-reprises:v1', 'autre') // données sans préfixe déjà reprises
    localStorage.setItem('caisse-weekend:v1@loc', JSON.stringify(day('2026-10-03')))
    const r = await signIn('n@ex.com', 'secret123')
    expect(r.ok).toBe(true)
    expect(users.has('n@ex.com')).toBe(true)
    expect(loadData().entries.map((e) => e.date)).toEqual(['2026-10-03'])
    expect((await signIn('n@ex.com', 'mauvais')).ok).toBe(false)
  })

  it('créer un compte qui existe déjà avec le MÊME mot de passe : on est simplement connecté', async () => {
    await createAccount('a@b.fr', 'secret123')
    await signOutEverywhere()
    const r = await createAccount('a@b.fr', 'secret123')
    expect(r.ok).toBe(true)
    expect(currentAccount()?.email).toBe('a@b.fr')
  })
  it('créer un compte qui existe déjà avec un AUTRE mot de passe : message clair + piste « mot de passe oublié »', async () => {
    await createAccount('a@b.fr', 'secret123')
    await signOutEverywhere()
    const r = await createAccount('a@b.fr', 'autre-mdp')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('exists')
      expect(r.error).toMatch(/Mot de passe oublié/)
    }
    expect(currentAccount()).toBeNull()
  })
  it('e-mail inconnu ou mauvais mot de passe : « incorrect », jamais « compte existant »', async () => {
    await createAccount('a@b.fr', 'secret123')
    await signOutEverywhere()
    for (const [e, p] of [['a@b.fr', 'mauvais'], ['inconnu@b.fr', 'secret123']]) {
      const r = await signIn(e, p)
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.code).toBe('wrong')
        expect(r.error).toBe('E-mail ou mot de passe incorrect.')
      }
    }
  })
  it('ancien compte de l’appareil dont l’e-mail existe déjà en ligne avec un autre mot de passe : pas de « compte existant », on propose le code par e-mail, puis les données sont reprises', async () => {
    users.set('n@ex.com', { id: 'u-n@ex.com', password: 'mot-de-passe-en-ligne' })
    const salt = new Uint8Array(16)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret123'), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256)
    const hex = [...new Uint8Array(bits)].map((x) => x.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('coffre-comptes:v1', JSON.stringify([{ id: 'loc', email: 'n@ex.com', salt: '00'.repeat(16), hash: hex, ns: 'loc' }]))
    localStorage.setItem('coffre-donnees-reprises:v1', 'autre')
    localStorage.setItem('caisse-weekend:v1@loc', JSON.stringify(day('2026-10-03')))
    const r = await signIn('n@ex.com', 'secret123')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('exists')
      expect(r.error).not.toMatch(/Connecte-toi\.$/)
      expect(r.error).toMatch(/Mot de passe oublié/)
    }
    // Mot de passe oublié : code reçu, nouveau mot de passe → connecté, données de l'ancien compte reprises.
    const reset = await resetPassword('n@ex.com', '123456', 'nouveau123')
    expect(reset.ok).toBe(true)
    expect(loadData().entries.map((e) => e.date)).toEqual(['2026-10-03'])
  })
})
