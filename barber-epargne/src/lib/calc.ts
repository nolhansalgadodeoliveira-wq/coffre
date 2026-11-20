// Toute la logique de calcul de l'app. Fonctions pures (sans effet de bord), testées dans calc.test.ts.
// Montants en centimes.
//
// Principe : on enregistre des JOURNÉES travaillées (n'importe quel jour). Les jours « prévus » viennent
// des jours habituels choisis dans les réglages, modifiables jour par jour dans le calendrier
// (repos exceptionnel, jour en plus). Le suivi d'épargne se fait par mois civil.

import type { AppData, Bilan, CategoryDef, Commission, DayStatus, Entry, Expense, Goal, Settings } from './types'
import { BARBER } from './professions'
import { MAX_CLIENTS, MAX_DAY_GROSS, MIN_DATE } from './types'
import { addDays, addMonths, daysBetween, datesOfMonth, lastDayOfMonth, monthKeyOf, weekday } from './dates'

/**
 * Part gardée d'une journée, en % : celle enregistrée avec la journée, sinon déduite de ta part
 * (journées saisies avant cette option), arrondie au demi-point.
 */
export function entryKeepPct(e: Entry, fallback: number): number {
  if (e.keepPct) return e.keepPct
  if (e.gross <= 0 || e.parts?.domicile) return fallback
  return Math.round(((e.amount - (e.tips ?? 0)) / e.gross) * 200) / 2
}

// ---------- Catégories de recettes et de dépenses (selon le métier) ----------

/** Couleurs des catégories, dans un ordre fixe validé pour le daltonisme. Au-delà de 4 : gris (avec le nom). */
const CAT_COLORS = ['var(--cat-coupes)', 'var(--cat-produits)', 'var(--cat-pourboires)', 'var(--cat-domicile)']
export const OTHER_COLOR = 'var(--muted)'
export const catColor = (i: number) => CAT_COLORS[i] ?? OTHER_COLOR

export interface CategoryView extends CategoryDef {
  color: string
}

/** Catégories de recettes (celles du barbier si aucun métier n'a été choisi : la version d'origine de l'app). */
export function incomeCategories(s: Settings): CategoryView[] {
  return (s.incomeCats?.length ? s.incomeCats : BARBER.income).map((c, i) => ({ ...c, color: catColor(i) }))
}

/** Catégories de dépenses (aucune pour le barbier par défaut : la fonction « dépenses » reste cachée). */
export function expenseCategories(s: Settings): CategoryView[] {
  return (s.expenseCats ?? []).map((c, i) => ({ ...c, color: catColor(i) }))
}

export const tracksExpenses = (s: Settings) => expenseCategories(s).length > 0

/** Catégorie « principale » d'un métier : celle qui reçoit le reste de l'encaissé d'une journée. */
export function mainCategory(s: Settings): CategoryView {
  const cats = incomeCategories(s)
  return cats.find((c) => c.kind !== 'tips') ?? cats[0]
}

/** Encaissé d'une journée par catégorie (pourboires compris), en centimes. Une catégorie supprimée va dans « autres ». */
export function entryCategories(e: Entry, s: Settings): Record<string, number> {
  const cats = incomeCategories(s)
  const out: Record<string, number> = Object.fromEntries(cats.map((c) => [c.id, 0]))
  const tipsCat = cats.find((c) => c.kind === 'tips')
  let rest = e.gross
  for (const [k, v] of Object.entries(e.parts ?? {})) {
    rest -= v
    if (k in out && k !== tipsCat?.id) out[k] += v
    else out.autres = (out.autres ?? 0) + v
  }
  out[mainCategory(s).id] += rest
  if (e.tips) {
    if (tipsCat) out[tipsCat.id] += e.tips
    else out.autres = (out.autres ?? 0) + e.tips
  }
  return out
}

/** Total par catégorie de recette sur un ensemble de journées. */
export function categoryTotals(entries: Entry[], s: Settings): Record<string, number> {
  const t: Record<string, number> = {}
  for (const e of entries) for (const [k, v] of Object.entries(entryCategories(e, s))) t[k] = (t[k] ?? 0) + v
  return t
}

