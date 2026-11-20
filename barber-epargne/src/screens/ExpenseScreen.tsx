import { useState } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { expenseCategories } from '../lib/calc'
import { formatDayLong, isValidIso } from '../lib/dates'
import { centsToInput, parseEuros } from '../lib/money'
import { newId } from '../lib/storage'
import type { Expense } from '../lib/types'
import { IconCheck } from '../icons'
import { Card, DangerButton, Field, inputClass, MoneyInput, Notice, PrimaryButton, Screen } from '../ui'

/** Ajouter ou modifier une dépense professionnelle (matériel, carburant, cotisations…). */
export default function ExpenseScreen({ data, update, today, close, expenseId }: ScreenProps & { expenseId?: string }) {
  const editing = data.expenses.find((x) => x.id === expenseId)
  const cats = expenseCategories(data.settings)
  const [date, setDate] = useState(editing?.date ?? today)
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount) : '')
  const [cat, setCat] = useState(editing?.cat ?? cats[0]?.id ?? 'autre')
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  function save(again = false) {
    const cents = parseEuros(amount)
    if (!cents || cents <= 0) return setError('Indique le montant de la dépense.')
    if (!isValidIso(date)) return setError('Choisis une date valide.')
    const stamp = nowIso()
    const expense: Expense = { id: editing?.id ?? newId(), date, cat, amount: cents, ...(note.trim() ? { note: note.trim().slice(0, 80) } : {}), updatedAt: stamp }
    update((d) => {
      const deleted = { ...d.deleted }
      delete deleted['x:' + expense.id]
      return { ...d, deleted, expenses: [...d.expenses.filter((x) => x.id !== expense.id), expense].sort((a, b) => a.date.localeCompare(b.date)) }
    })
    if (again) {
      setAmount('')
      setNote('')
      setError(null)
      return
    }
    close()
  }

  return (
    <Screen title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'} back={close}>
      <Card tone="orange" className="flex flex-col gap-3">
        <label htmlFor="xamount" className="text-[1rem] font-semibold">
          Montant
        </label>
        <MoneyInput id="xamount" value={amount} onChange={(v) => (setAmount(v), setError(null))} large onTone />
      </Card>

      <Card className="flex flex-col gap-3">
        <span className="text-[1rem] font-semibold">Catégorie</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Catégorie de la dépense">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`flex h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium active:scale-95 ${cat === c.id ? 'bg-ink text-white' : 'bg-field'}`}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Field label="Date" htmlFor="xdate" hint={isValidIso(date) ? formatDayLong(date) : undefined}>
          <input id="xdate" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Note (facultatif)" htmlFor="xnote">
          <input id="xnote" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Ex. Tuyaux cuivre, plein d’essence…" />
        </Field>
      </Card>

      {error && <Notice bad>{error}</Notice>}
      <PrimaryButton onClick={() => save()} icon={<IconCheck size={20} />}>
        Enregistrer
      </PrimaryButton>
      {!editing && (
        <button type="button" onClick={() => save(true)} className="h-12 rounded-full bg-surface text-[1rem] font-semibold active:scale-95">
          Enregistrer et en ajouter une autre
        </button>
      )}
      {editing && (
        <DangerButton
          confirmText="Confirmer la suppression"
          onConfirm={() => {
            update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== editing.id), deleted: { ...d.deleted, ['x:' + editing.id]: nowIso() } }))
            close()
          }}
        >
          Supprimer cette dépense
        </DangerButton>
      )}
    </Screen>
  )
}
