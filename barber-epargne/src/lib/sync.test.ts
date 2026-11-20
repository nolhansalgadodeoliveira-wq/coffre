import { describe, expect, it } from 'vitest'
import { EMPTY_META, isEmptyData, mergeData, sameData, syncOnce, type CloudStore, type RemoteDoc, type SyncMeta } from './sync'
import type { AppData, Entry } from './types'
import { EMPTY_DATA } from './types'

const NOW = '2026-11-19T10:00:00.000Z'
function e(date: string, euros: number, updatedAt = '2026-11-01T00:00:00Z'): Entry {
  return { id: 'e' + date + euros, date, gross: euros * 200, amount: euros * 100, updatedAt }
}
function data(entries: Entry[] = [], extra: Partial<AppData> = {}): AppData {
  return { ...EMPTY_DATA, entries, ...extra }
}

class FakeStore implements CloudStore {
  doc: RemoteDoc | null
  saves = 0
  interfereOnce: (() => void) | null = null
  constructor(doc: RemoteDoc | null = null) {
    this.doc = doc
  }
  async load() {
    return this.doc ? { ...this.doc } : null
  }
  async save(d: AppData, expected: number | null) {
    if (this.interfereOnce) {
      const f = this.interfereOnce
      this.interfereOnce = null
      f()
    }
    const current = this.doc?.version ?? null
    if (current !== expected) return null
    this.saves++
    this.doc = { data: d, version: (current ?? 0) + 1, updatedAt: NOW }
    return this.doc.version
  }
}
const remote = (d: AppData, version: number): RemoteDoc => ({ data: d, version, updatedAt: NOW })
const meta = (over: Partial<SyncMeta> = {}): SyncMeta => ({ ...EMPTY_META, userId: 'u1', ...over })