/** Total par catégorie de dépense. */
export function expenseTotals(list: Expense[], s: Settings): Record<string, number> {
  const known = new Set(expenseCategories(s).map((c) => c.id))
  const t: Record<string, number> = {}
  for (const x of list) {
    const k = known.has(x.cat) ? x.cat : 'autres'
    t[k] = (t[k] ?? 0) + x.amount
  }
  return t
}

/** Dépenses d'un mois. */
export function expensesOfMonth(data: AppData, month: string): Expense[] {
  return (data.expenses ?? []).filter((x) => monthKeyOf(x.date) === month)
}
export const costsOfMonth = (data: AppData, month: string) => expensesOfMonth(data, month).reduce((a, x) => a + x.amount, 0)

/** Dépenses moyennes des 3 derniers mois terminés qui en ont : servent à estimer les mois à venir. */
export function averageMonthlyCosts(data: AppData, today: string): number {
  const cur = monthKeyOf(today)
  const months = [...new Set((data.expenses ?? []).map((x) => monthKeyOf(x.date)))].filter((m) => m < cur).sort().slice(-3)
  if (months.length === 0) return 0
  return Math.round(months.reduce((a, m) => a + costsOfMonth(data, m), 0) / months.length)
}

/**
 * Ta part d'un encaissé détaillé : catégories « à domicile » à leur propre part, le reste à la part du jour.
 * `home` = montant des catégories « à domicile ».
 */
export function shareOf(gross: number, home: number, keepPct: number, homeKeepPct: number): number {
  return myShare(gross - home, keepPct) + myShare(home, homeKeepPct)
}

/** Ta part d'un montant encaissé, selon la part gardée (en %), arrondie au centime. */
export function myShare(gross: number, keepPct: number): number {
  return Math.round((gross * keepPct) / 100)
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date))
}

export function entryOn(data: AppData, date: string): Entry | undefined {
  return data.entries.find((e) => e.date === date)
}

// ---------- Jours prévus ----------

/** Statut d'un jour : celui choisi dans le calendrier, sinon « prévu » si c'est un jour habituel, sinon « repos ». */
export function dayStatus(data: Pick<AppData, 'days' | 'settings'>, iso: string): DayStatus {
  const set = data.days[iso]
  if (set) return set
  return data.settings.workdays.includes(weekday(iso)) ? 'prevu' : 'repos'
}

/** Jour où l'on travaille : habituel ou ajouté en plus. */
export function isPlanned(data: Pick<AppData, 'days' | 'settings'>, iso: string): boolean {
  return dayStatus(data, iso) !== 'repos'
}

/** Statut par défaut d'un jour (sans modification dans le calendrier). */
export function defaultStatus(data: Pick<AppData, 'settings'>, iso: string): DayStatus {
  return data.settings.workdays.includes(weekday(iso)) ? 'prevu' : 'repos'
}

/**
 * Changement des jours habituels : il ne vaut qu'à partir d'aujourd'hui. Les jours passés (depuis tes débuts)
 * gardent leur statut d'avant, sinon tous les anciens vendredis deviendraient « à saisir » d'un coup.
 */
export function changeWorkdays(data: AppData, workdays: number[], today: string): AppData['days'] {
  const days = { ...data.days }
  const before = data.settings.workdays
  for (let d = trackingStart(data, today); d < today; d = addDays(d, 1)) {
    if (days[d]) continue
    const was = before.includes(weekday(d))
    const now = workdays.includes(weekday(d))
    if (was && !now) days[d] = 'extra'
    else if (!was && now) days[d] = 'repos'
  }
  // À venir : une marque devenue inutile (« en plus » un jour désormais habituel, « repos » un jour qui l'est déjà) est retirée.
  for (const [d, st] of Object.entries(days)) {
    if (d < today) continue
    const usual = workdays.includes(weekday(d))
    if ((st === 'extra' && usual) || (st === 'repos' && !usual)) delete days[d]
  }
  return days
}

/** Jours prévus d'un mois. */
export function plannedDaysOfMonth(data: AppData, month: string): string[] {
  return datesOfMonth(month).filter((d) => isPlanned(data, d))
}

/**
 * Premier jour suivi : la plus ancienne journée saisie (aujourd'hui s'il n'y en a pas).
 * Les jours prévus AVANT ne sont jamais réclamés ni comptés : on ne reproche pas à quelqu'un des jours d'avant ses débuts.
 */
