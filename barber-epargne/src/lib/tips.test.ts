import { describe, expect, it } from 'vitest'
import { parseData } from './storage'
import { EMPTY_DATA } from './types'

describe('pourboires', () => {
  it('sont gardés tels quels et acceptés dans le montant', () => {
    const e = { id: 'a', date: '2026-08-15', gross: 27500, amount: 11000 + 2500, tips: 2500, updatedAt: '2026-11-01T00:00:00.000Z' }
    const d = parseData({ ...EMPTY_DATA, entries: [e] })
    expect(d?.entries[0]).toMatchObject({ gross: 27500, amount: 13500, tips: 2500 })
  })
})
