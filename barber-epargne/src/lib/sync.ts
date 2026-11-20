// Synchronisation avec le compte en ligne. Logique pure (sans réseau ni React) : le « magasin »
// distant est passé en paramètre, ce qui permet de la tester avec un faux serveur.
//
// Principe : l'app marche toujours d'abord sur le téléphone. Le compte garde UNE copie de toutes les
// données, avec un numéro de version. Un appareil n'écrase la copie en ligne que s'il part de la dernière
// version connue ; sinon il fusionne d'abord. Chaque journée et chaque bilan portent leur date de
// modification : en cas de doublon, la modification la plus récente gagne, et une suppression aussi.

import type { AppData, Bilan, Entry, Expense } from './types'
import { EMPTY_DATA } from './types'

export interface RemoteDoc {
  data: AppData
  version: number
  updatedAt: string
}

export interface CloudStore {
  load(): Promise<RemoteDoc | null>
  /** `expectedVersion` = version qu'on croit en ligne (null : création). Renvoie la nouvelle version, ou null si elle a changé entre-temps. */
  save(data: AppData, expectedVersion: number | null): Promise<number | null>
}

export interface SyncMeta {
  /** Compte auquel appartiennent les données de cet appareil (null : données créées sans compte). */
  userId: string | null
  version: number | null
  dirty: boolean
  lastSyncAt: string | null
}

export const EMPTY_META: SyncMeta = { userId: null, version: null, dirty: false, lastSyncAt: null }

export type SyncResult =
  | { kind: 'uptodate'; meta: SyncMeta }
  | { kind: 'pushed'; meta: SyncMeta }
  | { kind: 'pulled'; data: AppData; meta: SyncMeta }
  | { kind: 'merged'; data: AppData; meta: SyncMeta }

const MAX_ATTEMPTS = 4

export function isEmptyData(d: AppData): boolean {
  return d.entries.length === 0 && d.bilans.length === 0 && (d.expenses?.length ?? 0) === 0
}

export function sameData(a: AppData, b: AppData): boolean {
  const norm = (d: AppData) =>
    JSON.stringify({
      e: [...d.entries].sort((x, y) => x.date.localeCompare(y.date)),
      b: [...d.bilans].sort((x, y) => x.month.localeCompare(y.month)),
      d: Object.entries(d.days).sort(([x], [y]) => x.localeCompare(y)),
      xp: d.expenses ?? [],
      x: Object.entries(d.deleted).sort(([x], [y]) => x.localeCompare(y)),
      s: d.settings,
    })
  return norm(a) === norm(b)
}

/** Fusion clé par clé : la version la plus récente gagne ; une suppression plus récente efface. À égalité, `preferred` gagne. */
function mergeKeyed<T extends { updatedAt: string }>(
  preferred: T[],
  other: T[],
  key: (t: T) => string,
  deleted: Record<string, string>,
  prefix: string,
): T[] {
  const map = new Map<string, T>()
  for (const t of other) map.set(key(t), t)
  for (const t of preferred) {
    const cur = map.get(key(t))
    if (!cur || t.updatedAt >= cur.updatedAt) map.set(key(t), t)
  }
  return [...map.values()].filter((t) => {
    const del = deleted[prefix + key(t)]
    return !del || t.updatedAt > del
  })
}

export function mergeData(preferred: AppData, other: AppData): AppData {
  const deleted: Record<string, string> = { ...other.deleted }
  for (const [k, v] of Object.entries(preferred.deleted)) if (!deleted[k] || v > deleted[k]) deleted[k] = v

  const entries = mergeKeyed<Entry>(preferred.entries, other.entries, (e) => e.date, deleted, 'e:').sort((a, b) => a.date.localeCompare(b.date))
  const bilans = mergeKeyed<Bilan>(preferred.bilans, other.bilans, (b) => b.month, deleted, 'b:').sort((a, b) => a.month.localeCompare(b.month))
  const settings = preferred.settings.updatedAt >= other.settings.updatedAt ? preferred.settings : other.settings

  const expenses = mergeKeyed<Expense>(preferred.expenses ?? [], other.expenses ?? [], (x) => x.id, deleted, 'x:').sort((a, b) => a.date.localeCompare(b.date))
  return { version: 2, entries, bilans, days: { ...other.days, ...preferred.days }, deleted, expenses, settings }
}

const done = (meta: SyncMeta, version: number, now: string): SyncMeta => ({ ...meta, version, dirty: false, lastSyncAt: now })

/** Une passe de synchronisation. */
export async function syncOnce(local: AppData, meta: SyncMeta, store: CloudStore, userId: string, now: string): Promise<SyncResult> {
  // Données d'un AUTRE compte sur cet appareil : on ne les mélange jamais au compte qui se connecte.
  const foreign = meta.userId !== null && meta.userId !== userId
  const m: SyncMeta = meta.userId === userId ? meta : { userId, version: null, dirty: false, lastSyncAt: null }
  const mine = foreign ? EMPTY_DATA : local

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const remote = await store.load()

    if (!remote) {
      const v = await store.save(mine, null)
      if (v === null) continue
      return foreign ? { kind: 'pulled', data: mine, meta: done(m, v, now) } : { kind: 'pushed', meta: done(m, v, now) }
    }

    if (foreign) return { kind: 'pulled', data: remote.data, meta: done(m, remote.version, now) }

    if (m.version === remote.version) {
      if (!m.dirty) return { kind: 'uptodate', meta: { ...m, lastSyncAt: now } }
      const v = await store.save(local, remote.version)
      if (v === null) continue
      return { kind: 'pushed', meta: done(m, v, now) }
    }

    // Première fois avec ce compte : données créées sans compte sur cet appareil.
    if (m.version === null) {
      if (isEmptyData(local)) return { kind: 'pulled', data: remote.data, meta: done(m, remote.version, now) }
      if (sameData(local, remote.data)) return { kind: 'uptodate', meta: done(m, remote.version, now) }
    } else if (!m.dirty && remote.version > m.version) {
      // Changement venu d'un autre appareil, rien de neuf ici.
      return { kind: 'pulled', data: remote.data, meta: done(m, remote.version, now) }
    }

    // Modifié des deux côtés : fusion, la modification la plus récente gagne.
    const merged = mergeData(local, remote.data)
    const v = await store.save(merged, remote.version)
    if (v === null) continue
    return { kind: 'merged', data: merged, meta: done(m, v, now) }
  }
  throw new Error('conflit')
}
