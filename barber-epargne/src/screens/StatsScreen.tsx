import { useState, type ReactNode } from 'react'
import type { ScreenProps } from '../App'
import { BarChart, LineChart, type ChartPoint } from '../charts'
import { dailyAverage, monthProjection, plural, activeGoals, categoryTotals, incomeCategories } from '../lib/calc'
import { CategoryBar } from './Summary'
import { computeStats } from '../lib/stats'
import { deMonth, formatDayLong, formatMonthKey, formatWeekRange, monthKeyOf, monthName, monthShort, WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '../lib/dates'
import { formatEuros, formatEurosShort } from '../lib/money'
import { IconCoin, IconScissors, IconStar, IconTrend } from '../icons'
import { Card, DeltaChip, Screen, Segmented } from '../ui'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** « 17 % de plus qu'en septembre » */
function than(change: number, ref: string): string {
  const n = Math.abs(Math.round(change))
  if (n === 0) return `autant ${ref}`
  return `${n} % de ${change > 0 ? 'plus' : 'moins'} ${ref}`
}
const pctLabel = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))} %`

export default function StatsScreen({ data, today, open }: ScreenProps) {
  const s = computeStats(data, today)
  const goalsTotal = activeGoals(data).reduce((a, g) => a + g.amount, 0)
  const [view, setView] = useState<'mois' | 'semaines'>('mois')

  if (s.dayCount === 0) {
    return (
      <Screen title="Stats">
        <Card tone="peach" className="flex flex-col gap-2 p-6">
          <span className="display text-[1.625rem]">Bientôt ici</span>
          <p className="text-[1rem] text-ink/85">Tes statistiques apparaîtront après ta première journée : évolution, records, moyennes et épargne.</p>
        </Card>
      </Screen>
    )
  }

  const monthPoints: ChartPoint[] = s.monthly.slice(-12).map((m) => ({ key: m.month, label: monthShort(m.month), value: m.total, title: cap(formatMonthKey(m.month)) }))
  const weekPoints: ChartPoint[] = s.weekly.slice(-12).map((w) => ({
    key: w.monday,
    label: `${Number(w.monday.slice(8))}/${Number(w.monday.slice(5, 7))}`,
    value: w.total,
    title: `Semaine du ${formatWeekRange(w.monday)}`,
  }))
  const gains = view === 'mois' ? monthPoints : weekPoints
  const avg = view === 'mois' ? s.avgPerMonth : s.avgPerWeek

  const weekdayPoints: ChartPoint[] = WEEK_ORDER.map((d) => s.byWeekday[d])
    .filter((w) => w.count > 0)
    .map((w) => ({ key: String(w.day), label: WEEKDAY_SHORT[w.day].replace('.', ''), value: w.avg, title: `Un ${WEEKDAY_LONG[w.day]}, en moyenne (${plural(w.count, 'jour', 'jours')})` }))
  const clientPoints: ChartPoint[] = s.monthly.filter((m) => m.clients > 0).slice(-12).map((m) => ({ key: m.month, label: monthShort(m.month), value: m.clients, title: cap(formatMonthKey(m.month)) }))
  const savingsPoints: ChartPoint[] = s.cumulative.map((p) => ({ key: p.month, label: monthShort(p.month), value: p.cumulative, title: `Total à la fin ${deMonth(p.month)}` }))

  const cur = monthKeyOf(today)
  const estimate = monthProjection(data, cur, today, dailyAverage(data, today))
  const billedNow = data.bilans.some((b) => b.month === cur)

  // Comparaisons : uniquement celles qu'on peut vraiment calculer, écrites en phrases.
  const comparisons: { change: number; text: ReactNode }[] = []
  if (s.lastMonth && s.monthBefore && s.monthChange !== null)
    comparisons.push({ change: s.monthChange, text: <>En <strong>{monthName(s.lastMonth.month)}</strong>, tu as gagné {than(s.monthChange, `qu’en ${monthName(s.monthBefore.month)}`)}.</> })
  if (s.yearChange && s.lastMonth)
    comparisons.push({ change: s.yearChange.change, text: <>En <strong>{monthName(s.lastMonth.month)}</strong>, tu as gagné {than(s.yearChange.change, 'que le même mois l’an dernier')}.</> })
  if (s.trend) comparisons.push({ change: s.trend.change, text: <>Sur tes <strong>30 derniers jours</strong>, une journée te rapporte {than(s.trend.change, 'que sur les 30 jours d’avant')}.</> })

  return (
    <Screen title="Stats">
      <Card tone="peach" className="grid grid-cols-3 gap-3 p-5">
        <Big value={formatEurosShort(s.total)} label="gagnés en tout" />
        <Big value={String(s.dayCount)} label={s.dayCount > 1 ? 'jours travaillés' : 'jour travaillé'} />
        <Big value={formatEurosShort(s.avgPerDay)} label="par jour" />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => open({ kind: 'resume', period: 'mois', key: today.slice(0, 7) })} className="h-12 rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-white active:scale-95">
          Résumé du mois
        </button>
        <button type="button" onClick={() => open({ kind: 'resume', period: 'annee', key: today.slice(0, 4) })} className="h-12 rounded-full bg-surface px-4 text-[0.9375rem] font-semibold active:scale-95">
          Résumé de l’année
        </button>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[1.1875rem] font-semibold">D’où vient ton argent</span>
          <span className="text-[0.875rem] text-muted">Tout ce que tu as encaissé, par catégorie.</span>
        </div>
        <CategoryBar totals={categoryTotals(data.entries.filter((e) => e.date <= today), data.settings)} cats={incomeCategories(data.settings)} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[1.1875rem] font-semibold">Tes gains</span>
          <span className="text-[0.875rem] text-muted">Ta part, en euros. Touche la courbe pour voir le détail.</span>
        </div>
        <Segmented
          label="Afficher par"
          value={view}
          onChange={setView}
          className="bg-field"
          options={[
            { value: 'mois', label: 'Par mois' },
            { value: 'semaines', label: 'Par semaine' },
          ]}
        />
        <LineChart
          points={gains}
          unit="eur"
          yTitle="Ta part (€)"
          xTitle={view === 'mois' ? 'Mois' : 'Semaine (date du lundi)'}
          summary={view === 'mois' ? 'gains par mois' : 'gains par semaine'}
          color="var(--violet-deep)"
          line={avg !== null && gains.length > 1 ? { value: avg, label: view === 'mois' ? 'Moyenne par mois' : 'Moyenne par semaine' } : undefined}
        />
        {gains.length < 2 && <p className="rounded-2xl bg-blue-soft p-3 text-[0.875rem]">La courbe se dessine à partir de {view === 'mois' ? '2 mois' : '2 semaines'} de données.</p>}
        {!billedNow && estimate.entered + estimate.assumed > 0 && (
          <p className="rounded-2xl bg-violet-soft p-3 text-[0.9375rem]">
            <strong>{cap(monthName(cur))}</strong> : {formatEuros(estimate.entered)} gagnés pour l’instant, environ <strong>{formatEuros(estimate.total)}</strong> à la fin du mois si tu gagnes {formatEurosShort(dailyAverage(data, today))} chaque jour prévu.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile tone="orange" icon={<IconCoin size={20} />} label="Par heure" value={s.perHour !== null ? formatEurosShort(s.perHour) : '–'} sub={`${String(data.settings.hoursPerDay).replace('.', ',')} h par jour`} />
        <Tile tone="violet" icon={<IconCoin size={20} />} label="Par semaine" value={formatEurosShort(s.avgPerWeek)} sub="en moyenne" />
        <Tile tone="pink" icon={<IconCoin size={20} />} label="Par mois" value={s.avgPerMonth !== null ? formatEurosShort(s.avgPerMonth) : '–'} sub={s.avgPerMonth !== null ? 'mois terminés' : 'dès un mois terminé'} />
        <Tile tone="violet" icon={<IconCoin size={20} />} label="Pourboires" value={s.tips > 0 ? formatEurosShort(s.tips) : '–'} sub={s.tips > 0 ? 'reçus en tout, gardés à 100 %' : 'à saisir avec la journée'} />
        <Tile tone="blue" icon={<IconScissors size={20} />} label="Clients" value={s.clients ? String(s.clients.total) : '–'} sub={s.clients ? `${formatEurosShort(s.clients.avgPerClient)} par client` : 'à saisir avec la journée'} />
        {s.bestDay && <Tile tone="orange" icon={<IconStar size={20} />} label="Meilleur jour" value={formatEurosShort(s.bestDay.amount)} sub={formatDayLong(s.bestDay.date)} />}
        {s.bestWeek && <Tile tone="violet" icon={<IconStar size={20} />} label="Meilleure semaine" value={formatEurosShort(s.bestWeek.amount)} sub={formatWeekRange(s.bestWeek.monday)} />}
        {s.bestMonth && <Tile tone="pink" icon={<IconTrend size={20} />} label="Meilleur mois" value={formatEurosShort(s.bestMonth.total)} sub={cap(formatMonthKey(s.bestMonth.month))} />}
      </div>

      {weekdayPoints.length > 1 && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[1.1875rem] font-semibold">Tes meilleurs jours</span>
            <span className="text-[0.875rem] text-muted">Ce que tu gagnes en moyenne selon le jour de la semaine.</span>
          </div>
          <BarChart points={weekdayPoints} unit="eur" yTitle="Ta part (€)" xTitle="Jour de la semaine" summary="gain moyen par jour de la semaine" color="var(--violet-deep)" highlightBest line={{ value: s.avgPerDay, label: 'Moyenne par jour', color: 'var(--orange-deep)' }} />
        </Card>
      )}

      {clientPoints.length > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[1.1875rem] font-semibold">Clients</span>
            <span className="text-[0.875rem] text-muted">Le nombre de clients que tu as saisis, par mois.</span>
          </div>
          <LineChart points={clientPoints} unit="count" countWord="clients" yTitle="Clients" xTitle="Mois" summary="nombre de clients par mois" color="var(--orange-deep)" />
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[1.1875rem] font-semibold">Comparaisons</span>
          <span className="text-[0.875rem] text-muted">Pour voir si tu progresses.</span>
        </div>
        {comparisons.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {comparisons.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <DeltaChip value={Math.round(c.change)}>{pctLabel(c.change)}</DeltaChip>
                <p className="min-w-0 flex-1 text-[1rem]">{c.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-blue-soft p-3 text-[0.9375rem]">Les comparaisons apparaîtront quand tu auras des données sur plusieurs semaines : ton mois contre le précédent, tes 30 derniers jours, et l’an dernier.</p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[1.1875rem] font-semibold">Ton épargne</span>
          <span className="text-[0.875rem] text-muted">Ce que tu as mis de côté, mois après mois (ta part − tes dépenses, ou le montant de ton bilan).</span>
        </div>
        {savingsPoints.length === 0 ? (
          <p className="rounded-2xl bg-blue-soft p-3 text-[0.9375rem]">Ton épargne s’affichera à la fin de ton premier mois de travail.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Big value={formatEurosShort(s.saved)} label="mis de côté en tout" />
              <Big value={s.savingRate !== null ? `${Math.round(s.savingRate)} %` : '–'} label="de ta part épargnée" />
            </div>
            <LineChart
              points={savingsPoints}
              unit="eur"
              yTitle="Épargne cumulée (€)"
              xTitle="Mois"
              summary="épargne cumulée"
              color="var(--good)"
              line={goalsTotal > 0 ? { value: goalsTotal, label: activeGoals(data).length > 1 ? 'Tous tes objectifs' : `Objectif ${activeGoals(data)[0].name}`, color: 'var(--orange-deep)' } : undefined}
            />
            {data.bilans.length > 0 && (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-field p-3 text-[0.9375rem]">
              <span>Écart avec ton plan</span>
              <DeltaChip value={s.gapTotal}>{`${s.gapTotal > 0 ? '+' : s.gapTotal < 0 ? '−' : ''}${formatEuros(Math.abs(s.gapTotal))}`}</DeltaChip>
            </div>
            <p className="text-[0.875rem] text-muted">
              {plural(s.monthsAhead, 'mois en avance', 'mois en avance')}, {plural(s.monthsBehind, 'mois en retard', 'mois en retard')} (mois vérifiés).
            </p>
            </>
            )}
          </>
        )}
      </Card>
    </Screen>
  )
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="num display text-[1.25rem] whitespace-nowrap min-[380px]:text-[1.5rem]">{value}</span>
      <span className="text-[0.8125rem] leading-snug text-ink/80">{label}</span>
    </div>
  )
}

const TILE_TONES = {
  orange: { box: 'border-orange', icon: 'bg-orange' },
  violet: { box: 'border-violet', icon: 'bg-violet' },
  blue: { box: 'border-blue', icon: 'bg-blue' },
  pink: { box: 'border-pink', icon: 'bg-pink' },
}

function Tile({ tone, icon, label, value, sub }: { tone: keyof typeof TILE_TONES; icon: ReactNode; label: string; value: string; sub: string }) {
  const t = TILE_TONES[tone]
  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-[24px] border-2 bg-surface p-4 ${t.box}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>{icon}</span>
        <span className="min-w-0 text-[0.875rem] leading-tight text-muted">{label}</span>
      </div>
      <span className="num display text-[1.625rem] break-words">{value}</span>
      <span className="text-[0.8125rem] leading-snug text-muted">{sub}</span>
    </div>
  )
}
