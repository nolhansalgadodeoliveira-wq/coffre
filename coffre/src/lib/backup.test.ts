import { beforeEach, describe, expect, it } from 'vitest'
import { backupDue, backupJson, listSnapshots, snapshot } from './backup'
import { parseData } from './storage'
import { EMPTY_DATA, type AppData } from './types'

const mem = new Map<string, string>()
beforeEach(() => {
  mem.clear()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  } as Storage
})

const withDay = (date: string): AppData => ({ ...EMPTY_DATA, entries: [{ id: date, date, gross: 20000, amount: 10000, updatedAt: '2026-11-01T00:00:00.000Z' }] })

describe('sauvegardes JSON', () => {
  it('le fichier de sauvegarde se relit à l’identique', () => {
    const d = withDay('2026-11-14')
    expect(parseData(JSON.parse(backupJson(d)))).toEqual(d)
  })
  it('une copie par jour, 14 jours maximum, la plus récente d’abord', () => {
    for (let i = 1; i <= 20; i++) snapshot(withDay(`2026-11-${String(i).padStart(2, '0')}`), `2026-11-${String(i).padStart(2, '0')}`)
    snapshot(withDay('2026-11-20'), '2026-11-20')
    const list = listSnapshots()
    expect(list).toHaveLength(14)
    expect(list[0].day).toBe('2026-11-20')
  })
  it('pas de copie quand il n’y a rien', () => {
    snapshot(EMPTY_DATA, '2026-11-20')
    expect(listSnapshots()).toHaveLength(0)
  })
  it('rappel de sauvegarde après 7 jours', () => {
    const now = Date.parse('2026-11-20T12:00:00Z')
    expect(backupDue(EMPTY_DATA, null, now)).toBe(false)
    expect(backupDue(withDay('2026-11-14'), null, now)).toBe(true)
    expect(backupDue(withDay('2026-11-14'), '2026-11-18T12:00:00Z', now)).toBe(false)
    expect(backupDue(withDay('2026-11-14'), '2026-11-10T12:00:00Z', now)).toBe(true)
  })
})
