import { useState, type FormEvent } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { defaultStatus, entryKeepPct, incomeCategories, isBilled, mainCategory, monthSummary, shareOf, pendingDays, suggestedDay, validateEntry, type EntryError } from '../lib/calc'
import { addDays, formatDayLong, isValidIso, monthKeyOf, weekday, WEEKDAY_SHORT } from '../lib/dates'
import { centsToInput, formatEuros, parseEuros } from '../lib/money'
import { newId } from '../lib/storage'
import type { AppData, Entry } from '../lib/types'
import { MAX_CLIENTS, MAX_DAY_GROSS } from '../lib/types'
import { IconCheck, IconChevronLeft, IconChevronRight } from '../icons'
import { Card, Chip, DangerButton, Field, inputClass, MoneyInput, PrimaryButton, Screen, SecondaryButton } from '../ui'

const ERRORS: Record<EntryError, string> = {
  'pourcentage-invalide': 'Indique un pourcentage entre 1 et 100.',
  'date-invalide': 'Choisis une date valide.',
  'date-future': 'Ce jour n’est pas encore passé.',
  'date-ancienne': 'Cette date est trop ancienne.',
  'montant-vide': 'Indique ce que tu as encaissé. Mets 0 si tu n’as rien gagné.',
  'montant-invalide': 'Ce montant n’est pas valide. Exemple : 245,50.',
  'montant-trop-grand': `C’est beaucoup pour une journée (maximum ${formatEuros(MAX_DAY_GROSS)}). Vérifie le montant.`,
  'deja-saisi': 'Ce jour est déjà saisi. Touche-le sur l’accueil ou dans l’historique pour le modifier.',
  'clients-invalide': `Le nombre de clients doit être un nombre entier entre 0 et ${MAX_CLIENTS}.`,
}

