import { useEffect, useRef, useState } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { loadPrefs } from '../lib/push'
import { autoSaved, trackingStart, bilanFigures, dailyAverage, dayStatus, entriesOfMonth, goalsPlan, MIN_DAYS_FOR_ESTIMATE, monthProjection, monthsWithData, monthSummary, nextGoal, pendingDays, plannedDaysOfMonth, plural } from '../lib/calc'
import { addDays, addMonths, datesOfMonth, formatDay, formatDayLong, mondayOf, monthKeyOf, monthName, weekday, WEEKDAY_SHORT } from '../lib/dates'
import { formatEuros, formatEurosShort, formatSigned } from '../lib/money'
import { backupDue, lastBackupAt, saveBackupFile } from '../lib/backup'
import { newId, scoped } from '../lib/storage'
import type { Bilan } from '../lib/types'
import { IconChevronLeft, IconChevronRight, IconPlus, IconStar } from '../icons'
import Logo from '../Logo'
import Shapes from '../Shapes'
import { Card, Chip, DeltaChip, PrimaryButton, ProgressBar, Row } from '../ui'

const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** « Vérification du mois » masquée par l'utilisateur, par mois. */
const checkKey = (month: string) => scoped(`coffre-verif:${month}`)
function checkHidden(month: string): boolean {
  try {
    return localStorage.getItem(checkKey(month)) === '1'
  } catch {
    return false
  }
}
function hideCheck(month: string): void {
  try {
    localStorage.setItem(checkKey(month), '1')
  } catch {
    /* ignoré */
  }
}

