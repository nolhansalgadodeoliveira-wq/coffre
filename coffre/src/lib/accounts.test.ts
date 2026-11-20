import { beforeEach, describe, expect, it } from 'vitest'
import { changePassword, checkPassword, createAccount, currentAccount, deleteAccount, endSession, listAccounts, startSession } from './accounts'
import { loadData, saveData } from './storage'
import { EMPTY_DATA } from './types'

function store(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size }, clear: () => m.clear() } as Storage
}
beforeEach(() => {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = store()
  ;(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = store()
})

const day = (date: string) => ({ ...EMPTY_DATA, entries: [{ id: date, date, gross: 20000, amount: 10000, updatedAt: '2026-11-01T00:00:00.000Z' }] })

describe('comptes sur l’appareil', () => {
  it('crée un compte, sans jamais enregistrer le mot de passe', async () => {
    const r = await createAccount('Nolhan@Example.com ', 'secret123')
    expect(r.ok).toBe(true)
    expect(listAccounts()[0].email).toBe('nolhan@example.com')
    expect(JSON.stringify(localStorage.getItem('coffre-comptes:v1'))).not.toContain('secret123')
  })
  it('refuse e-mail invalide, mot de passe court et doublon', async () => {
    expect((await createAccount('pas-un-mail', 'secret123')).ok).toBe(false)
    expect((await createAccount('a@b.fr', '123')).ok).toBe(false)
    await createAccount('a@b.fr', 'secret123')
    expect((await createAccount('A@B.fr', 'autre-mdp')).ok).toBe(false)
  })
  it('connexion : bon mot de passe accepté, mauvais refusé, e-mail inconnu refusé', async () => {
    await createAccount('a@b.fr', 'secret123')
    expect((await checkPassword('a@b.fr', 'secret123')).ok).toBe(true)
    expect((await checkPassword('A@B.FR', 'secret123')).ok).toBe(true)
    expect((await checkPassword('a@b.fr', 'mauvais')).ok).toBe(false)
    expect((await checkPassword('x@y.fr', 'secret123')).ok).toBe(false)
  })
  it('changer le mot de passe', async () => {
    const r = await createAccount('a@b.fr', 'secret123')
    if (!r.ok) throw new Error()
    expect(await changePassword(r.account.id, 'faux', 'nouveau1')).not.toBeNull()
    expect(await changePassword(r.account.id, 'secret123', 'nouveau1')).toBeNull()
    expect((await checkPassword('a@b.fr', 'secret123')).ok).toBe(false)
    expect((await checkPassword('a@b.fr', 'nouveau1')).ok).toBe(true)
  })
  it('connexion mémorisée (ou seulement pour la session)', async () => {
    const r = await createAccount('a@b.fr', 'secret123')
    if (!r.ok) throw new Error()
    startSession(r.account.id, true)
    expect(currentAccount()?.email).toBe('a@b.fr')
    expect(localStorage.getItem('coffre-session:v1')).toBe(r.account.id)
    startSession(r.account.id, false)
    expect(localStorage.getItem('coffre-session:v1')).toBeNull()
    expect(currentAccount()?.email).toBe('a@b.fr')
    endSession()
    expect(currentAccount()).toBeNull()
  })
  it('le premier compte reprend les données déjà présentes ; le second a les siennes, séparées', async () => {
    saveData(day('2026-11-01')) // données d'avant les comptes
    const a = await createAccount('a@b.fr', 'secret123')
    const b = await createAccount('c@d.fr', 'secret456')
    if (!a.ok || !b.ok) throw new Error()
    startSession(a.account.id, true)
    expect(loadData().entries.map((e) => e.date)).toEqual(['2026-11-01'])
    startSession(b.account.id, true)
    expect(loadData().entries).toHaveLength(0)
    saveData(day('2026-11-02'))
    startSession(a.account.id, true)
    expect(loadData().entries.map((e) => e.date)).toEqual(['2026-11-01'])
  })
  it('supprimer un compte efface ses données et pas celles des autres', async () => {
    const a = await createAccount('a@b.fr', 'secret123')
    const b = await createAccount('c@d.fr', 'secret456')
    if (!a.ok || !b.ok) throw new Error()
    startSession(b.account.id, true)
    saveData(day('2026-11-02'))
    deleteAccount(b.account.id)
    expect(listAccounts().map((x) => x.email)).toEqual(['a@b.fr'])
    expect(currentAccount()).toBeNull()
    expect([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)!).some((k) => k.startsWith('caisse-weekend:v1@'))).toBe(false)
  })
})