describe('fusion', () => {
  it('garde les journées des deux côtés', () => {
    const m = mergeData(data([e('2026-08-01', 100)]), data([e('2026-08-02', 200)]))
    expect(m.entries.map((x) => x.date)).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('même jour sur deux appareils : la modification la plus récente gagne, quel que soit l’ordre de synchro', () => {
    const older = data([e('2026-08-01', 100, '2026-11-01T10:00:00Z')])
    const newer = data([e('2026-08-01', 900, '2026-11-02T10:00:00Z')])
    expect(mergeData(older, newer).entries[0].amount).toBe(90000)
    expect(mergeData(newer, older).entries[0].amount).toBe(90000)
  })

  it('une journée supprimée ne revient pas', () => {
    const a = data([], { deleted: { 'e:2026-08-01': '2026-11-03T00:00:00Z' } })
    const b = data([e('2026-08-01', 100, '2026-11-01T00:00:00Z')])
    expect(mergeData(a, b).entries).toHaveLength(0)
    expect(mergeData(b, a).entries).toHaveLength(0)
  })

  it('une journée ressaisie APRÈS sa suppression revient', () => {
    const a = data([], { deleted: { 'e:2026-08-01': '2026-11-03T00:00:00Z' } })
    const b = data([e('2026-08-01', 100, '2026-11-05T00:00:00Z')])
    expect(mergeData(a, b).entries).toHaveLength(1)
  })

  it('les réglages les plus récents gagnent', () => {
    const a = data([], { settings: { ...EMPTY_DATA.settings, personalExpenses: 1, updatedAt: '2026-11-01T00:00:00Z' } })
    const b = data([], { settings: { ...EMPTY_DATA.settings, personalExpenses: 2, updatedAt: '2026-11-02T00:00:00Z' } })
    expect(mergeData(a, b).settings.personalExpenses).toBe(2)
  })

  it('compare deux copies sans tenir compte de l’ordre', () => {
    expect(sameData(data([e('2026-08-01', 1), e('2026-08-02', 2)]), data([e('2026-08-02', 2), e('2026-08-01', 1)]))).toBe(true)
    expect(isEmptyData(EMPTY_DATA)).toBe(true)
  })
})

describe('synchronisation', () => {
  it('envoie les données de l’appareil quand rien n’est en ligne', async () => {
    const store = new FakeStore()
    const r = await syncOnce(data([e('2026-08-01', 100)]), meta(), store, 'u1', NOW)
    expect(r.kind).toBe('pushed')
    expect(store.doc!.data.entries).toHaveLength(1)
  })

  it('ne fait rien quand tout est à jour', async () => {
    const d = data([e('2026-08-01', 100)])
    const store = new FakeStore(remote(d, 3))
    expect((await syncOnce(d, meta({ version: 3 }), store, 'u1', NOW)).kind).toBe('uptodate')
    expect(store.saves).toBe(0)
  })

  it('envoie les modifications locales', async () => {
    const store = new FakeStore(remote(data([e('2026-08-01', 100)]), 3))
    const r = await syncOnce(data([e('2026-08-01', 100), e('2026-08-02', 200)]), meta({ version: 3, dirty: true }), store, 'u1', NOW)
    expect(r.kind).toBe('pushed')
    expect(store.doc!.data.entries).toHaveLength(2)
  })

  it('récupère les données du compte sur un appareil neuf', async () => {
    const r = await syncOnce(EMPTY_DATA, meta(), new FakeStore(remote(data([e('2026-08-01', 100)]), 2)), 'u1', NOW)
    expect(r.kind).toBe('pulled')
  })

  it('fusionne quand les deux côtés ont changé', async () => {
    const store = new FakeStore(remote(data([e('2026-08-01', 100), e('2026-08-15', 300)]), 5))
    const r = await syncOnce(data([e('2026-08-01', 100), e('2026-08-08', 200)]), meta({ version: 4, dirty: true }), store, 'u1', NOW)
    expect(r.kind).toBe('merged')
    expect(store.doc!.data.entries.map((x) => x.date)).toEqual(['2026-08-01', '2026-08-08', '2026-08-15'])
  })

  it('premier lien d’un appareil qui avait des données sans compte : tout est gardé', async () => {
    const store = new FakeStore(remote(data([e('2026-08-15', 300)]), 2))
    const r = await syncOnce(data([e('2026-08-01', 100)]), meta({ userId: null }), store, 'u1', NOW)
    expect(r.kind).toBe('merged')
    expect(store.doc!.data.entries).toHaveLength(2)
  })

  it('UN AUTRE COMPTE sur le même téléphone ne reçoit jamais les données du précédent', async () => {
    const store = new FakeStore(null)
    const erin = data([e('2026-07-04', 777)])
    const r = await syncOnce(erin, meta({ userId: 'erin', version: 4 }), store, 'frank', NOW)
    expect(r.kind).toBe('pulled')
    if (r.kind === 'pulled') expect(r.data.entries).toHaveLength(0)
    expect(store.doc!.data.entries).toHaveLength(0)
  })

  it('… et récupère ses propres données s’il en a', async () => {
    const store = new FakeStore(remote(data([e('2026-09-05', 50)]), 3))
    const r = await syncOnce(data([e('2026-07-04', 777)]), meta({ userId: 'erin', version: 4 }), store, 'frank', NOW)
    expect(r.kind).toBe('pulled')
    if (r.kind === 'pulled') expect(r.data.entries.map((x) => x.date)).toEqual(['2026-09-05'])
    expect(store.saves).toBe(0)
  })

  it('réessaie quand la copie change au moment de l’envoi, sans écraser l’autre appareil', async () => {
    const store = new FakeStore(remote(data([e('2026-08-01', 100)]), 3))
    store.interfereOnce = () => {
      store.doc = remote(data([e('2026-08-01', 100), e('2026-08-22', 400)]), 4)
    }
    const r = await syncOnce(data([e('2026-08-01', 100), e('2026-08-08', 200)]), meta({ version: 3, dirty: true }), store, 'u1', NOW)
    expect(r.kind).toBe('merged')
    expect(store.doc!.data.entries.map((x) => x.date).sort()).toEqual(['2026-08-01', '2026-08-08', '2026-08-22'])
  })
})
