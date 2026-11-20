import { describe, expect, it } from 'vitest'
import {
  bilanFigures,
  commissionFor,
  dayStatus,
  entriesOfMonth,
  firstDueMonth,
  gap,
  goalProgress,
  goalsPlan,
  nextGoal,
  isPlanned,
  monthSummary,
  monthTotals,
  myShare,
  pendingDays,
  dailyAverage,
  monthProjection,
  plural,
  projection,
  savedBilanFigures,
  sum,
  suggestedDay,
  validateEntry,
  workedDaysInMonth,
  changeWorkdays,
} from './calc'
import { addDays, addMonths, deMonth, formatDayLong, formatWeekRange, lastDayOfMonth, mondayOf, saturdayOf, weekday } from './dates'
import { centsToInput, formatEuros, formatSigned, parseEuros } from './money'
import { computeStats } from './stats'
import { compliments, nextCompliment } from './compliments'
import type { AppData, Bilan, Commission, Entry, Goal, Settings } from './types'
import { EMPTY_DATA } from './types'

const NO_COM: Commission = { enabled: false, mode: 'percent', value: 0 }
const T = '2026-01-01T00:00:00.000Z'

/** Une journée : `euros` = ta part (encaissé = le double, comme avec 50 % gardés). */
function e(date: string, euros: number, clients?: number): Entry {
  return { id: 'e' + date, date, gross: euros * 200, amount: euros * 100, ...(clients != null ? { clients } : {}), updatedAt: T }
}
/** `goalAmount` / `goalDate` / `goalName` : raccourci pour un seul objectif. */
type TestSettings = Partial<Settings> & { goalAmount?: number; goalDate?: string; goalName?: string }
function data(partial: Omit<Partial<AppData>, 'settings'> & { settings?: TestSettings } = {}): AppData {
  const { goalAmount, goalDate, goalName, ...rest } = partial.settings ?? {}
  const goals: Goal[] = goalAmount ? [{ id: 'g1', name: goalName ?? 'Mariage', emoji: '💍', amount: goalAmount, date: goalDate ?? '2027-04-01', createdAt: T }] : (rest.goals ?? [])
  return { ...EMPTY_DATA, ...partial, settings: { ...EMPTY_DATA.settings, onboarded: true, ...rest, goals } }
}
const goal = (id: string, name: string, euros: number, date: string, extra: Partial<Goal> = {}): Goal => ({ id, name, emoji: '🎯', amount: euros * 100, date, createdAt: T, ...extra })
function bilan(month: string, actualEuros: number, extra: Partial<Bilan> = {}): Bilan {
  return { id: 'b' + month, month, expensesKept: true, actual: actualEuros * 100, personalExpenses: 30000, commission: NO_COM, createdAt: '2026-11-01', updatedAt: T, ...extra }
}

// Octobre 2026 : samedis 3, 10, 17, 24, 31 et dimanches 4, 11, 18, 25.
const OCT = [e('2026-10-03', 200), e('2026-10-04', 150), e('2026-10-10', 220), e('2026-10-11', 160)]

describe('part gardée', () => {
  it('calcule ta part selon le pourcentage choisi', () => {
    expect(myShare(50000, 50)).toBe(25000)
    expect(myShare(50000, 100)).toBe(50000)
    expect(myShare(12345, 50)).toBe(6173)
    expect(myShare(10000, 37.5)).toBe(3750)
  })
})

