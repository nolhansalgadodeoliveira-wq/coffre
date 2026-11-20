import { describe, expect, it } from 'vitest'
import { autoSaved, categoryTotals, entryCategories, expenseTotals, monthProjection } from './calc'
import { PROFESSIONS, searchProfessions } from './professions'
import { parseData } from './storage'
import { mergeData } from './sync'
import { EMPTY_DATA, type AppData, type Entry, type Expense } from './types'

const T = '2026-11-01T00:00:00.000Z'
const clim = PROFESSIONS.find((p) => p.id === 'clim')!
const climData = (entries: Entry[] = [], expenses: Expense[] = []): AppData => ({
  ...EMPTY_DATA,
  entries,
  expenses,
  settings: { ...EMPTY_DATA.settings, keepPct: 100, personalExpenses: 100000, onboarded: true, profession: { id: 'clim', label: 'Installateur clim' }, incomeCats: clim.income, expenseCats: clim.expenses },
})
const day = (date: string, euros: number, parts?: Record<string, number>): Entry => ({ id: date, date, gross: euros * 100, amount: euros * 100, ...(parts ? { parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v * 100])) } : {}), updatedAt: T })
const exp = (id: string, date: string, euros: number, cat = 'fournitures'): Expense => ({ id, date, cat, amount: euros * 100, updatedAt: T })

describe('métiers', () => {
  it('reconnaît les métiers à revenus variables les plus courants', () => {
    const cases: [string, string][] = [
      ['installateur clim', 'clim'], ['Plombier chauffagiste', 'clim'], ['électricien', 'electricien'], ['maçon', 'batiment'], ['carreleur', 'batiment'],
      ['chauffeur Uber', 'vtc'], ['taxi', 'vtc'], ['livreur Deliveroo', 'livreur'], ['infirmière libérale', 'sante'], ['kiné', 'sante'],
      ['coiffeuse', 'barbier'], ['prothésiste ongulaire', 'esthetique'], ['développeur freelance', 'freelance'], ['graphiste', 'creatif'], ['photographe', 'photo'],
      ['agent immobilier', 'immobilier'], ['food truck', 'restauration'], ['femme de ménage', 'domicile'], ['coach sportif', 'coach'], ['avocat', 'liberal'], ['Airbnb', 'location'], ['agriculteur', 'agriculture'],
    ]
    for (const [q, id] of cases) expect(searchProfessions(q, 1)[0]?.id, q).toBe(id)
  })
  it('chaque métier a au moins une catégorie de recette et des identifiants uniques', () => {
    for (const p of PROFESSIONS) {
      expect(p.income.length).toBeGreaterThan(0)
      expect(new Set(p.income.map((c) => c.id)).size).toBe(p.income.length)
      expect(new Set(p.expenses.map((c) => c.id)).size).toBe(p.expenses.length)
    }
  })
})

describe('catégories et dépenses', () => {
  it('le reste de l’encaissé va à la première catégorie ; une catégorie inconnue va dans « autres »', () => {
    const d = climData()
    expect(entryCategories(day('2026-11-03', 500, { depannages: 150, vieux: 50 }), d.settings)).toMatchObject({ installations: 30000, depannages: 15000, autres: 5000 })
    expect(categoryTotals([day('2026-11-03', 500), day('2026-11-04', 200, { entretiens: 200 })], d.settings)).toMatchObject({ installations: 50000, entretiens: 20000 })
  })
  it('l’épargne d’un mois = recettes − dépenses − dépenses perso', () => {
    const d = climData([day('2026-10-05', 3000), day('2026-10-12', 2000)], [exp('a', '2026-10-06', 800), exp('b', '2026-10-20', 200, 'vehicule')])
    expect(autoSaved(d, '2026-10')).toBe(500000 - 100000 - 100000)
    expect(expenseTotals(d.expenses, d.settings)).toEqual({ fournitures: 80000, vehicule: 20000 })
  })
  it('les mois à venir comptent les dépenses habituelles', () => {
    const d = climData([day('2026-10-05', 3000)], [exp('a', '2026-10-06', 900)])
    expect(monthProjection(d, '2026-12', '2026-11-19', 30000).costs).toBe(90000)
  })
  it('les dépenses se fusionnent entre appareils et une suppression ne revient pas', () => {
    const a = climData([], [exp('a', '2026-10-06', 100), exp('b', '2026-10-07', 50)])
    const b = { ...climData([], [exp('a', '2026-10-06', 100)]), deleted: { 'x:b': '2026-11-02T00:00:00.000Z' } }
    expect(mergeData(a, b).expenses.map((x) => x.id)).toEqual(['a'])
  })
  it('lecture d’un fichier : dépenses et catégories gardées', () => {
    const d = parseData(JSON.parse(JSON.stringify(climData([day('2026-10-05', 300, { depannages: 100 })], [exp('a', '2026-10-06', 100)]))))!
    expect(d.expenses).toHaveLength(1)
    expect(d.settings.profession?.id).toBe('clim')
    expect(d.settings.expenseCats?.length).toBe(clim.expenses.length)
    expect(d.entries[0].parts).toEqual({ depannages: 10000 })
  })
})
