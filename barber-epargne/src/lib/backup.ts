// Sauvegardes au format JSON, sans serveur :
// 1. Copies automatiques sur le téléphone (une par jour, les 14 derniers jours) : on peut revenir en arrière.
// 2. Fichier de sauvegarde à garder dans Fichiers / iCloud Drive / Google Drive (feuille de partage du téléphone).
// 3. Restauration d'un fichier : fusion avec les données actuelles (rien n'est perdu).

import { parseData, scoped } from './storage'
import type { AppData } from './types'

const SNAP_KEY = 'coffre-copies:v1'
const LAST_KEY = 'coffre-derniere-sauvegarde:v1'
const KEEP = 14

export interface Snapshot {
  /** AAAA-MM-JJ */
  day: string
  at: string
  data: AppData
}

export const backupName = (today: string) => `coffre-sauvegarde-${today}.json`

/** Contenu du fichier de sauvegarde : les données de l'app, lisibles telles quelles. */
export function backupJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function listSnapshots(): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(scoped(SNAP_KEY)) || '[]') as Snapshot[]
    return Array.isArray(raw) ? raw.filter((s) => s && typeof s.day === 'string' && s.data) : []
  } catch {
    return []
  }
}

/** Garde une copie du jour (remplace celle du même jour). Les copies vides ne sont pas gardées. */
export function snapshot(data: AppData, today: string, now = new Date().toISOString()): Snapshot[] {
  if (data.entries.length === 0 && data.bilans.length === 0) return listSnapshots()
  const list = [{ day: today, at: now, data }, ...listSnapshots().filter((s) => s.day !== today)].sort((a, b) => b.day.localeCompare(a.day)).slice(0, KEEP)
  try {
    localStorage.setItem(scoped(SNAP_KEY), JSON.stringify(list))
  } catch {
    // Stockage plein : on garde au moins la copie du jour.
    try {
      localStorage.setItem(scoped(SNAP_KEY), JSON.stringify(list.slice(0, 1)))
    } catch {
      /* ignoré */
    }
  }
  return list
}

export function snapshotData(s: Snapshot): AppData | null {
  return parseData(s.data)
}

export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(scoped(LAST_KEY))
  } catch {
    return null
  }
}
export function markBackedUp(now = new Date().toISOString()): void {
  try {
    localStorage.setItem(scoped(LAST_KEY), now)
  } catch {
    /* ignoré */
  }
}

/** Un rappel de sauvegarde est utile : des données, et pas de fichier gardé depuis 7 jours. */
export function backupDue(data: AppData, last: string | null, now = Date.now()): boolean {
  if (data.entries.length === 0) return false
  if (!last) return true
  return now - Date.parse(last) > 7 * 86400000
}

/**
 * Enregistre le fichier de sauvegarde. Sur iPhone : feuille de partage (« Enregistrer dans Fichiers » → iCloud Drive,
 * Google Drive…). Ailleurs : téléchargement. Renvoie 'cancelled' si la personne ferme la feuille de partage.
 */
export async function saveBackupFile(data: AppData, today: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = backupName(today)
  const json = backupJson(data)
  const file = typeof File !== 'undefined' ? new File([json], name, { type: 'application/json' }) : null
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Sauvegarde Coffre' })
      markBackedUp()
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Partage impossible : on retombe sur le téléchargement.
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  markBackedUp()
  return 'downloaded'
}