export function trackingStart(data: Pick<AppData, 'entries'>, today: string): string {
  let first = today
  for (const e of data.entries) if (e.date < first) first = e.date
  return first
}

/** Nombre de journées saisies à partir duquel les estimations sont jugées fiables. */
export const MIN_DAYS_FOR_ESTIMATE = 4

/** Jours prévus (ou déjà travaillés) passés et pas encore saisis, du plus récent au plus ancien. */
export function pendingDays(data: AppData, today: string, lookback = 21): string[] {
  const out: string[] = []
  const entered = new Set(data.entries.map((e) => e.date))
  const start = trackingStart(data, today)
  for (let i = 0; i <= lookback; i++) {
    const d = addDays(today, -i)
    if (d < start) break
    if (isPlanned(data, d) && !entered.has(d)) out.push(d)
  }
  return out
}

/**
 * Jour proposé dans le formulaire d'ajout :
 * - mois en cours (ou aucun mois) : le jour prévu le plus RÉCENT pas encore saisi (en général « aujourd'hui » ou « hier ») ;
 * - mois passé consulté sur l'accueil : son premier jour prévu pas encore saisi (pratique pour rattraper un mois en retard) ;
 * - sinon : aujourd'hui.
 */
export function suggestedDay(data: AppData, month: string | undefined, today: string): string {
  const entered = new Set(data.entries.map((e) => e.date))
  if (month && month < monthKeyOf(today)) {
    const free = plannedDaysOfMonth(data, month).find((d) => !entered.has(d))
    return free ?? lastDayOfMonth(month)
  }
  const pending = pendingDays(data, today, 31)[0]
  if (pending) return pending
  // Sinon : le dernier jour de travail prévu de la semaine pas encore saisi (jamais un jour de repos par défaut).
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i)
    if (isPlanned(data, d) && !entered.has(d)) return d
  }
  return today
}

// ---------- Mois ----------

export function entriesOfMonth(data: AppData, month: string): Entry[] {
  return sortEntries(data.entries.filter((e) => monthKeyOf(e.date) === month))
}

export const sum = (entries: Entry[]) => entries.reduce((s, e) => s + e.amount, 0)

export function monthTotals(data: AppData): Map<string, number> {
  const totals = new Map<string, number>()
  for (const e of data.entries) totals.set(monthKeyOf(e.date), (totals.get(monthKeyOf(e.date)) ?? 0) + e.amount)
  return totals
}

export function monthsWithData(data: AppData): string[] {
  return [...monthTotals(data).keys()].sort()
}

export function billedMonths(data: AppData): Set<string> {
  return new Set(data.bilans.map((b) => b.month))
}

export function isBilled(data: AppData, date: string): boolean {
  return billedMonths(data).has(monthKeyOf(date))
}

export interface MonthSummary {
  month: string
  planned: string[]
  /** Jours saisis du mois (prévus ou non). */
  entered: string[]
  total: number
  hasData: boolean
  bilan: Bilan | undefined
  /** Dernier jour prévu du mois (ou dernier jour du mois s'il n'y en a aucun). */
  lastPlanned: string
  /** Le bilan peut être fait : dernier jour prévu saisi, ou mois terminé. */
  due: boolean
}

export function monthSummary(data: AppData, month: string, today: string): MonthSummary {
  const planned = plannedDaysOfMonth(data, month)
  const entries = entriesOfMonth(data, month)
  const entered = entries.map((e) => e.date)
  const lastPlanned = planned[planned.length - 1] ?? lastDayOfMonth(month)
  const bilan = data.bilans.find((b) => b.month === month)
  const hasData = entries.length > 0
  const ended = today > lastDayOfMonth(month)
  const lastDone = entered.includes(lastPlanned) || (entered.length > 0 && entered[entered.length - 1] >= lastPlanned)
  return { month, planned, entered, total: sum(entries), hasData, bilan, lastPlanned, due: !bilan && hasData && (ended || lastDone) }
}

/** Premier mois dont le bilan est à faire. */
export function firstDueMonth(data: AppData, today: string): string | null {
  for (const m of monthsWithData(data)) if (monthSummary(data, m, today).due) return m
  return null
}

