// Statistiques de suivi : records, moyennes, évolution. Fonctions pures, testées dans calc.test.ts.
// Tous les montants sont TA PART, en centimes.

import type { AppData } from './types'
import { addMonths, daysBetween, mondayOf, monthKeyOf, weekday } from './dates'
import { autoSaved, baselineDay, savedAfterBaseline, monthsWithData, monthTotals, savedBilanFigures, sortEntries, totalSaved } from './calc'

export interface Stats {
  dayCount: number
  total: number
  avgPerDay: number
  avgPerWeek: number
  /** Moyenne des mois terminés (null s'il n'y en a pas encore). */
  avgPerMonth: number | null
  perHour: number | null
  bestDay: { date: string; amount: number } | null
  bestWeek: { monday: string; amount: number } | null
  bestMonth: { month: string; total: number } | null
  /** Moyenne par jour de la semaine (0 = dimanche), sur les jours travaillés. */
  byWeekday: { day: number; avg: number; count: number }[]
  monthly: { month: string; total: number; clients: number; days: number }[]
  weekly: { monday: string; total: number }[]
  thisMonth: { month: string; total: number }
  lastMonth: { month: string; total: number } | null
  monthBefore: { month: string; total: number } | null
  /** Dernier mois terminé contre celui d'avant, en %. */
  monthChange: number | null
  /** Dernier mois terminé contre le même mois l'an dernier, en %. */
  yearChange: { month: string; before: number; change: number } | null
  /** Gain moyen par jour travaillé sur les 30 derniers jours, contre les 30 d'avant. */
  trend: { last: number; before: number; change: number } | null
  clients: { total: number; avgPerDay: number; avgPerClient: number } | null
  saved: number
  /** Pourboires reçus en tout, en centimes. */
  tips: number
  savingRate: number | null
  gapTotal: number
  monthsAhead: number
  monthsBehind: number
  cumulative: { month: string; cumulative: number }[]
}

export function computeStats(data: AppData, today: string): Stats {
  const entries = sortEntries(data.entries).filter((e) => e.date <= today)
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const dayCount = entries.length

  let bestDay: Stats['bestDay'] = null
  for (const e of entries) if (!bestDay || e.amount > bestDay.amount) bestDay = { date: e.date, amount: e.amount }

  const weeks = new Map<string, number>()
  for (const e of entries) weeks.set(mondayOf(e.date), (weeks.get(mondayOf(e.date)) ?? 0) + e.amount)
  const weekly = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([monday, t]) => ({ monday, total: t }))
  let bestWeek: Stats['bestWeek'] = null
  for (const w of weekly) if (!bestWeek || w.total > bestWeek.amount) bestWeek = { monday: w.monday, amount: w.total }

  const totals = monthTotals({ ...data, entries })
  const monthly = [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, t]) => {
      const es = entries.filter((e) => monthKeyOf(e.date) === month)
      return { month, total: t, clients: es.reduce((s, e) => s + (e.clients ?? 0), 0), days: es.length }
    })
  let bestMonth: Stats['bestMonth'] = null
  for (const m of monthly) if (!bestMonth || m.total > bestMonth.total) bestMonth = { month: m.month, total: m.total }

  const currentKey = monthKeyOf(today)
  const finished = monthly.filter((m) => m.month < currentKey)
  const avgPerMonth = finished.length ? Math.round(finished.reduce((s, m) => s + m.total, 0) / finished.length) : null

  const lastMonth = finished.at(-1) ?? null
  const monthBefore = finished.at(-2) ?? null
  const monthChange = lastMonth && monthBefore && monthBefore.total > 0 ? ((lastMonth.total - monthBefore.total) / monthBefore.total) * 100 : null
  const yearAgo = lastMonth ? monthly.find((m) => m.month === addMonths(lastMonth.month, -12)) : undefined
  const yearChange = lastMonth && yearAgo && yearAgo.total > 0 ? { month: yearAgo.month, before: yearAgo.total, change: ((lastMonth.total - yearAgo.total) / yearAgo.total) * 100 } : null

  const window = (from: number, to: number) => entries.filter((e) => { const age = daysBetween(e.date, today); return age >= from && age < to })
  const avg = (es: typeof entries) => (es.length ? es.reduce((s, e) => s + e.amount, 0) / es.length : 0)
  const last30 = window(0, 30)
  const prev30 = window(30, 60)
  const trend = last30.length >= 2 && prev30.length >= 2 && avg(prev30) > 0 ? { last: Math.round(avg(last30)), before: Math.round(avg(prev30)), change: ((avg(last30) - avg(prev30)) / avg(prev30)) * 100 } : null

  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const es = entries.filter((e) => weekday(e.date) === day)
    return { day, avg: Math.round(avg(es)), count: es.length }
  })

  const withClients = entries.filter((e) => e.clients != null)
  const clientTotal = withClients.reduce((s, e) => s + (e.clients ?? 0), 0)
  const clients =
    clientTotal > 0
      ? { total: clientTotal, avgPerDay: Math.round((clientTotal / withClients.length) * 10) / 10, avgPerClient: Math.round(withClients.reduce((s, e) => s + e.amount, 0) / clientTotal) }
      : null

  const hours = data.settings.hoursPerDay
  const perHour = dayCount && hours > 0 ? Math.round(total / (dayCount * hours)) : null

  const bilans = [...data.bilans].sort((a, b) => a.month.localeCompare(b.month))
  const figures = bilans.map((b) => savedBilanFigures(b, data))
  const saved = totalSaved(data, today)
  // Épargne mois par mois (mois terminés) : montant du bilan s'il existe, sinon calcul automatique.
  const base = data.settings.savedBaseline
  const savedMonths = [...new Set([...bilans.map((b) => b.month), ...monthsWithData(data).filter((m) => m <= currentKey)])].filter((m) => !base || m > base.month).sort()
  const savedOf = (m: string) => bilans.find((b) => b.month === m)?.actual ?? autoSaved(data, m)
  const earnedSaved = savedMonths.reduce((s, m) => s + (totals.get(m) ?? 0), 0)
  // Montant saisi à la main + ce qui a été gagné après, le même mois.
  const baseTotal = base ? base.amount + savedAfterBaseline(data, base.month, baselineDay(data)!) : 0
  let running = baseTotal

  return {
    dayCount,
    total,
    avgPerDay: dayCount ? Math.round(total / dayCount) : 0,
    avgPerWeek: weekly.length ? Math.round(total / weekly.length) : 0,
    avgPerMonth,
    perHour,
    bestDay,
    bestWeek,
    bestMonth,
    byWeekday,
    monthly,
    weekly,
    thisMonth: { month: currentKey, total: totals.get(currentKey) ?? 0 },
    lastMonth,
    monthBefore,
    monthChange,
    yearChange,
    trend,
    clients,
    saved,
    tips: entries.reduce((a, e) => a + (e.tips ?? 0), 0),
    savingRate: earnedSaved > 0 && !base ? (saved / earnedSaved) * 100 : null,
    gapTotal: figures.reduce((s, f) => s + f.gap, 0),
    monthsAhead: figures.filter((f) => f.gap > 0).length,
    monthsBehind: figures.filter((f) => f.gap < 0).length,
    cumulative: [...(base ? [{ month: base.month, cumulative: baseTotal }] : []), ...savedMonths.map((m) => ({ month: m, cumulative: (running += savedOf(m)) }))],
  }
}
