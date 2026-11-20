import { describe, expect, it } from 'vitest'
import { mergeData } from './merge'
import type { AppData, Entry } from './types'
import { EMPTY_DATA } from './types'

function e(date: string, euros: number, updatedAt = '2026-11-01T00:00:00Z'): Entry {
  return { id: 'e' + date + euros, date, gross: euros * 200, amount: euros * 100, updatedAt }
}
function data(entries: Entry[] = [], extra: Partial<AppData> = {}): AppData {
  return { ...EMPTY_DATA, entries, ...extra }
}

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

})