describe('jours prévus', () => {
  it('suivent les jours habituels choisis (par défaut samedi et dimanche)', () => {
    const d = data()
    expect(dayStatus(d, '2026-11-21')).toBe('prevu') // samedi
    expect(dayStatus(d, '2026-11-22')).toBe('prevu') // dimanche
    expect(dayStatus(d, '2026-11-23')).toBe('repos') // lundi
  })

  it('marchent avec n’importe quels jours habituels', () => {
    const d = data({ settings: { workdays: [2, 3, 4, 5, 6] } }) // du mardi au samedi
    expect(isPlanned(d, '2026-11-24')).toBe(true) // mardi
    expect(isPlanned(d, '2026-11-22')).toBe(false) // dimanche
    expect(isPlanned(d, '2026-11-23')).toBe(false) // lundi
  })

  it('un repos exceptionnel ou un jour en plus du calendrier prime sur l’habitude', () => {
    const d = data({ days: { '2026-11-21': 'repos', '2026-11-25': 'extra' } })
    expect(isPlanned(d, '2026-11-21')).toBe(false)
    expect(isPlanned(d, '2026-11-25')).toBe(true)
  })

  it('compte les jours du mois', () => {
    const d = data({ days: { '2026-11-01': 'repos', '2026-11-12': 'extra', '2026-11-13': 'extra' }, entries: [e('2026-11-07', 100)] })
    // Novembre 2026 : 9 jours de week-end, dont 1 en repos, + 2 en plus.
    expect(workedDaysInMonth(d, '2026-11')).toEqual({ planned: 8, extra: 2, entered: 1 })
  })

  it('liste les jours prévus pas encore saisis, du plus récent au plus ancien', () => {
    const d = data({ entries: [e('2026-11-01', 100), e('2026-11-14', 100)] })
    expect(pendingDays(d, '2026-11-19', 14)).toEqual(['2026-11-15', '2026-11-08', '2026-11-07'])
  })

  it('changer ses jours habituels ne touche pas au passé', () => {
    // Novembre : il travaillait le week-end, il passe au vendredi + samedi le 19.
    const d = data({ entries: [e('2026-11-07', 100), e('2026-11-14', 100)] })
    const days = changeWorkdays(d, [5, 6], '2026-11-19')
    const after = { ...d, days, settings: { ...d.settings, workdays: [5, 6] } }
    expect(pendingDays(after, '2026-11-19', 14)).toEqual(['2026-11-15', '2026-11-08']) // les dimanches passés restent dus, aucun vendredi passé réclamé
    expect(pendingDays(after, '2026-11-20', 0)).toEqual(['2026-11-20']) // à partir d'aujourd'hui : vendredi
  })

  it('ne réclame jamais les jours d’avant tes débuts dans l’app', () => {
    const d = data({ entries: [e('2026-11-14', 100)] })
    expect(pendingDays(d, '2026-11-19', 14)).toEqual(['2026-11-15'])
    expect(pendingDays(data(), '2026-11-19', 14)).toEqual([])
  })
})

describe('jour proposé à la saisie', () => {
  const today = '2026-11-19' // jeudi
  it('mois en cours : le jour prévu le plus RÉCENT pas encore saisi', () => {
    expect(suggestedDay(data(), undefined, today)).toBe('2026-11-15') // première saisie : le dernier jour habituel
    expect(suggestedDay(data({ entries: [e('2026-11-01', 1), e('2026-11-15', 1)] }), '2026-11', today)).toBe('2026-11-14')
  })
  it('tout est saisi : aujourd’hui (jamais un jour déjà saisi)', () => {
    const all = ['2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15'].map((x) => e(x, 1))
    expect(suggestedDay(data({ entries: all }), '2026-11', today)).toBe(today)
  })
  it('mois passé consulté : son premier jour prévu libre (pour rattraper un mois)', () => {
    expect(suggestedDay(data(), '2026-08', today)).toBe('2026-08-01')
    expect(suggestedDay(data({ entries: [e('2026-08-01', 1)] }), '2026-08', today)).toBe('2026-08-02')
  })
})

