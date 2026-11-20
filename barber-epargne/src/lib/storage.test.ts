import { describe, expect, it } from 'vitest'
import { parseData, toCsv } from './storage'

describe('conversion des anciennes données (par week-end)', () => {
  it('un week-end avec détail devient un samedi et un dimanche', () => {
    const d = parseData({
      weekends: [{ id: 'a', date: '2026-10-31', amount: 35000, sat: 20000, sun: 15000, satGross: 40000, sunGross: 30000, clients: 16 }],
      bilans: [],
      settings: { personalExpenses: 30000, goalAmount: 600000, goalDate: '2027-04-01' },
    })!
    expect(d.version).toBe(2)
    expect(d.entries.map((e) => [e.date, e.gross, e.amount])).toEqual([
      ['2026-10-31', 40000, 20000],
      ['2026-11-01', 30000, 15000],
    ])
    expect(d.entries[0].clients).toBe(16)
    expect(d.settings.goals.map((g) => g.amount)).toEqual([600000]) // l'ancien objectif unique devient le premier objectif
    expect(d.settings.keepPct).toBe(50)
    expect(d.settings.workdays).toEqual([6, 0])
    expect(d.settings.onboarded).toBe(false) // la présentation sera montrée une fois
  })

  it('un week-end sans dimanche saisi ne crée pas de dimanche', () => {
    const d = parseData({ weekends: [{ id: 'a', date: '2026-11-14', amount: 20000, sat: 20000, sun: 0, satGross: 40000 }], bilans: [] })!
    expect(d.entries).toHaveLength(1)
  })

  it('un très ancien week-end saisi en un seul montant va sur le samedi', () => {
    const d = parseData({ weekends: [{ id: 'a', date: '2026-10-03', amount: 26500, gross: 53000 }], bilans: [] })!
    expect(d.entries).toEqual([{ id: 'a', date: '2026-10-03', gross: 53000, amount: 26500, updatedAt: expect.any(String) }])
  })

  it('un ancien bilan par 4 week-ends est rattaché au mois de son dernier week-end', () => {
    const d = parseData({
      weekends: ['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17'].map((date, i) => ({ id: 'w' + i, date, amount: 1000 })),
      bilans: [{ id: 'x', weekendIds: ['w0', 'w1', 'w2', 'w3'], expensesKept: true, actual: 78000 }],
    })!
    expect(d.bilans[0].month).toBe('2026-10')
  })

  it('le format de la version précédente (bilans par mois) est repris', () => {
    const d = parseData({ weekends: [{ id: 'a', date: '2026-10-03', amount: 100 }], bilans: [{ id: '1', month: '2026-10', actual: 100 }, { id: '2', month: '2026-10', actual: 200 }] })!
    expect(d.bilans).toHaveLength(1)
  })
})

describe('import et données abîmées', () => {
  it('refuse ce qui n’est pas une sauvegarde', () => {
    expect(parseData(null)).toBeNull()
    expect(parseData([])).toBeNull()
    expect(parseData({ a: 1 })).toBeNull()
  })

  it('écarte les doublons de date (garde la modification la plus récente) et rend les identifiants uniques', () => {
    const d = parseData({
      entries: [
        { id: 'x', date: '2026-11-07', gross: 10000, amount: 5000, updatedAt: '2026-11-07T10:00:00Z' },
        { id: 'y', date: '2026-11-07', gross: 20000, amount: 10000, updatedAt: '2026-11-08T10:00:00Z' },
        { id: 'x', date: '2026-11-08', gross: 30000, amount: 15000, updatedAt: '2026-11-08T10:00:00Z' },
      ],
      bilans: [],
    })!
    expect(d.entries).toHaveLength(2)
    expect(d.entries.find((e) => e.date === '2026-11-07')!.amount).toBe(10000)
    expect(new Set(d.entries.map((e) => e.id)).size).toBe(2)
  })

  it('rejette les montants et dates absurdes, plafonne les pourcentages', () => {
    const d = parseData({
      entries: [
        { id: 'a', date: '2026-11-07', gross: 5e21, amount: 1 },
        { id: 'b', date: '0001-01-01', gross: 100, amount: 50 },
        { id: 'c', date: '2026-02-30', gross: 100, amount: 50 },
        { id: 'd', date: '2026-11-08', gross: 100, amount: 50, clients: 1e9 },
      ],
      bilans: [],
      settings: { commission: { enabled: true, mode: 'percent', value: 20000 }, keepPct: 500, workdays: [9, 'x'] },
    })!
    expect(d.entries.map((e) => e.id)).toEqual(['d'])
    expect(d.entries[0].clients).toBeUndefined()
    expect(d.settings.commission.value).toBe(100)
    expect(d.settings.keepPct).toBe(50)
    expect(d.settings.workdays).toEqual([6, 0])
  })

  it('export tableur lisible par Excel en français', () => {
    const d = parseData({ entries: [{ id: 'a', date: '2026-11-07', gross: 24550, amount: 12275, clients: 9 }], bilans: [] })!
    expect(toCsv(d)).toBe('\ufeffdate;encaissé;coupes au salon;produits vendus;pourboires;à domicile;autres;ta part;part gardée (%);clients\r\n2026-11-07;245,50;245,50;0,00;0,00;0,00;0,00;122,75;;9')
  })
})