// ---------- Commission du salon ----------

/** Commission ou loyer sur un total mensuel : pourcentage arrondi, ou montant fixe (jamais plus que le total). */
export function commissionFor(amount: number, c: Commission): number {
  if (!c.enabled || c.value <= 0) return 0
  if (c.mode === 'percent') return Math.round((amount * Math.min(c.value, 100)) / 100)
  return Math.min(c.value, amount)
}

// ---------- Bilan mensuel ----------

export interface BilanFigures {
  total: number
  commission: number
  personalExpenses: number
  /** À épargner = total − commission − dépenses perso, jamais négatif. */
  expected: number
}

export function bilanFigures(total: number, personalExpenses: number, commission: Commission): BilanFigures {
  const com = commissionFor(total, commission)
  return { total, commission: com, personalExpenses, expected: Math.max(0, total - com - personalExpenses) }
}

/** Écart = réellement mis de côté − attendu. */
export function gap(actual: number, expected: number): number {
  return actual - expected
}

/**
 * Chiffres d'un bilan enregistré. Ils sont FIGÉS au moment de la validation : modifier un jour
 * plus tard ne change pas l'écart. `changed` signale que les jours du mois ne correspondent plus.
 */
export function savedBilanFigures(b: Bilan, data: AppData): BilanFigures & { gap: number; currentTotal: number; changed: boolean } {
  const currentTotal = sum(entriesOfMonth(data, b.month))
  const base = bilanFigures(b.total ?? currentTotal, b.personalExpenses, b.commission)
  const expected = b.expected ?? base.expected
  return { ...base, expected, gap: gap(b.actual, expected), currentTotal, changed: b.total !== undefined && b.total !== currentTotal }
}

/**
 * Épargne d'un mois terminé sans bilan, calculée automatiquement :
 * ta part du mois − frais du salon − dépenses perso (jamais négative).
 */
export function autoSaved(data: AppData, month: string): number {
  // Ce qui reste du mois : recettes − dépenses professionnelles, puis − dépenses perso et frais du salon.
  const net = Math.max(0, sum(entriesOfMonth(data, month)) - costsOfMonth(data, month))
  return bilanFigures(net, data.settings.personalExpenses, data.settings.commission).expected
}

/**
 * Déjà mis de côté : chaque mois terminé où tu as travaillé compte automatiquement
 * (ta part − dépenses perso − frais). Si tu as fait le bilan d'un mois, c'est le montant réel du bilan qui compte.
 * Le mois en cours n'est pas encore compté : il apparaît dans l'estimation.
 */
export function totalSaved(data: AppData, today: string): number {
  const cur = monthKeyOf(today)
  const billed = new Map(data.bilans.map((b) => [b.month, b.actual]))
  let total = 0
  for (const b of data.bilans) total += b.actual
  for (const m of monthsWithData(data)) if (m < cur && !billed.has(m)) total += autoSaved(data, m)
  return total
}

// ---------- Projection ----------
//
// Principe simple : on prend ton gain moyen par journée travaillée et on l'applique à TOUS les jours
// prévus (tes jours habituels + les jours en plus), jusqu'à la fin du mois, puis mois par mois jusqu'à l'objectif.
// Les jours déjà saisis gardent leur vrai montant. Ensuite, chaque mois, on retire les dépenses perso et les frais du salon.

/** Gain moyen par jour travaillé : moyenne des journées saisies sur les 60 derniers jours (toutes, s'il n'y en a pas de récentes). */
export function dailyAverage(data: AppData, today: string): number {
  const past = data.entries.filter((e) => e.date <= today)
  const recent = past.filter((e) => daysBetween(e.date, today) < 60)
  const pool = recent.length > 0 ? recent : past
  return pool.length ? Math.round(pool.reduce((s, e) => s + e.amount, 0) / pool.length) : 0
}

export interface MonthProjection {
  month: string
  /** Gagné et saisi dans la période. */
  entered: number
  /** Jours prévus pas encore saisis, comptés au gain moyen. */
  assumedDays: number
  /** Dont les jours déjà passés depuis tes débuts dans l'app (oubliés, à saisir). */
  assumedPast: number
  assumed: number
  total: number
  /** Dépenses professionnelles du mois (estimées pour le mois en cours et à venir). */
  costs: number
  commission: number
  expenses: number
  /** Épargne attendue sur la période : total − frais du salon − dépenses perso, jamais négative. */
  expected: number
  /** Part du mois prise en compte (1, sauf le dernier mois avant la date de l'objectif). */
  fraction: number
}