export default function AddDay({
  data,
  update,
  today,
  open,
  close,
  entryId,
  month: monthProp,
  date: dateProp,
  setHomeMonth,
}: ScreenProps & { entryId?: string; month?: string; date?: string }) {
  const editing = data.entries.find((e) => e.id === entryId)
  // Part gardée : celle des réglages, modifiable pour ce jour précis (et celle du jour pour une journée existante).
  const initialPct = editing ? entryKeepPct(editing, data.settings.keepPct) : data.settings.keepPct
  const [pctText, setPctText] = useState(String(initialPct).replace('.', ','))
  const [pctOpen, setPctOpen] = useState(initialPct !== data.settings.keepPct)
  const pctNum = Number(pctText.replace(',', '.'))
  const pctValid = Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100
  const keepPct = pctValid ? pctNum : initialPct
  const [date, setDate] = useState(editing?.date ?? dateProp ?? suggestedDay(data, monthProp, today))
  // Catégories du métier : la principale reçoit le montant du grand champ ; les autres se détaillent à la demande.
  const cats = incomeCategories(data.settings)
  const main = mainCategory(data.settings)
  const tipsCat = cats.find((c) => c.kind === 'tips')
  const extras = cats.filter((c) => c.id !== main.id && c.kind !== 'tips')
  const initialParts: Record<string, number> = { ...(editing?.parts ?? {}) }
  const initialPartsSum = Object.values(initialParts).reduce((x, y) => x + y, 0)
  const [amount, setAmount] = useState(editing ? centsToInput(editing.gross - initialPartsSum) : '')
  const [partText, setPartText] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initialParts).map(([k, v]) => [k, centsToInput(v)])))
  const [shown, setShown] = useState<string[]>(() => Object.keys(initialParts))
  const [tips, setTips] = useState(editing?.tips ? centsToInput(editing.tips) : '')
  const [clients, setClients] = useState(editing?.clients != null ? String(editing.clients) : '')
  const [error, setError] = useState<EntryError | null>(null)

  const opt = (t: string) => (t.trim() === '' ? 0 : parseEuros(t))
  const mainCents = opt(amount)
  const partCents: Record<string, number | null> = Object.fromEntries(shown.map((k) => [k, opt(partText[k] ?? '')]))
  const partsValid = Object.values(partCents).every((v) => v !== null)
  const partsSum = Object.values(partCents).reduce<number>((x, y) => x + (y ?? 0), 0)
  const anyText = [amount, ...shown.map((k) => partText[k] ?? '')].some((t) => t.trim() !== '')
  const cents = mainCents === null || !partsValid || !anyText ? null : mainCents + partsSum
  const detailed = shown.length > 0
  const homeIds = new Set(cats.filter((c) => c.kind === 'home').map((c) => c.id))
  const homeCents = shown.filter((k) => homeIds.has(k)).reduce((x, k) => x + (partCents[k] ?? 0), 0)
  const homePct = data.settings.homeKeepPct ?? keepPct
  const tipsCents = tips.trim() === '' ? 0 : parseEuros(tips)
  // Journée existante sans changement de montants ni de % : on garde exactement sa part (pas d'écart d'arrondi).
  const sameParts = () => shown.length === Object.keys(initialParts).length && shown.every((k) => partCents[k] === initialParts[k])
  const unchanged = (c: number) => editing && c === editing.gross && keepPct === initialPct && sameParts()
  const baseShare = (c: number) => (unchanged(c) ? editing!.amount - (editing!.tips ?? 0) : shareOf(c, homeCents, keepPct, homePct))
  const share = cents === null || tipsCents === null || !pctValid ? null : baseShare(cents) + tipsCents
  // Indépendant (part gardée 100 %) : pas de partage, on parle simplement de « recettes ».
  const independent = data.settings.keepPct === 100 && keepPct === 100 && !homeIds.size
  const valid = isValidIso(date)
  const usual = valid && defaultStatus(data, date) === 'prevu'
  const billed = valid && isBilled(data, date)
  const existing = valid ? data.entries.find((e) => e.date === date && e.id !== editing?.id) : undefined
  const pending = pendingDays(data, today, 31).filter((d) => d !== date).slice(0, 6)
  const dateError = error === 'date-invalide' || error === 'date-future' || error === 'date-ancienne' || error === 'deja-saisi' ? ERRORS[error] : null

  function pick(d: string) {
    setDate(d)
    setError(null)
  }

  function save(continueTo?: string) {
    const n = clients.trim() === '' ? null : Number(clients)
    const err = validateEntry({ date, text: anyText ? 'ok' : '', cents, clients: n, id: editing?.id }, data.entries, today)
    setError(err)
    if (err || cents === null) return
    if (tipsCents === null) return setError('montant-invalide')
    if (!pctValid) return setError('pourcentage-invalide')

    const stamp = nowIso()
    const entry: Entry = {
      id: editing?.id ?? newId(),
      date,
      gross: cents,
      // Ta part est figée à la saisie : changer la part gardée plus tard ne réécrit pas le passé.
      amount: baseShare(cents) + tipsCents,
      keepPct,
      ...(partsSum > 0 ? { parts: Object.fromEntries(Object.entries(partCents).filter(([, v]) => (v ?? 0) > 0)) as Record<string, number> } : {}),
      ...(tipsCents > 0 ? { tips: tipsCents } : {}),
      ...(n != null ? { clients: n } : {}),
      updatedAt: stamp,
    }
    const apply = (d: AppData): AppData => {
      const deleted = { ...d.deleted }
      delete deleted['e:' + date]
      if (editing && editing.date !== date) deleted['e:' + editing.date] = stamp
      const days = { ...d.days }
      // Journée déplacée : l'ancien jour n'est plus « en plus ».
      if (editing && editing.date !== date && days[editing.date] === 'extra') delete days[editing.date]
      // Un jour hors des habitudes devient un « jour en plus » dans le calendrier.
      if (defaultStatus(d, date) === 'repos') days[date] = 'extra'
      else if (days[date] === 'repos') delete days[date]
      return { ...d, entries: [...d.entries.filter((e) => e.id !== entry.id), entry], deleted, days }
    }
    update(apply)
    const month = monthKeyOf(date)
    setHomeMonth(month)

    if (continueTo) {
      setDate(continueTo)
      setAmount('')
      setPartText({})
      setShown([])
      setTips('')
      setPctText(String(data.settings.keepPct).replace('.', ','))
      setPctOpen(false)
      setClients('')
      setError(null)
      return
    }
    // Dernier jour prévu du mois saisi : le bilan du mois s'ouvre.
    const sum = monthSummary(apply(data), month, today)
    if (!editing && sum.due && date >= sum.lastPlanned) open({ kind: 'bilan', month })
    else close()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    save()
  }

  const nextPending = pending.find((d) => d !== date)

  return (
    <Screen title={editing ? 'Modifier ma journée' : 'Ma journée'} back={close}>
      {!editing && pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[0.875rem] text-muted">Jours prévus à saisir</span>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {pending.map((d) => (
              <button key={d} type="button" onClick={() => pick(d)} className="h-11 shrink-0 rounded-full bg-surface px-4 text-[0.9375rem] font-medium active:scale-95">
                {WEEKDAY_SHORT[weekday(d)]} {Number(d.slice(8))}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Card tone="violet" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Jour précédent" onClick={() => valid && pick(addDays(date, -1))} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/65 active:scale-95">
              <IconChevronLeft size={20} />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span className="display text-[1.5rem] first-letter:uppercase">{valid ? formatDayLong(date) : '—'}</span>
              {valid && !usual && <Chip className="mt-1">{data.days[date] === 'extra' ? 'Jour en plus' : 'Pas un jour habituel'}</Chip>}
            </div>
            <button
              type="button"
              aria-label="Jour suivant"
              onClick={() => valid && pick(addDays(date, 1))}
              disabled={valid && addDays(date, 1) > today}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/65 active:scale-95 disabled:opacity-30"
            >
              <IconChevronRight size={20} />
            </button>
          </div>
          <label htmlFor="date" className="sr-only">
            Choisir une date
          </label>
          <input id="date" type="date" value={date} max={today} onChange={(e) => pick(e.target.value)} className={`${inputClass} bg-white/70 text-center`} />
          {valid && !usual && !editing && data.days[date] !== 'extra' && !dateError && !existing && (
            <p className="rounded-2xl bg-white/85 p-3 text-[0.875rem]">
              {formatDayLong(date).replace(/^./, (x) => x.toUpperCase())} n’est pas un de tes jours de travail habituels. Si tu enregistres, il sera compté comme <strong>jour en plus</strong>.
            </p>
          )}
          {dateError && (
            <p role="alert" className="rounded-2xl bg-white/85 p-3 text-[0.875rem] text-bad">
              {dateError}
            </p>
          )}
          {!dateError && existing && (
            <button type="button" onClick={() => open({ kind: 'ajout', entryId: existing.id })} className="rounded-2xl bg-white/85 p-3 text-left text-[0.875rem]">
              Ce jour est déjà saisi ({formatEuros(existing.amount)}). <span className="font-semibold underline">Le modifier</span>
            </button>
          )}
        </Card>

        <Card tone="orange" className="flex flex-col gap-3">
          <label htmlFor="amount" className="flex items-center gap-2 text-[1rem] font-semibold">
            {detailed && <Dot color={main.color} />}
            {detailed ? main.label : 'Total encaissé'}
          </label>
          <MoneyInput id="amount" value={amount} onChange={(v) => (setAmount(v), setError(null))} large onTone />
          {extras
            .filter((c) => shown.includes(c.id))
            .map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <label htmlFor={`part-${c.id}`} className="flex items-center gap-2 text-[0.9375rem] font-medium">
                  <Dot color={c.color} /> {c.label}
                  {c.kind === 'home' && homePct !== keepPct && <span className="text-[0.8125rem] font-normal text-ink/75">(tu gardes {String(homePct).replace('.', ',')} %)</span>}
                </label>
                <MoneyInput id={`part-${c.id}`} value={partText[c.id] ?? ''} onChange={(v) => (setPartText((t) => ({ ...t, [c.id]: v })), setError(null))} onTone />
              </div>
            ))}
          {extras.some((c) => !shown.includes(c.id)) && (
            <div className="flex flex-wrap gap-2">
              {extras
                .filter((c) => !shown.includes(c.id))
                .map((c) => (
                  <button key={c.id} type="button" onClick={() => setShown((l) => [...l, c.id])} className="flex h-11 items-center gap-2 rounded-full bg-white/70 px-4 text-[0.9375rem] font-medium active:scale-95">
                    <Dot color={c.color} /> + {c.label}
                  </button>
                ))}
            </div>
          )}
          {detailed && cents !== null && <p className="num text-[0.9375rem] font-medium">Total encaissé : {formatEuros(cents)}</p>}
          {(error === 'montant-vide' || error === 'montant-invalide' || error === 'montant-trop-grand') && (
            <p role="alert" className="text-[0.875rem] font-medium text-bad">
              {ERRORS[error]}
            </p>
          )}
        </Card>

        {(tipsCat || tips.trim() !== '') && (
        <Card className="flex flex-col gap-3">
          <label htmlFor="tips" className="flex items-center gap-2 text-[1rem] font-semibold">
            <Dot color={tipsCat?.color ?? 'var(--cat-pourboires)'} /> {tipsCat?.label ?? 'Pourboires'} (facultatif)
          </label>
          <MoneyInput id="tips" value={tips} onChange={(v) => setTips(v)} />
          <p className="text-[0.8125rem] text-muted">Les pourboires te reviennent en entier : ils ne sont pas partagés.</p>
        </Card>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-6 text-white">
            <span className="flex flex-col">
              <span className="text-[0.9375rem] font-medium">{independent ? 'Recettes du jour' : 'Ta part'}</span>
              <span className="text-[0.75rem] text-white/75">{independent ? 'Tout ce que tu as encaissé' : `Tu gardes ${String(keepPct).replace('.', ',')} %${tipsCat ? ' + pourboires' : ''}`}</span>
            </span>
            <span className="num display rounded-full bg-white px-5 py-3 text-[1.375rem] text-ink">{share === null ? '–' : formatEuros(share)}</span>
          </div>
          {pctOpen ? (
            <Card className="flex flex-col gap-3">
              <Field
                label="Part gardée ce jour-là (%)"
                htmlFor="pct"
                hint={`Seulement pour cette journée. Tes réglages restent à ${String(data.settings.keepPct).replace('.', ',')} %.`}
                error={error === 'pourcentage-invalide' ? 'Indique un pourcentage entre 1 et 100.' : null}
              >
                <div className="relative">
                  <input id="pct" inputMode="decimal" value={pctText} onChange={(e) => (setPctText(e.target.value), setError(null))} className={`${inputClass} num pr-10`} />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">%</span>
                </div>
              </Field>
              <div className="flex flex-wrap gap-2">
                {[...new Set([data.settings.keepPct, 40, 50, 60, 100])].map((p) => (
                  <button key={p} type="button" aria-pressed={keepPct === p} onClick={() => (setPctText(String(p).replace('.', ',')), setError(null))} className={`h-11 rounded-full px-4 text-[0.9375rem] font-medium active:scale-95 ${keepPct === p ? 'bg-ink text-white' : 'bg-field'}`}>
                    {String(p).replace('.', ',')} %
                  </button>
                ))}
              </div>
            </Card>
          ) : independent ? null : (
            <button type="button" onClick={() => setPctOpen(true)} className="h-11 self-center text-[0.9375rem] font-medium underline underline-offset-2">
              Autre pourcentage ce jour-là ?
            </button>
          )}
        </div>

        <Card className="flex flex-col gap-3">
          <Field label="Nombre de clients (facultatif)" htmlFor="clients" error={error === 'clients-invalide' ? ERRORS[error] : null}>
            <input id="clients" inputMode="numeric" autoComplete="off" value={clients} onChange={(e) => setClients(e.target.value)} className={`${inputClass} num`} />
          </Field>
        </Card>

        {billed && (
          <p className="rounded-2xl bg-blue-soft p-4 text-[0.875rem]">
            Ce mois a déjà un bilan validé. Modifier cette journée ne change pas le bilan ; tu pourras le mettre à jour depuis l’historique.
          </p>
        )}

        <PrimaryButton type="submit" icon={<IconCheck size={20} />}>
          Enregistrer
        </PrimaryButton>
        {!editing && nextPending && (
          <SecondaryButton onClick={() => save(nextPending)}>
            Enregistrer et saisir {WEEKDAY_SHORT[weekday(nextPending)]} {Number(nextPending.slice(8))}
          </SecondaryButton>
        )}
      </form>

      {editing && (
        <DangerButton
          confirmText="Confirmer la suppression"
          onConfirm={() => {
            const stamp = nowIso()
            update((d) => {
              // Une journée supprimée sur un jour « en plus » : ce jour redevient un jour de repos (sinon il resterait « à saisir »).
              const days = { ...d.days }
              if (days[editing.date] === 'extra') delete days[editing.date]
              return { ...d, days, entries: d.entries.filter((e) => e.id !== editing.id), deleted: { ...d.deleted, ['e:' + editing.date]: stamp } }
            })
            close()
          }}
        >
          Supprimer cette journée
        </DangerButton>
      )}
    </Screen>
  )
}

/** Pastille de couleur d'une catégorie (toujours accompagnée de son nom). */
export function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
}