describe('mois et bilan', () => {
  it('chaque jour compte dans son mois (samedi 31 en octobre, dimanche 1er en novembre)', () => {
    const d = data({ entries: [e('2026-10-31', 100), e('2026-11-01', 80)] })
    expect(sum(entriesOfMonth(d, '2026-10'))).toBe(10000)
    expect(sum(entriesOfMonth(d, '2026-11'))).toBe(8000)
    expect([...monthTotals(d).values()].reduce((a, b) => a + b, 0)).toBe(18000)
  })

  it('le bilan est prêt quand le dernier jour prévu du mois est saisi', () => {
    const d = data({ entries: [...OCT, e('2026-10-31', 100)] })
    const s = monthSummary(d, '2026-10', '2026-10-31')
    expect(s.lastPlanned).toBe('2026-10-31')
    expect(s.due).toBe(true)
  })

  it('le bilan est prêt aussi quand le mois est terminé', () => {
    const d = data({ entries: OCT })
    expect(monthSummary(d, '2026-10', '2026-10-30').due).toBe(false)
    expect(monthSummary(d, '2026-10', '2026-11-01').due).toBe(true)
    expect(firstDueMonth(d, '2026-11-01')).toBe('2026-10')
  })

  it('avec d’autres jours habituels, le dernier jour prévu change', () => {
    const d = data({ settings: { workdays: [1, 2, 3, 4, 5] } }) // semaine
    expect(monthSummary(d, '2026-10', '2026-10-01').lastPlanned).toBe('2026-10-30') // vendredi
  })

  it('calcule le montant attendu', () => {
    expect(bilanFigures(110000, 30000, NO_COM).expected).toBe(80000)
    expect(bilanFigures(15000, 30000, NO_COM).expected).toBe(0)
    expect(bilanFigures(110000, 30000, { enabled: true, mode: 'percent', value: 10 }).expected).toBe(69000)
    expect(bilanFigures(110000, 30000, { enabled: true, mode: 'fixed', value: 5000 }).commission).toBe(5000)
    expect(commissionFor(3000, { enabled: true, mode: 'fixed', value: 5000 })).toBe(3000)
    expect(commissionFor(10000, { enabled: true, mode: 'percent', value: 999 })).toBe(10000) // plafonné à 100 %
  })

  it('un bilan validé garde ses chiffres même si on modifie un jour ensuite', () => {
    const b = bilan('2026-10', 700, { total: 73000, expected: 43000 })
    const d = data({ entries: [...OCT, e('2026-10-17', 900)], bilans: [b] })
    const f = savedBilanFigures(b, d)
    expect(f.total).toBe(73000)
    expect(f.expected).toBe(43000)
    expect(f.gap).toBe(27000)
    expect(f.changed).toBe(true)
    expect(f.currentTotal).toBe(163000)
  })

  it('un ancien bilan sans chiffres figés se calcule sur le mois', () => {
    const f = savedBilanFigures(bilan('2026-10', 400), data({ entries: OCT }))
    expect(f.total).toBe(73000)
    expect(f.gap).toBe(40000 - 43000)
    expect(f.changed).toBe(false)
  })

  it('écart signé', () => {
    expect(gap(85000, 80000)).toBe(5000)
    expect(gap(70000, 80000)).toBe(-10000)
  })
})