/**
 * Estimation d'un mois. Pour le mois en cours et les mois à venir, chaque jour prévu pas encore saisi
 * compte pour le gain moyen. Un mois passé n'est jamais « inventé » : on garde ce qui a été saisi.
 * `until` : date de l'objectif (exclue), pour le dernier mois.
 */
export function monthProjection(data: AppData, month: string, today: string, avg: number, until?: string): MonthProjection {
  const all = datesOfMonth(month)
  const days = until ? all.filter((d) => d < until) : all
  const fraction = all.length ? days.length / all.length : 0
  const inPeriod = new Set(days)
  const entries = entriesOfMonth(data, month).filter((e) => inPeriod.has(e.date))
  const have = new Set(entries.map((e) => e.date))
  const entered = sum(entries)
  const assumeThisMonth = month >= monthKeyOf(today)
  const missing = assumeThisMonth ? days.filter((d) => isPlanned(data, d) && !have.has(d)) : []
  // Jours passés à saisir : seulement depuis tes débuts dans l'app (ceux d'avant sont estimés, pas réclamés).
  const start = trackingStart(data, today)
  const assumed = missing.length * avg
  const total = entered + assumed
  // Dépenses professionnelles : réelles pour un mois passé ; au moins la moyenne habituelle pour le mois en cours et à venir.
  const actualCosts = costsOfMonth(data, month)
  const costs = assumeThisMonth ? Math.max(actualCosts, Math.round(averageMonthlyCosts(data, today) * fraction)) : actualCosts
  const c = data.settings.commission
  const commission = !c.enabled || c.value <= 0 ? 0 : Math.min(total, c.mode === 'percent' ? Math.round((total * Math.min(c.value, 100)) / 100) : Math.round(c.value * fraction))
  const expenses = Math.round(data.settings.personalExpenses * fraction)
  return {
    month,
    entered,
    assumedDays: missing.length,
    assumedPast: missing.filter((d) => d < today && d >= start).length,
    assumed,
    total,
    commission,
    expenses,
    costs,
    expected: Math.max(0, total - costs - commission - expenses),
    fraction,
  }
}

export interface Projection {
  /** Déjà mis de côté : mois terminés (calcul automatique, ou montant du bilan s'il a été fait). */
  saved: number
  /** Gain moyen par jour travaillé, utilisé pour toute l'estimation. */
  perDay: number
  /** Épargne totale estimée à la date de l'objectif. */
  projected: number
  /** projected ÷ objectif (peut dépasser 1). */
  projectedPct: number
  remaining: number
  /** À mettre de côté par mois (à partir d'aujourd'hui) pour atteindre l'objectif à temps. */
  neededPerMonth: number
  /** Gain (ta part) nécessaire par jour travaillé restant. */
  neededPerDay: number
  daysLeft: number
  /** Jours prévus pas encore saisis, comptés au gain moyen d'ici l'objectif. */
  assumedDays: number
  months: MonthProjection[]
  reached: boolean
  passed: boolean
  onTrack: boolean
}

