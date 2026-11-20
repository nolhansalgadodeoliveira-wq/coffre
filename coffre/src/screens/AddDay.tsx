import { useState, type FormEvent } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { defaultStatus, isBilled, monthSummary, myShare, pendingDays, suggestedDay, validateEntry, type EntryError } from '../lib/calc'
import { addDays, formatDayLong, isValidIso, monthKeyOf, weekday, WEEKDAY_SHORT } from '../lib/dates'
import { centsToInput, formatEuros, parseEuros } from '../lib/money'
import { newId } from '../lib/storage'
import type { AppData, Entry } from '../lib/types'
import { MAX_CLIENTS, MAX_DAY_GROSS } from '../lib/types'
import { IconCheck, IconChevronLeft, IconChevronRight } from '../icons'
import { Card, Chip, DangerButton, Field, inputClass, MoneyInput, PrimaryButton, Screen, SecondaryButton } from '../ui'

const ERRORS: Record<EntryError, string> = {
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
  const keepPct = data.settings.keepPct
  const [date, setDate] = useState(editing?.date ?? dateProp ?? suggestedDay(data, monthProp, today))
  const [amount, setAmount] = useState(editing ? centsToInput(editing.gross) : '')
  const [tips, setTips] = useState(editing?.tips ? centsToInput(editing.tips) : '')
  const [clients, setClients] = useState(editing?.clients != null ? String(editing.clients) : '')
  const [error, setError] = useState<EntryError | null>(null)

  const cents = parseEuros(amount)
  const tipsCents = tips.trim() === '' ? 0 : parseEuros(tips)
  const baseShare = (c: number) => (editing && c === editing.gross ? editing.amount - (editing.tips ?? 0) : myShare(c, keepPct))
  const share = cents === null || tipsCents === null ? null : baseShare(cents) + tipsCents
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
    const err = validateEntry({ date, text: amount, cents, clients: n, id: editing?.id }, data.entries, today)
    setError(err)
    if (err || cents === null) return
    if (tipsCents === null) return setError('montant-invalide')

    const stamp = nowIso()
    const entry: Entry = {
      id: editing?.id ?? newId(),
      date,
      gross: cents,
      // Ta part est figée à la saisie : changer la part gardée plus tard ne réécrit pas le passé.
      amount: (editing && editing.gross === cents ? editing.amount - (editing.tips ?? 0) : myShare(cents, keepPct)) + tipsCents,
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
      setTips('')
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
          <label htmlFor="amount" className="text-[1rem] font-semibold">
            Total encaissé
          </label>
          <MoneyInput id="amount" value={amount} onChange={(v) => (setAmount(v), setError(null))} large onTone />
          {(error === 'montant-vide' || error === 'montant-invalide' || error === 'montant-trop-grand') && (
            <p role="alert" className="text-[0.875rem] font-medium text-bad">
              {ERRORS[error]}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <label htmlFor="tips" className="text-[1rem] font-semibold">
            Pourboires (facultatif)
          </label>
          <MoneyInput id="tips" value={tips} onChange={(v) => setTips(v)} />
          <p className="text-[0.8125rem] text-muted">Les pourboires te reviennent en entier : ils ne sont pas partagés.</p>
        </Card>

        <div className="flex items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-6 text-white">
          <span className="flex flex-col">
            <span className="text-[0.9375rem] font-medium">Ta part</span>
            <span className="text-[0.75rem] text-white/75">Tu gardes {String(keepPct).replace('.', ',')} % + pourboires</span>
          </span>
          <span className="num display rounded-full bg-white px-5 py-3 text-[1.375rem] text-ink">{share === null ? '–' : formatEuros(share)}</span>
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