describe('projection : même gain sur tous les jours prévus', () => {
  const today = '2026-11-19' // jeudi
  // Le cas de Nolhan : il vient de lancer l'app, un seul samedi saisi (200 € encaissés, 100 € de sa part).
  const first = data({ entries: [e('2026-11-14', 100)], settings: { goalAmount: 800000, goalDate: '2027-04-01' } })

  it('le gain moyen par jour est celui des journées saisies', () => {
    expect(dailyAverage(first, today)).toBe(10000)
    expect(dailyAverage(data(), today)).toBe(0)
  })

  it('le mois est estimé en appliquant ce gain à TOUS les jours prévus, passés ou à venir', () => {
    const m = monthProjection(first, '2026-11', today, 10000)
    // Novembre 2026 : samedis 7, 14, 21, 28 + dimanches 1, 8, 15, 22, 29 = 9 jours prévus, 1 saisi.
    expect(m.entered).toBe(10000)
    expect(m.assumedDays).toBe(8)
    expect(m.assumedPast).toBe(1) // seul le 15 est « à saisir » : les 1er, 7 et 8 sont d'avant tes débuts (estimés, pas réclamés)
    expect(m.total).toBe(90000)
    expect(m.expected).toBe(60000) // 900 € − 300 € de dépenses
  })

  it('un jour marqué « repos » dans le calendrier n’est pas compté', () => {
    const d = data({ entries: [e('2026-11-14', 100)], days: { '2026-11-29': 'repos', '2026-11-01': 'repos' } })
    expect(monthProjection(d, '2026-11', today, 10000).assumedDays).toBe(6)
  })

  it('un jour en plus déjà saisi compte avec son vrai montant', () => {
    const d = data({ entries: [e('2026-11-14', 100), e('2026-11-18', 300)], days: { '2026-11-18': 'extra' } })
    const m = monthProjection(d, '2026-11', today, 20000)
    expect(m.entered).toBe(40000)
    expect(m.assumedDays).toBe(8)
  })

  it('l’objectif est estimé mois par mois jusqu’à sa date (mois à 5 week-ends inclus)', () => {
    const p = projection(first, today)
    expect(p.months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
    // jours prévus : 9, 8, 10, 8, 8 ; 100 € par jour ; 300 € de dépenses par mois
    expect(p.months.map((m) => m.total)).toEqual([90000, 80000, 100000, 80000, 80000])
    expect(p.months.map((m) => m.expected)).toEqual([60000, 50000, 70000, 50000, 50000])
    expect(p.projected).toBe(280000)
    expect(p.projectedPct).toBeCloseTo(0.35, 5)
    expect(p.onTrack).toBe(false)
    expect(p.perDay).toBe(10000)
  })

  it('combien mettre de côté par mois, et gagner par jour, pour atteindre l’objectif', () => {
    const p = projection(first, today)
    expect(p.daysLeft).toBe(133)
    expect(p.remaining).toBe(800000)
    expect(p.neededPerMonth).toBe(Math.round(800000 / (133 / 30.44)))
    expect(p.assumedDays).toBe(8 + 8 + 10 + 8 + 8)
    // (8 000 € + 5 mois × 300 € − 100 € déjà gagnés) ÷ 42 jours ≈ 223,81 €
    expect(p.neededPerDay).toBe(Math.round((800000 + 150000 - 10000) / 42))
    // Gagner exactement ce montant sur chaque jour restant fait atteindre l'objectif
    const exact = projection(data({ entries: [e('2026-11-14', 100)], settings: { goalAmount: 800000, goalDate: '2027-04-01' } }), today)
    const need = exact.neededPerDay
    const months = exact.months.map((m) => Math.max(0, m.entered + m.assumedDays * need - m.expenses))
    expect(months.reduce((a, b) => a + b, 0)).toBeGreaterThan(799000)
    expect(months.reduce((a, b) => a + b, 0)).toBeLessThan(801000)
  })

  it('le dernier mois avant l’objectif est calculé au prorata (jusqu’à la date, exclue)', () => {
    const d = data({ entries: [e('2026-11-14', 100)], settings: { goalAmount: 800000, goalDate: '2027-04-15' } })
    const apr = projection(d, today).months.find((m) => m.month === '2027-04')!
    // 1er au 14 avril 2027 : samedis 3, 10 + dimanches 4, 11 = 4 jours ; 14/30 des dépenses
    expect(apr.assumedDays).toBe(4)
    expect(apr.fraction).toBeCloseTo(14 / 30, 5)
    expect(apr.expenses).toBe(Math.round((30000 * 14) / 30))
  })

  it('les mois déjà bilantés comptent pour ce qui a été réellement mis de côté, pas pour une estimation', () => {
    const d = data({
      entries: [e('2026-10-03', 100), e('2026-11-14', 100)],
      bilans: [bilan('2026-10', 700)],
      settings: { goalAmount: 800000, goalDate: '2027-04-01' },
    })
    const p = projection(d, today)
    expect(p.saved).toBe(70000)
    expect(p.months.map((m) => m.month)).not.toContain('2026-10')
    expect(p.projected).toBe(70000 + 280000)
  })

  it('un mois terminé sans bilan compte automatiquement : ta part − dépenses perso (rien n’est inventé)', () => {
    const d = data({ entries: [e('2026-10-03', 500), e('2026-10-04', 500)], settings: { goalAmount: 800000, goalDate: '2027-04-01' } })
    const p = projection(d, today)
    expect(p.saved).toBe(100000 - 30000)
    expect(p.months.map((m) => m.month)).not.toContain('2026-10')
  })

  it('plusieurs mois terminés : total gagné − 300 € par mois travaillé', () => {
    const d = data({ entries: [e('2026-08-08', 2141), e('2026-09-05', 1035), e('2026-10-03', 1152.5)], settings: { goalAmount: 800000, goalDate: '2027-04-01' } })
    expect(projection(d, today).saved).toBe(214100 + 103500 + 115250 - 3 * 30000)
  })

  it('un mois terminé où la part est inférieure aux dépenses ne fait pas baisser l’épargne', () => {
    const d = data({ entries: [e('2026-10-03', 100)], settings: { goalAmount: 800000, goalDate: '2027-04-01' } })
    expect(projection(d, today).saved).toBe(0)
  })

  it('frais du salon : pourcentage sur le total, ou montant fixe par mois', () => {
    const pct = data({ entries: [e('2026-11-14', 100)], settings: { commission: { enabled: true, mode: 'percent', value: 10 } } })
    const m1 = monthProjection(pct, '2026-11', today, 10000)
    expect(m1.commission).toBe(9000)
    expect(m1.expected).toBe(90000 - 9000 - 30000)
    const fixed = data({ entries: [e('2026-11-14', 100)], settings: { commission: { enabled: true, mode: 'fixed', value: 20000 } } })
    expect(monthProjection(fixed, '2026-11', today, 10000).expected).toBe(90000 - 20000 - 30000)
  })

  it('objectif atteint, date passée, aucune donnée', () => {
    const d = data({ entries: [e('2026-11-14', 100)], bilans: [bilan('2026-10', 7000)], settings: { goalAmount: 600000, goalDate: '2027-04-01' } })
    expect(projection(d, today).reached).toBe(true)
    const late = projection(data({ entries: [e('2026-11-14', 100)], settings: { goalAmount: 600000, goalDate: '2027-04-01' } }), '2027-05-10')
    expect(late.passed).toBe(true)
    expect(late.months).toEqual([])
    expect(late.neededPerMonth).toBe(0)
    expect(projection(data({ settings: { goalAmount: 600000 } }), today).projected).toBe(0)
  })

  it('plusieurs objectifs : l’épargne remplit d’abord le plus proche', () => {
    // Août → octobre terminés : 1 000 € de part par mois − 300 € = 700 € × 3 = 2 100 € de côté.
    const entries = [e('2026-08-08', 1000), e('2026-09-05', 1000), e('2026-10-03', 1000)]
    const d = data({ entries, settings: { goals: [goal('mariage', 'Mariage', 8000, '2027-04-01'), goal('ski', 'Ski', 1500, '2026-12-20')] } })
    const plan = goalsPlan(d, today)
    expect(plan.available).toBe(210000)
    expect(plan.goals.map((g) => g.goal.id)).toEqual(['ski', 'mariage'])
    expect(plan.goals[0].saved).toBe(150000)
    expect(plan.goals[0].reached).toBe(true)
    expect(plan.goals[1].saved).toBe(60000)
    expect(plan.free).toBe(0)
  })

  it('plusieurs objectifs : combien mettre de côté par mois pour chacun', () => {
    const d = data({ settings: { goals: [goal('ski', 'Ski', 600, '2026-12-19'), goal('mariage', 'Mariage', 6000, '2027-04-19')] } })
    const plan = goalsPlan(d, today)
    // Ski : 600 € en 1 mois (minimum 1 mois) ; mariage : 6 000 € en 5 mois.
    expect(plan.goals[0].perMonth).toBe(60000)
    expect(plan.goals[1].perMonth).toBe(Math.round(600000 / (151 / 30.44)))
    expect(plan.perMonth).toBe(plan.goals[0].perMonth + plan.goals[1].perMonth)
  })

  it('un objectif réalisé sort de l’épargne et n’apparaît plus', () => {
    const entries = [e('2026-08-08', 1000), e('2026-09-05', 1000), e('2026-10-03', 1000)]
    const d = data({ entries, settings: { goals: [goal('ski', 'Ski', 1500, '2026-11-01', { done: { at: T, spent: 150000 } }), goal('mariage', 'Mariage', 8000, '2027-04-01')] } })
    const plan = goalsPlan(d, today)
    expect(plan.available).toBe(60000)
    expect(plan.goals.map((g) => g.goal.id)).toEqual(['mariage'])
    expect(plan.goals[0].saved).toBe(60000)
  })

  it('l’estimation d’un objectif tient compte de ceux qui passent avant', () => {
    const entries = [e('2026-11-14', 100)]
    const alone = goalsPlan(data({ entries, settings: { goals: [goal('mariage', 'Mariage', 8000, '2027-04-01')] } }), today).goals[0]
    const withSki = goalsPlan(data({ entries, settings: { goals: [goal('mariage', 'Mariage', 8000, '2027-04-01'), goal('ski', 'Ski', 500, '2026-12-20')] } }), today)
    const mariage = withSki.goals.find((g) => g.goal.id === 'mariage')!
    expect(mariage.projected).toBe(Math.max(0, alone.projected - 50000))
    expect(nextGoal(data({ settings: { goals: [goal('mariage', 'Mariage', 8000, '2027-04-01'), goal('ski', 'Ski', 500, '2026-12-20')] } }), today)?.id).toBe('ski')
  })

  it('progression bornée entre 0 et 1', () => {
    expect(goalProgress(50000, 0)).toBe(0)
    expect(goalProgress(50000, 100000)).toBe(0.5)
    expect(goalProgress(150000, 100000)).toBe(1)
  })
})

describe('saisie d’une journée', () => {
  const today = '2026-11-19'
  const base = { date: '2026-11-14', text: '100', cents: 10000 }
  it('accepte une journée normale, et 0 €', () => {
    expect(validateEntry(base, [], today)).toBeNull()
    expect(validateEntry({ ...base, text: '0', cents: 0 }, [], today)).toBeNull()
  })
  it('accepte n’importe quel jour de la semaine (jour en plus)', () => {
    expect(validateEntry({ ...base, date: '2026-11-18' }, [], today)).toBeNull() // mercredi
  })
  it('refuse les cas absurdes', () => {
    expect(validateEntry({ ...base, date: '2026-11-20' }, [], today)).toBe('date-future')
    expect(validateEntry({ ...base, date: '1990-01-06' }, [], today)).toBe('date-ancienne')
    expect(validateEntry({ ...base, text: '' , cents: null }, [], today)).toBe('montant-vide')
    expect(validateEntry({ ...base, text: 'abc', cents: null }, [], today)).toBe('montant-invalide')
    expect(validateEntry({ ...base, cents: 2_000_000 }, [], today)).toBe('montant-trop-grand')
    expect(validateEntry({ ...base, clients: 1.5 }, [], today)).toBe('clients-invalide')
    expect(validateEntry({ ...base, clients: 99999 }, [], today)).toBe('clients-invalide')
  })
  it('refuse un jour déjà saisi, sauf s’il s’agit de lui-même', () => {
    const ex = [e('2026-11-14', 1)]
    expect(validateEntry(base, ex, today)).toBe('deja-saisi')
    expect(validateEntry({ ...base, id: 'e2026-11-14' }, ex, today)).toBeNull()
  })
})

describe('statistiques', () => {
  const today = '2026-11-19'
  const entries = [
    e('2026-09-26', 150, 12), e('2026-09-27', 100, 9),
    e('2026-10-03', 200, 14), e('2026-10-04', 120, 10), e('2026-10-14', 90, 6), // mercredi en plus
    e('2026-10-17', 260, 18), e('2026-10-18', 150, 11), e('2026-10-31', 210, 15),
    e('2026-11-01', 140, 10), e('2026-11-07', 230, 16), e('2026-11-08', 170, 12),
  ]
  const d = data({ entries, settings: { hoursPerDay: 10 } })
  const s = computeStats(d, today)

  it('records du jour, de la semaine, du mois', () => {
    expect(s.bestDay).toEqual({ date: '2026-10-17', amount: 26000 })
    expect(s.bestWeek!.monday).toBe('2026-10-12') // semaine du mercredi 14 + 17-18
    expect(s.bestWeek!.amount).toBe(9000 + 26000 + 15000)
    expect(s.bestMonth!.month).toBe('2026-10')
  })

  it('moyennes, par heure et par jour de la semaine', () => {
    expect(s.dayCount).toBe(11)
    expect(s.avgPerDay).toBe(Math.round(s.total / 11))
    expect(s.perHour).toBe(Math.round(s.total / 110))
    expect(s.byWeekday[3].count).toBe(1) // un mercredi
    expect(s.byWeekday[6].count).toBe(5) // samedis
  })

  it('la moyenne par mois attend un mois terminé', () => {
    expect(s.avgPerMonth).toBe(Math.round((25000 + 103000) / 2))
    expect(computeStats(data({ entries: [e('2026-11-07', 100)] }), today).avgPerMonth).toBeNull()
  })

  it('compare au mois d’avant et à l’an dernier', () => {
    expect(s.lastMonth!.month).toBe('2026-10')
    expect(s.monthChange).toBeGreaterThan(0)
    const y = computeStats(data({ entries: [e('2025-10-04', 100), ...entries] }), today)
    expect(y.yearChange!.month).toBe('2025-10')
    expect(y.yearChange!.change).toBeCloseTo(((103000 - 10000) / 10000) * 100, 5)
  })

  it('clients par mois', () => {
    expect(s.monthly.find((m) => m.month === '2026-10')!.clients).toBe(14 + 10 + 6 + 18 + 11 + 15)
    expect(s.clients!.total).toBe(133)
  })

  it('rien de cassé sans données', () => {
    const z = computeStats(data(), today)
    expect(z.bestDay).toBeNull()
    expect(z.perHour).toBeNull()
    expect(z.trend).toBeNull()
  })
})

describe('compliments', () => {
  const today = '2026-11-19'
  it('première journée', () => {
    expect(compliments(data({ entries: [e('2026-11-15', 100)] }), today).some((c) => c.key === 'premier-jour')).toBe(true)
  })
  it('nouveau record récent', () => {
    const entries = [e('2026-10-03', 100), e('2026-10-04', 100), e('2026-10-10', 100), e('2026-10-11', 100), e('2026-11-14', 400)]
    const c = compliments(data({ entries }), today)
    expect(c.some((x) => x.key === 'record-jour:2026-11-14')).toBe(true)
  })
  it('hausse sur 30 jours, avec le prénom', () => {
    const entries = [e('2026-09-26', 100), e('2026-09-27', 100), e('2026-10-03', 100), e('2026-11-07', 200), e('2026-11-08', 200), e('2026-11-14', 200)]
    const c = compliments(data({ entries, settings: { name: 'Nolhan' } }), today)
    const up = c.find((x) => x.key.startsWith('hausse:'))
    expect(up).toBeDefined()
  })
  it('paliers de l’objectif, et un compliment déjà vu ne revient pas', () => {
    const d = data({ entries: [e('2026-10-03', 100)], bilans: [bilan('2026-10', 3000)], settings: { goalAmount: 600000 } })
    const first = nextCompliment(d, today, new Set())
    expect(first?.key).toBe('objectif:g1:50')
    expect(nextCompliment(d, today, new Set(['objectif:g1:50']))?.key).not.toBe('objectif:g1:50')
  })
})

describe('dates et montants', () => {
  it('semaines du lundi au dimanche', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16')
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(mondayOf('2026-11-23')).toBe('2026-11-23')
    expect(formatWeekRange('2026-11-16').replace(/⁠/g, '').replace(/\s/g, ' ')).toBe('16-22 novembre')
    expect(formatDayLong('2026-11-01')).toContain('dimanche 1er novembre')
  })
  it('fonctions de mois et de semaine', () => {
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(addMonths('2026-11', 2)).toBe('2027-01')
    expect(deMonth('2026-10')).toBe("d'octobre")
    expect(saturdayOf('2026-08-06')).toBe('2026-08-08')
    expect(weekday(addDays('2026-11-21', 0))).toBe(6)
  })
  it('montants à la française', () => {
    expect(parseEuros('1 245,50 €')).toBe(124550)
    expect(parseEuros('abc')).toBeNull()
    expect(formatEuros(123450).replace(/\s/g, ' ')).toBe('1 234,50 €')
    expect(formatSigned(-850).replace(/\s/g, ' ')).toBe('−8,50 €')
    expect(centsToInput(24550)).toBe('245,50')
    expect(plural(1, 'jour', 'jours')).toBe('1 jour')
    expect(plural(2, 'jour', 'jours')).toBe('2 jours')
  })
})