/** Objectifs en cours (pas encore réalisés, avec un montant), du plus proche au plus lointain. */
export function activeGoals(data: AppData): Goal[] {
  return data.settings.goals.filter((g) => !g.done && g.amount > 0).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

/** Argent déjà utilisé pour des objectifs réalisés (il ne fait plus partie de l'épargne). */
export function spentOnGoals(data: AppData): number {
  return data.settings.goals.reduce((s, g) => s + (g.done?.spent ?? 0), 0)
}

/** Épargne disponible : déjà mis de côté − ce qui a été utilisé pour des objectifs réalisés. */
export function availableSavings(data: AppData, today: string): number {
  return Math.max(0, totalSaved(data, today) - spentOnGoals(data))
}

/** Cible par défaut d'une estimation : tous les objectifs en cours, jusqu'au plus lointain. */
function defaultTarget(data: AppData, today: string): { amount: number; date: string } {
  const goals = activeGoals(data)
  if (goals.length === 0) return { amount: 0, date: `${addMonths(monthKeyOf(today), 6)}-01` }
  return { amount: goals.reduce((s, g) => s + g.amount, 0), date: goals[goals.length - 1].date }
}

/**
 * Estimation de l'épargne jusqu'à une date, comparée à un montant visé (par défaut : tous les objectifs en cours).
 * Part de l'épargne disponible (objectifs réalisés déduits).
 */
export function projection(data: AppData, today: string, target = defaultTarget(data, today)): Projection {
  const { amount: goalAmount, date: goalDate } = target
  const { commission } = data.settings
  const avg = dailyAverage(data, today)
  const saved = availableSavings(data, today)
  const billed = billedMonths(data)
  const cur = monthKeyOf(today)
  const goalMonth = monthKeyOf(goalDate)

  // Mois à estimer : du mois en cours jusqu'au mois de l'objectif (les mois terminés sont déjà dans « saved »).
  const first = cur
  const months: MonthProjection[] = []
  if (goalDate > today && data.entries.length > 0) {
    for (let m = first; m <= goalMonth; m = addMonths(m, 1)) {
      if (billed.has(m)) continue
      if (m < cur && entriesOfMonth(data, m).length === 0) continue
      const mp = monthProjection(data, m, today, avg, m === goalMonth ? goalDate : undefined)
      if (mp.fraction > 0) months.push(mp)
    }
  }

  const projected = saved + months.reduce((s, m) => s + m.expected, 0)
  const remaining = Math.max(0, goalAmount - saved)
  const daysLeft = Math.max(0, daysBetween(today, goalDate))
  const monthsLeft = daysLeft / 30.44
  const neededPerMonth = remaining > 0 && monthsLeft > 0 ? Math.round(remaining / Math.max(monthsLeft, 1)) : 0

  // Gain par jour travaillé restant pour finir pile à l'objectif (on ignore les planchers à 0 pour rester lisible).
  const f = commission.enabled && commission.mode === 'percent' ? 1 - Math.min(commission.value, 100) / 100 : 1
  const fixed = months.reduce((s, m) => s + m.expenses + m.costs + (commission.enabled && commission.mode === 'fixed' ? Math.round(commission.value * m.fraction) : 0), 0)
  const entered = months.reduce((s, m) => s + m.entered, 0)
  const assumedDays = months.reduce((s, m) => s + m.assumedDays, 0)
  const neededPerDay = remaining > 0 && assumedDays > 0 && f > 0 ? Math.max(0, Math.round((remaining + fixed - f * entered) / (f * assumedDays))) : 0

  return {
    saved,
    perDay: avg,
    projected: Math.max(0, projected),
    projectedPct: goalAmount > 0 ? Math.max(0, projected) / goalAmount : 0,
    remaining,
    neededPerMonth,
    neededPerDay,
    daysLeft,
    assumedDays,
    months,
    reached: goalAmount > 0 && saved >= goalAmount,
    passed: today >= goalDate,
    onTrack: goalAmount > 0 && projected >= goalAmount,
  }
}

// ---------- Plusieurs objectifs ----------
//
// L'épargne disponible est répartie entre les objectifs PAR DATE : le plus proche (ski en décembre) est rempli
// en premier, le surplus va au suivant (mariage en avril). Pour chaque objectif, l'app dit combien mettre de côté
// par mois d'ici sa date, et s'il sera atteint à ce rythme.

export interface GoalPlan {
  goal: Goal
  /** Déjà de côté pour cet objectif. */
  saved: number
  progress: number
  remaining: number
  /** Épargne estimée pour cet objectif à sa date (après avoir rempli ceux d'avant). */
  projected: number
  projectedPct: number
  onTrack: boolean
  reached: boolean
  /** La date est passée (objectif à marquer comme réalisé, ou à repousser). */
  passed: boolean
  daysLeft: number
  /** À mettre de côté par mois pour cet objectif, d'ici sa date. */
  perMonth: number
}

export interface GoalsPlan {
  /** Épargne disponible (objectifs réalisés déduits). */
  available: number
  goals: GoalPlan[]
  /** Épargne non affectée (tous les objectifs sont remplis). */
  free: number
  /** Total à mettre de côté par mois pour tous les objectifs en cours. */
  perMonth: number
  /** Ce que tu as réellement mis de côté en moyenne par mois terminé (null s'il n'y en a pas encore). */
  avgSavedPerMonth: number | null
  /** Gain moyen par jour travaillé. */
  perDay: number
  /** Assez de journées saisies pour annoncer « dans les temps » ou non. */
  enoughData: boolean
}

export function goalsPlan(data: AppData, today: string): GoalsPlan {
  const available = availableSavings(data, today)
  const goals = activeGoals(data)
  let pool = available
  let before = 0
  const plans: GoalPlan[] = goals.map((goal) => {
    const saved = Math.min(goal.amount, pool)
    pool -= saved
    const daysLeft = Math.max(0, daysBetween(today, goal.date))
    const passed = today >= goal.date
    const remaining = goal.amount - saved
    // Estimation : épargne totale à sa date, moins ce que prennent les objectifs d'avant.
    const p = projection(data, today, { amount: before + goal.amount, date: goal.date })
    const projected = data.entries.length === 0 ? saved : Math.max(saved, Math.min(goal.amount, p.projected - before))
    before += goal.amount
    const months = daysLeft / 30.44
    return {
      goal,
      saved,
      progress: goalProgress(saved, goal.amount),
      remaining,
      projected,
      projectedPct: goal.amount > 0 ? projected / goal.amount : 0,
      onTrack: projected >= goal.amount,
      reached: remaining <= 0,
      passed,
      daysLeft,
      perMonth: remaining > 0 && !passed ? Math.round(remaining / Math.max(months, 1)) : 0,
    }
  })

  // Épargne réelle des mois terminés (bilan s'il existe, sinon calcul automatique).
  const cur = monthKeyOf(today)
  const done = monthsWithData(data).filter((m) => m < cur)
  const avgSavedPerMonth = done.length ? Math.round(done.reduce((s, m) => s + (data.bilans.find((b) => b.month === m)?.actual ?? autoSaved(data, m)), 0) / done.length) : null

  return { available, goals: plans, free: pool, perMonth: plans.reduce((s, g) => s + g.perMonth, 0), avgSavedPerMonth, perDay: dailyAverage(data, today), enoughData: data.entries.filter((e) => e.date <= today).length >= MIN_DAYS_FOR_ESTIMATE }
}

/** Objectif le plus proche, pas encore réalisé et dont la date n'est pas passée. */
export function nextGoal(data: AppData, today: string): Goal | null {
  return activeGoals(data).find((g) => g.date > today) ?? null
}

export function goalProgress(saved: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(1, Math.max(0, saved / goal))
}

/** Jours travaillés d'un mois : prévus, en plus, et saisis. */
export function workedDaysInMonth(data: AppData, month: string): { planned: number; extra: number; entered: number } {
  let planned = 0
  let extra = 0
  for (const d of datesOfMonth(month)) {
    const s = dayStatus(data, d)
    if (s === 'prevu') planned++
    if (s === 'extra') extra++
  }
  return { planned, extra, entered: entriesOfMonth(data, month).length }
}

// ---------- Saisie ----------

export type EntryError = 'date-invalide' | 'date-future' | 'date-ancienne' | 'montant-vide' | 'montant-invalide' | 'montant-trop-grand' | 'deja-saisi' | 'clients-invalide' | 'pourcentage-invalide'

export function validateEntry(
  input: { date: string; text: string; cents: number | null; clients?: number | null; id?: string },
  existing: Entry[],
  today: string,
): EntryError | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'date-invalide'
  if (input.date > today) return 'date-future'
  if (input.date < MIN_DATE) return 'date-ancienne'
  if (input.text.trim() === '') return 'montant-vide'
  if (input.cents === null) return 'montant-invalide'
  if (input.cents > MAX_DAY_GROSS) return 'montant-trop-grand'
  if (input.clients != null && (!Number.isInteger(input.clients) || input.clients < 0 || input.clients > MAX_CLIENTS)) return 'clients-invalide'
  if (existing.some((e) => e.date === input.date && e.id !== input.id)) return 'deja-saisi'
  return null
}

export const plural = (n: number, one: string, many: string) => `${n} ${Math.abs(n) > 1 ? many : one}`
