// Compliments affichés à l'ouverture de l'app quand quelque chose de bien s'est passé.
// Chaque compliment a une clé stable : il ne s'affiche qu'une fois (voir storage.ts).

import type { AppData } from './types'
import { daysBetween, deMonth, formatDayLong, formatMonthKey, formatWeekRange } from './dates'
import { formatEurosShort } from './money'
import { goalsPlan, savedBilanFigures } from './calc'
import { computeStats } from './stats'

export interface Compliment {
  key: string
  title: string
  text: string
  /** Plus grand = plus important. */
  weight: number
}

export function compliments(data: AppData, today: string): Compliment[] {
  const out: Compliment[] = []
  const s = computeStats(data, today)
  const name = data.settings.name.trim()
  const hey = name ? `${name}, ` : ''
  const recent = (date: string) => daysBetween(date, today) <= 14

  if (s.dayCount === 1) out.push({ key: 'premier-jour', title: 'C’est parti !', text: `${hey}ta première journée est enregistrée. Chaque journée compte.`, weight: 50 })

  if (s.bestDay && s.dayCount >= 5 && recent(s.bestDay.date))
    out.push({ key: `record-jour:${s.bestDay.date}`, title: 'Nouveau record !', text: `${formatEurosShort(s.bestDay.amount)} en une journée, ${formatDayLong(s.bestDay.date)}. Ta meilleure journée jusqu’ici.`, weight: 90 })

  if (s.bestWeek && s.weekly.length >= 3 && recent(s.bestWeek.monday))
    out.push({ key: `record-semaine:${s.bestWeek.monday}`, title: 'Ta meilleure semaine', text: `${formatEurosShort(s.bestWeek.amount)} la semaine du ${formatWeekRange(s.bestWeek.monday)}. Bravo !`, weight: 85 })

  if (s.bestMonth && s.lastMonth && s.bestMonth.month === s.lastMonth.month && s.monthly.length >= 2)
    out.push({ key: `record-mois:${s.bestMonth.month}`, title: 'Ton meilleur mois', text: `${formatEurosShort(s.bestMonth.total)} en ${formatMonthKey(s.bestMonth.month)}. Jamais tu n’avais autant gagné en un mois.`, weight: 88 })

  if (s.trend && s.trend.change >= 8)
    out.push({ key: `hausse:${today.slice(0, 7)}`, title: 'Tu gagnes de plus en plus', text: `+${Math.round(s.trend.change)} % par journée travaillée sur les 30 derniers jours. Continue comme ça !`, weight: 80 })

  if (s.monthChange !== null && s.monthChange >= 5 && s.lastMonth)
    out.push({ key: `mois-hausse:${s.lastMonth.month}`, title: 'Ça monte', text: `Tu as gagné ${Math.round(s.monthChange)} % de plus en ${formatMonthKey(s.lastMonth.month)} que le mois d’avant.`, weight: 70 })

  const last = [...data.bilans].sort((a, b) => a.month.localeCompare(b.month)).at(-1)
  if (last) {
    const f = savedBilanFigures(last, data)
    if (f.gap > 0) out.push({ key: `bilan-avance:${last.month}`, title: 'En avance sur ton plan', text: `Le mois ${deMonth(last.month)}, tu as mis ${formatEurosShort(f.gap)} de plus que prévu.`, weight: 75 })
  }

  const plan = goalsPlan(data, today)
  for (const g of plan.goals) {
    const step = [100, 75, 50, 25].find((x) => g.progress * 100 >= x)
    if (step)
      out.push({
        key: `objectif:${g.goal.id}:${step}`,
        title: step === 100 ? `${g.goal.name} : objectif atteint !` : `${step} % pour ${g.goal.name}`,
        text: step === 100 ? `Tout est de côté pour « ${g.goal.name} ». Félicitations !` : `Tu as déjà mis de côté ${formatEurosShort(g.saved)} pour « ${g.goal.name} ».`,
        weight: 95,
      })
  }
  if (plan.goals.length > 0 && plan.goals.every((g) => g.onTrack || g.reached) && s.dayCount >= 4 && !plan.goals.some((g) => g.passed))
    out.push({ key: `en-route:${today.slice(0, 7)}`, title: 'Tu es sur la bonne voie', text: plan.goals.length > 1 ? 'À ce rythme, tu atteins tous tes objectifs à temps.' : 'À ce rythme, tu atteins ton objectif à temps.', weight: 60 })

  return out.sort((a, b) => b.weight - a.weight)
}

/** Le compliment à afficher maintenant : le plus important pas encore vu. */
export function nextCompliment(data: AppData, today: string, seen: Set<string>): Compliment | null {
  return compliments(data, today).find((c) => !seen.has(c.key)) ?? null
}
