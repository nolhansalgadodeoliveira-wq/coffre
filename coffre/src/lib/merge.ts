// Fusion de deux copies des données (import d'un fichier de sauvegarde) : chaque journée et chaque bilan portent
// leur date de modification ; en cas de doublon, la plus récente gagne, et une suppression plus récente efface.

import type { AppData, Bilan, Entry } from './types'

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

  return { version: 2, entries, bilans, days: { ...other.days, ...preferred.days }, deleted, settings }
}