export default function Home({ data, update, sync, today, open, homeMonth: month, setHomeMonth: setMonth, compliment, dismissCompliment }: ScreenProps) {
  const [backupHidden, setBackupHidden] = useState(false)
  const [checkClosed, setCheckClosed] = useState(false)

  const s = data.settings
  const cur = monthKeyOf(today)
  const isCurrent = month === cur
  const sum = monthSummary(data, month, today)
  const plan = goalsPlan(data, today)
  const upcoming = nextGoal(data, today)
  const upcomingPlan = upcoming ? plan.goals.find((g) => g.goal.id === upcoming.id) : undefined
  const name = monthName(month)
  const entries = entriesOfMonth(data, month)
  const avg = dailyAverage(data, today)

  // Rappel dans l'app : aujourd'hui après l'heure du rappel, ou un jour récent oublié.
  const now = new Date()
  const [rh, rm] = loadPrefs().time.split(':').map(Number)
  const afterReminder = now.getHours() * 60 + now.getMinutes() >= rh * 60 + rm
  const lateDays = pendingDays(data, today, 2).filter((d) => d < today || afterReminder)
  const late = lateDays.length > 0 ? { date: lateDays[0], more: lateDays.length - 1 } : null

  // Vérification du mois dernier : une seule question au lieu d'un bilan complet.
  const prev = addMonths(cur, -1)
  const prevExpected = autoSaved(data, prev)
  const showCheck = !checkClosed && monthsWithData(data).includes(prev) && !data.bilans.some((b) => b.month === prev) && !checkHidden(prev)
  function confirmPrev() {
    const total = entriesOfMonth(data, prev).reduce((a, e) => a + e.amount, 0)
    const stamp = nowIso()
    const bilan: Bilan = { id: newId(), month: prev, expensesKept: true, actual: prevExpected, personalExpenses: s.personalExpenses, commission: s.commission, total, expected: prevExpected, createdAt: today, updatedAt: stamp }
    update((d) => {
      const deleted = { ...d.deleted }
      delete deleted['b:' + prev]
      return { ...d, deleted, bilans: [...d.bilans.filter((b) => b.month !== prev), bilan] }
    })
  }

  // Semaine en cours (lundi → dimanche) et semaine d'avant.
  const monday = mondayOf(today)
  const weekEntries = (from: string) => data.entries.filter((e) => e.date >= from && e.date <= addDays(from, 6))
  const thisWeek = weekEntries(monday)
  const lastWeek = weekEntries(addDays(monday, -7))
  const total = (l: typeof thisWeek) => l.reduce((a, e) => a + e.amount, 0)

  // Objectif du mois, exprimé en ENCAISSÉ (ce que tu vois à la caisse) : de quoi tenir tous tes objectifs.
  const c = s.commission
  const needShare =
    plan.perMonth > 0 ? Math.round((plan.perMonth + s.personalExpenses + (c.enabled && c.mode === 'fixed' ? c.value : 0)) / (c.enabled && c.mode === 'percent' ? Math.max(0.01, 1 - c.value / 100) : 1)) : 0
  const needGross = Math.round((needShare * 100) / s.keepPct)
  const grossSoFar = entries.reduce((a, e) => a + e.gross, 0)
  const daysLeftInMonth = plannedDaysOfMonth(data, month).filter((d) => d >= today && !sum.entered.includes(d)).length
  const target = isCurrent && needGross > 0 ? { needGross, perDay: daysLeftInMonth > 0 ? Math.max(0, Math.round((needGross - grossSoFar) / daysLeftInMonth)) : 0, reached: grossSoFar >= needGross } : null

  // Fin du mois estimée à ce rythme (mois en cours ou à venir).
  const est = month >= cur && data.entries.length > 0 ? monthProjection(data, month, today, avg) : null
  // Épargne d'un mois terminé : bilan s'il existe, sinon calcul automatique.
  const monthSaved = month < cur && sum.hasData ? (sum.bilan ? sum.bilan.actual : bilanFigures(sum.total, s.personalExpenses, s.commission).expected) : null

  // Le rappel de fichier de sauvegarde ne sert que si la copie en ligne ne passe pas.
  const showBackup = !backupHidden && !sync.lastSyncAt && backupDue(data, lastBackupAt())
  const enough = plan.enoughData
  const missingDays = Math.max(0, MIN_DAYS_FOR_ESTIMATE - data.entries.filter((e) => e.date <= today).length)

  // Jours à montrer dans la bande : jours prévus ou saisis du mois.
  const strip = datesOfMonth(month).filter((d) => dayStatus(data, d) !== 'repos' || entries.some((e) => e.date === d))
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-today="1"]') as HTMLElement | null
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [month])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
          <Logo size={30} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[1.125rem] font-semibold">Bonjour{s.name ? ` ${s.name}` : ''}</span>
          <span className="text-[0.875rem] text-muted">Aujourd’hui {shortFmt.format(new Date())}</span>
        </div>
        {upcoming && upcomingPlan && (
          <span className="num flex h-12 max-w-[42%] shrink-0 flex-col items-center justify-center rounded-full bg-surface px-4 leading-tight" aria-label={`${upcomingPlan.daysLeft} jours avant ${upcoming.name}`}>
            <span className="text-[0.9375rem] font-semibold">J-{upcomingPlan.daysLeft}</span>
            <span className="max-w-full truncate text-[0.6875rem] text-muted">
              {upcoming.emoji} {upcoming.name}
            </span>
          </span>
        )}
      </header>

      {compliment && (
        <Card tone="pink" className="relative overflow-hidden">
          <Shapes variant="small" className="pointer-events-none absolute -right-4 -bottom-6 h-28 w-28 opacity-90" />
          <div className="relative flex max-w-[75%] flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[0.875rem] font-medium text-ink/80">
              <IconStar size={18} /> Bravo
            </span>
            <span className="display text-[1.5rem]">{compliment.title}</span>
            <p className="text-[0.9375rem] text-ink/85">{compliment.text}</p>
          </div>
          <button type="button" onClick={() => dismissCompliment?.()} aria-label="Fermer" className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/60 text-[1.25rem]">
            ×
          </button>
        </Card>
      )}

      {/* Action principale, toujours en haut */}
      {late ? (
        <Card tone="orange" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[1.125rem] font-semibold">{late.date === today ? 'Ta journée est finie ?' : `Il manque ${formatDayLong(late.date)}`}</span>
            <p className="text-[0.9375rem] text-ink/85">
              {late.date === today ? 'Combien as-tu encaissé aujourd’hui ?' : 'Saisis-le, ou marque-le en repos dans le calendrier.'}
              {late.more > 0 && ` (+${late.more} autre${late.more > 1 ? 's' : ''} à saisir)`}
            </p>
          </div>
          <PrimaryButton onClick={() => open({ kind: 'ajout', date: late.date })} icon={<IconPlus size={20} />}>
            Saisir maintenant
          </PrimaryButton>
        </Card>
      ) : (
        <PrimaryButton onClick={() => open({ kind: 'ajout', month })} icon={<IconPlus size={20} />}>
          Ajouter ma journée
        </PrimaryButton>
      )}

      {showCheck && (
        <Card tone="blue" className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-[1rem]">
              <strong>{monthName(prev).replace(/^./, (x) => x.toUpperCase())}</strong> : as-tu bien mis <strong>{formatEurosShort(prevExpected)}</strong> de côté ?
            </p>
            <button type="button" onClick={() => (hideCheck(prev), setCheckClosed(true))} aria-label="Ne plus demander pour ce mois" className="-mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 text-[1.25rem]">
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={confirmPrev} className="h-11 flex-1 rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-white active:scale-95">
              Oui
            </button>
            <button type="button" onClick={() => open({ kind: 'bilan', month: prev })} className="h-11 flex-1 rounded-full bg-white px-4 text-[0.9375rem] font-semibold active:scale-95">
              Un autre montant
            </button>
          </div>
        </Card>
      )}

      {/* Objectifs : épargne répartie par date, le plus proche d'abord */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Chip className="bg-violet-soft">{plan.goals.length > 1 ? 'Mes objectifs' : 'Mon objectif'}</Chip>
          <button type="button" onClick={() => open({ kind: 'objectifs' })} className="h-11 rounded-full px-3 text-[0.875rem] font-semibold active:scale-95">
            Gérer
          </button>
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[0.875rem] text-muted">Déjà de côté</span>
            <span className="num display text-[2.25rem]">{formatEurosShort(plan.available)}</span>
          </span>
          {plan.goals.length > 0 && (
            <span className="num pb-1 text-right text-[0.9375rem] text-muted">
              sur <span className="font-semibold text-ink">{formatEurosShort(plan.goals.reduce((a, g) => a + g.goal.amount, 0))}</span>
            </span>
          )}
        </div>

        {plan.goals.length === 0 ? (
          <PrimaryButton onClick={() => open({ kind: 'objectif' })} icon={<IconPlus size={20} />}>
            Ajouter un objectif
          </PrimaryButton>
        ) : (
          <ul className="flex flex-col gap-4">
            {plan.goals.map((g) => (
              <li key={g.goal.id}>
                <button type="button" onClick={() => open({ kind: 'objectif', goalId: g.goal.id })} className="flex w-full flex-col gap-2 text-left" aria-label={`${g.goal.name} : ${formatEurosShort(g.saved)} sur ${formatEurosShort(g.goal.amount)}, modifier`}>
                  <span className="flex items-center gap-2.5">
                    <span className="text-[1.25rem]" aria-hidden="true">
                      {g.goal.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{g.goal.name}</span>
                    <span className="num shrink-0 text-[0.875rem] text-muted">
                      <span className="font-semibold text-ink">{formatEurosShort(g.saved)}</span> / {formatEurosShort(g.goal.amount)}
                    </span>
                  </span>
                  <ProgressBar value={g.progress} label={`${g.goal.name} : ${Math.round(g.progress * 100)} %`} className="h-3 bg-line" fill={g.reached ? 'bg-good' : 'bg-violet-deep'} />
                  <span className={`text-[0.8125rem] ${g.reached ? 'font-medium text-good' : 'text-muted'}`}>
                    {g.reached
                      ? 'Atteint ✓'
                      : g.passed
                        ? 'Date passée : touche pour la repousser, ou « Gérer » pour le marquer comme fait.'
                        : `${formatEurosShort(g.perMonth)}/mois jusqu’au ${formatDay(g.goal.date)}${enough ? (g.onTrack ? ' · dans les temps' : ` · à ce rythme ${Math.round(g.projectedPct * 100)} %`) : ''}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {plan.goals.length > 0 && !plan.goals.every((g) => g.reached) && (
          <p className="rounded-2xl bg-field p-3 text-[0.9375rem]">
            {!enough
              ? `Encore ${plural(missingDays, 'journée', 'journées')} à saisir pour savoir si tu es dans les temps.`
              : plan.goals.every((g) => g.onTrack || g.reached || g.passed)
                ? `Tu es dans les temps : à ${formatEurosShort(plan.perDay)} par jour travaillé, tu atteins ${plan.goals.length > 1 ? 'tous tes objectifs' : 'ton objectif'}.`
                : `Pour tout tenir : ${formatEurosShort(plan.perMonth)} de côté par mois${plan.avgSavedPerMonth !== null ? ` (ces derniers mois : ${formatEurosShort(plan.avgSavedPerMonth)})` : ''}.`}
          </p>
        )}
      </Card>

      {/* Mois */}
      <Card tone="violet" className="relative overflow-hidden p-6">
        <Shapes className="bob pointer-events-none absolute -top-5 -right-5 h-28 w-28 min-[380px]:h-32 min-[380px]:w-32" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mois précédent" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 active:scale-95">
              <IconChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mois suivant" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/50 active:scale-95">
              <IconChevronRight size={18} />
            </button>
            <Chip>{month.slice(0, 4)}</Chip>
          </div>
          <h1 className="display pt-1 text-[2.25rem] first-letter:uppercase min-[380px]:text-[2.5rem]">{name}</h1>
          <div className="flex flex-col gap-1">
            <span className="num display text-[2.5rem] min-[380px]:text-[2.875rem]">{formatEurosShort(sum.total)}</span>
            <span className="text-[0.9375rem] font-medium text-ink/80">
              Ta part · {plural(sum.entered.length, 'jour travaillé', 'jours travaillés')}
            </span>
          </div>

          {target && (
            <div className="flex flex-col gap-2 rounded-2xl bg-white/55 p-3">
              <div className="flex items-baseline justify-between gap-3 text-[0.875rem]">
                <span className="font-semibold">Objectif du mois</span>
                <span className="num">
                  <strong>{formatEurosShort(grossSoFar)}</strong> / {formatEurosShort(target.needGross)} encaissés
                </span>
              </div>
              <ProgressBar value={grossSoFar / target.needGross} label={`Objectif du mois : ${Math.round((grossSoFar / target.needGross) * 100)} %`} className="h-2.5 bg-white/70" fill={target.reached ? 'bg-good' : 'bg-ink'} />
              <span className="text-[0.8125rem] text-ink/85">
                {target.reached
                  ? 'Atteint : tes objectifs sont tenus ce mois-ci. ✓'
                  : daysLeftInMonth > 0
                    ? `Encaisse environ ${formatEurosShort(target.perDay)} par jour sur les ${plural(daysLeftInMonth, 'jour prévu restant', 'jours prévus restants')}.`
                    : 'Plus de jour prévu ce mois-ci.'}
              </span>
            </div>
          )}

          {est && est.assumedDays > 0 && enough && (
            <p className="text-[0.875rem] text-ink/85">
              Fin {name}, à ce rythme : <strong className="num">≈ {formatEurosShort(est.total)}</strong> de part
              {est.assumedPast > 0 && ` · ${plural(est.assumedPast, 'jour passé à saisir', 'jours passés à saisir')}`}
            </p>
          )}

          {monthSaved !== null && (
            <button type="button" onClick={() => (sum.bilan ? open({ kind: 'bilan', bilanId: sum.bilan.id }) : open({ kind: 'bilan', month }))} className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 p-3 text-left text-[0.875rem]">
              <span>
                Mis de côté : <strong className="num">{formatEurosShort(monthSaved)}</strong> {sum.bilan ? '(vérifié)' : '(calcul automatique)'}
              </span>
              <span className="font-semibold underline">Corriger</span>
            </button>
          )}
        </div>
      </Card>

      {/* Bande des jours du mois : noir = saisi */}
      <div ref={stripRef} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <ul className="flex gap-2" aria-label={`Jours de travail de ${name}`}>
          {strip.map((d) => {
            const e = entries.find((x) => x.date === d)
            const future = d > today
            // Avant ta première journée saisie : pas « à saisir ».
            const before = !e && d < trackingStart(data, today)
            const extra = dayStatus(data, d) === 'extra'
            return (
              <li key={d} className="snap-start">
                <button
                  type="button"
                  data-today={d === today ? '1' : undefined}
                  disabled={future && !e}
                  onClick={() => open(e ? { kind: 'ajout', entryId: e.id } : { kind: 'ajout', date: d })}
                  aria-label={`${formatDayLong(d)} : ${e ? formatEuros(e.amount) : future ? 'à venir' : before ? 'avant tes débuts' : 'à saisir'}`}
                  className={`flex h-[84px] w-[60px] flex-col items-center justify-center gap-0.5 rounded-full border-[1.5px] active:scale-95 ${
                    e ? 'border-ink bg-ink text-white' : future || before ? 'border-line text-muted' : 'border-dashed border-violet-deep bg-surface text-ink'
                  } ${d === today ? 'ring-2 ring-violet ring-offset-2 ring-offset-bg' : ''}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${e ? 'bg-white' : extra ? 'bg-orange' : 'bg-transparent'}`} />
                  <span className={`text-[0.8125rem] ${e ? 'text-white/80' : 'text-muted'}`}>{WEEKDAY_SHORT[weekday(d)]}</span>
                  <span className="num text-[1.125rem] font-semibold">{Number(d.slice(8))}</span>
                </button>
              </li>
            )
          })}
          <li className="snap-start">
            <button type="button" onClick={() => open({ kind: 'ajout', month })} aria-label="Ajouter un autre jour" className="flex h-[84px] w-[60px] flex-col items-center justify-center gap-1 rounded-full border-[1.5px] border-dashed border-ink/40 text-ink active:scale-95">
              <IconPlus size={20} />
              <span className="text-[0.75rem]">autre</span>
            </button>
          </li>
        </ul>
      </div>

      {isCurrent && (thisWeek.length > 0 || lastWeek.length > 0) && (
        <Card className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[0.875rem] text-muted">Cette semaine</span>
            <span className="num text-[1.375rem] font-semibold">{thisWeek.length > 0 ? formatEurosShort(total(thisWeek)) : 'Pas encore'}</span>
          </span>
          <span className="flex flex-col items-end gap-1 text-right">
            <span className="text-[0.875rem] text-muted">Semaine dernière : {formatEurosShort(total(lastWeek))}</span>
            {lastWeek.length > 0 && thisWeek.length > 0 && <DeltaChip value={total(thisWeek) - total(lastWeek)}>{formatSigned(total(thisWeek) - total(lastWeek))}</DeltaChip>}
          </span>
        </Card>
      )}

      {entries.length > 0 && (
        <Card className="py-2">
          <div className="flex flex-col divide-y divide-line">
            {[...entries].reverse().map((e) => (
              <button key={e.id} type="button" onClick={() => open({ kind: 'ajout', entryId: e.id })} className="text-left">
                <Row label={<span className="text-ink">{formatDayLong(e.date)}</span>} value={<span className="font-semibold">{formatEuros(e.amount)}</span>} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {showBackup && (
        <div className="flex items-center gap-3 rounded-2xl bg-blue-soft px-4 py-2 text-[0.875rem]">
          <span className="min-w-0 flex-1">Pas de fichier de sauvegarde depuis 7 jours.</span>
          <button type="button" onClick={() => void saveBackupFile(data, today).then((r) => r !== 'cancelled' && setBackupHidden(true))} className="h-11 shrink-0 font-semibold underline">
            Sauvegarder
          </button>
        </div>
      )}
    </div>
  )
}
