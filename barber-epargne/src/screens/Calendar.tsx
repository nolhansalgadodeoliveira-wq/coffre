import { useState } from 'react'
import type { ScreenProps } from '../App'
import { dayStatus, defaultStatus, entryOn, trackingStart } from '../lib/calc'
import { addMonths, datesOfMonth, formatDayLong, formatMonthKey, monthKeyOf, weekday, WEEK_ORDER, WEEKDAY_LETTER } from '../lib/dates'
import { formatEuros } from '../lib/money'
import type { DayStatus } from '../lib/types'
import { IconChevronLeft, IconChevronRight } from '../icons'
import { Card, Chip, PrimaryButton, Screen, Segmented } from '../ui'

/**
 * Ce qu'un jour représente, en une seule valeur (c'est ce que montrent les couleurs) :
 * - travaille : une journée est saisie ;
 * - a-saisir : jour de travail passé (depuis tes débuts dans l'app), pas encore saisi ;
 * - prevu / extra : jour de travail à venir (habituel, ou ajouté en plus) ;
 * - repos : ni prévu ni travaillé ;
 * - avant : jour d'avant tes débuts dans l'app, ignoré.
 */
type View = 'travaille' | 'a-saisir' | 'prevu' | 'extra' | 'repos' | 'avant'

const LABEL: Record<View, string> = { travaille: 'Travaillé', 'a-saisir': 'À saisir', prevu: 'Travail prévu', extra: 'Jour en plus', repos: 'Repos', avant: 'Avant tes débuts' }
const STYLE: Record<View, string> = {
  travaille: 'bg-ink text-white',
  'a-saisir': 'border-2 border-dashed border-violet-deep text-ink',
  prevu: 'bg-violet',
  extra: 'bg-orange',
  repos: 'bg-transparent',
  avant: 'bg-transparent text-muted',
}
const DOT: Record<View, string> = {
  travaille: 'bg-ink',
  'a-saisir': 'border-2 border-dashed border-violet-deep',
  prevu: 'bg-violet',
  extra: 'bg-orange',
  repos: 'border border-ink/40',
  avant: '',
}
const LEGEND: [View, string][] = [
  ['travaille', 'Travaillé'],
  ['a-saisir', 'À saisir'],
  ['prevu', 'Prévu'],
  ['extra', 'En plus'],
  ['repos', 'Repos'],
]

/** Mois et jour affichés : gardés quand on va saisir un jour puis qu'on revient (pratique pour rattraper août jour par jour). */
let remembered: { month: string; selected: string } | null = null

export default function Calendar({ data, update, today, open }: ScreenProps) {
  const [month, setMonthState] = useState(remembered?.month ?? monthKeyOf(today))
  const [selected, setSelectedState] = useState(remembered?.selected ?? today)
  const setMonth = (m: string) => {
    remembered = { month: m, selected: remembered?.selected ?? selected }
    setMonthState(m)
  }
  const setSelected = (d: string) => {
    remembered = { month: monthKeyOf(d), selected: d }
    setSelectedState(d)
  }

  const days = datesOfMonth(month)
  const offset = (weekday(days[0]) + 6) % 7 // lundi = 0
  const cells: (string | null)[] = [...Array(offset).fill(null), ...days]
  const start = trackingStart(data, today)

  function view(d: string): View {
    if (entryOn(data, d)) return 'travaille'
    const s = dayStatus(data, d)
    if (s === 'repos') return 'repos'
    if (d < start) return 'avant'
    if (d <= today) return 'a-saisir'
    return s
  }

  const v = view(selected)
  const status = dayStatus(data, selected)
  const usual = defaultStatus(data, selected) === 'prevu'
  const entry = entryOn(data, selected)
  const past = selected <= today

  const counts = { travaille: 0, aSaisir: 0, aVenir: 0 }
  for (const d of days) {
    const x = view(d)
    if (x === 'travaille') counts.travaille++
    else if (x === 'a-saisir') counts.aSaisir++
    else if (x === 'prevu' || x === 'extra') counts.aVenir++
  }

  function setStatus(s: DayStatus) {
    update((d) => {
      const next = { ...d.days }
      if (s === defaultStatus(d, selected)) delete next[selected]
      else next[selected] = s
      return { ...d, days: next }
    })
  }

  const go = (n: number) => {
    const m = addMonths(month, n)
    setMonth(m)
    setSelected(m === monthKeyOf(today) ? today : `${m}-01`)
  }

  return (
    <Screen title="Calendrier">
      <Card className="flex flex-col gap-4 px-3 min-[380px]:px-5">
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={() => go(-1)} aria-label="Mois précédent" className="flex h-11 w-11 items-center justify-center rounded-full bg-field active:scale-95">
            <IconChevronLeft size={20} />
          </button>
          <span className="display text-[1.375rem] first-letter:uppercase">{formatMonthKey(month)}</span>
          <button type="button" onClick={() => go(1)} aria-label="Mois suivant" className="flex h-11 w-11 items-center justify-center rounded-full bg-field active:scale-95">
            <IconChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK_ORDER.map((d) => (
            <span key={d} className="pb-1 text-[0.8125rem] font-medium text-muted">
              {WEEKDAY_LETTER[d]}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const x = view(d)
            const e = entryOn(data, d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-label={`${formatDayLong(d)} : ${e ? `travaillé, ${formatEuros(e.amount)}` : LABEL[x]}`}
                aria-pressed={d === selected}
                className={`num relative flex h-12 items-center justify-center rounded-full text-[1rem] font-medium ${STYLE[x]} ${d === selected ? 'ring-2 ring-ink ring-offset-2' : ''}`}
              >
                {Number(d.slice(8))}
                {d === today && <span className={`absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${e ? 'bg-white' : 'bg-ink'}`} />}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2 px-1 text-[0.8125rem]">
          {LEGEND.map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5 rounded-full bg-field px-3 py-1.5">
              <span className={`h-3 w-3 rounded-full ${DOT[k]}`} /> {l}
            </span>
          ))}
        </div>
      </Card>

      <Card tone={entry ? 'dark' : v === 'extra' ? 'orange' : 'violet'} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1.125rem] font-semibold first-letter:uppercase">{formatDayLong(selected)}</span>
          <Chip dark={!!entry}>{LABEL[v]}</Chip>
        </div>

        {entry ? (
          <div className="flex items-end justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-[0.875rem] text-white/75">Ta part</span>
              <span className="num display text-[2rem]">{formatEuros(entry.amount)}</span>
            </span>
            <button type="button" onClick={() => open({ kind: 'ajout', entryId: entry.id })} className="h-12 rounded-full bg-white px-5 text-[0.9375rem] font-semibold text-ink">
              Modifier
            </button>
          </div>
        ) : past ? (
          // Jour passé (ou aujourd'hui) : soit tu as travaillé (tu saisis), soit non.
          <>
            <p className="text-[0.9375rem] text-ink/85">
              {v === 'a-saisir'
                ? 'Jour de travail pas encore saisi. As-tu travaillé ?'
                : v === 'avant'
                  ? 'Avant ta première journée saisie : ce jour n’est pas compté.'
                  : usual
                    ? 'Marqué en repos. Tu as finalement travaillé ?'
                    : 'Pas un jour de travail habituel. Tu as travaillé quand même ?'}
            </p>
            <PrimaryButton onClick={() => open({ kind: 'ajout', date: selected })}>{v === 'a-saisir' ? 'Oui, saisir ce jour' : 'Saisir ce jour'}</PrimaryButton>
            {v === 'a-saisir' && (
              <button type="button" onClick={() => setStatus('repos')} className="h-12 rounded-full bg-white/65 px-5 text-[0.9375rem] font-semibold active:scale-95">
                Non, je n’ai pas travaillé
              </button>
            )}
            {v === 'repos' && usual && (
              <button type="button" onClick={() => setStatus('prevu')} className="h-11 text-[0.875rem] text-ink/80 underline">
                Annuler le repos
              </button>
            )}
          </>
        ) : (
          // Jour à venir : prévoir un repos exceptionnel ou un jour en plus.
          <>
            <Segmented
              label="Ce jour-là"
              value={status}
              onChange={setStatus}
              className="bg-white/65"
              options={usual ? [{ value: 'prevu', label: 'Je travaille' }, { value: 'repos', label: 'Repos' }] : [{ value: 'repos', label: 'Repos' }, { value: 'extra', label: 'Je travaille en plus' }]}
            />
            <p className="text-[0.8125rem] text-ink/80">Les jours prévus servent aux estimations de fin de mois et des objectifs.</p>
          </>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card tone="blue" className="flex flex-col gap-1 p-4">
          <span className="num display text-[2rem]">{counts.travaille}</span>
          <span className="text-[0.8125rem] text-ink/80">{counts.travaille > 1 ? 'jours travaillés' : 'jour travaillé'}</span>
        </Card>
        <Card tone="orange" className="flex flex-col gap-1 p-4">
          <span className="num display text-[2rem]">{counts.aSaisir}</span>
          <span className="text-[0.8125rem] text-ink/80">à saisir</span>
        </Card>
        <Card tone="violet" className="flex flex-col gap-1 p-4">
          <span className="num display text-[2rem]">{counts.aVenir}</span>
          <span className="text-[0.8125rem] text-ink/80">à venir</span>
        </Card>
      </div>
    </Screen>
  )
}
