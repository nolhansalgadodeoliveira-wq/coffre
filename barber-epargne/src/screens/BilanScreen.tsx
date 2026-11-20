import { useState, type FormEvent } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { bilanFigures, entriesOfMonth, gap, sum } from '../lib/calc'
import { deMonth, formatDayLong, formatMonthKey, monthName } from '../lib/dates'
import { centsToInput, formatEuros, formatSigned, parseEuros } from '../lib/money'
import { newId } from '../lib/storage'
import type { Bilan } from '../lib/types'
import { IconCheck } from '../icons'
import Shapes from '../Shapes'
import { Card, Chip, DangerButton, Field, MoneyInput, PrimaryButton, Row, Screen, SecondaryButton, Segmented } from '../ui'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function BilanScreen({ data, update, today, close, bilanId, month: monthProp }: ScreenProps & { bilanId?: string; month?: string }) {
  const editing = data.bilans.find((b) => b.id === bilanId)
  const month = editing?.month ?? monthProp ?? today.slice(0, 7)
  const entries = entriesOfMonth(data, month)
  const currentTotal = sum(entries)
  const personalExpenses = editing?.personalExpenses ?? data.settings.personalExpenses
  const commission = editing?.commission ?? data.settings.commission

  // Un bilan validé garde ses chiffres. Il ne se recalcule que si l'utilisateur le demande.
  const [refresh, setRefresh] = useState(false)
  const frozenTotal = editing?.total
  const useCurrent = !editing || frozenTotal === undefined || refresh
  const f = bilanFigures(useCurrent ? currentTotal : frozenTotal, personalExpenses, commission)
  const expected = useCurrent ? f.expected : (editing?.expected ?? f.expected)
  const changed = editing && frozenTotal !== undefined && frozenTotal !== currentTotal && !refresh

  const [kept, setKept] = useState<'oui' | 'non' | null>(editing ? (editing.expensesKept ? 'oui' : 'non') : null)
  const [actual, setActual] = useState(editing ? centsToInput(editing.actual) : '')
  const [error, setError] = useState<string | null>(null)

  const actualCents = parseEuros(actual)
  const diff = actualCents === null ? null : gap(actualCents, expected)
  const expensesLabel = formatEuros(personalExpenses)

  if (!editing && entries.length === 0) {
    return (
      <Screen title="Bilan" back={close}>
        <Card className="text-[1rem]">Aucune journée saisie en {monthName(month)}. Le bilan s'ouvre une fois le mois renseigné.</Card>
      </Screen>
    )
  }
  if (!editing && data.bilans.some((b) => b.month === month)) {
    return (
      <Screen title="Bilan" back={close}>
        <Card className="text-[1rem]">Le bilan {deMonth(month)} est déjà fait. Tu peux le modifier depuis l'historique.</Card>
      </Screen>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (kept === null) return setError('Réponds à la question sur tes dépenses perso.')
    if (actualCents === null) return setError('Indique combien tu as mis de côté. Mets 0 si rien.')
    const stamp = nowIso()
    const bilan: Bilan = {
      id: editing?.id ?? newId(),
      month,
      expensesKept: kept === 'oui',
      actual: actualCents,
      personalExpenses,
      commission,
      total: f.total,
      expected,
      createdAt: editing?.createdAt ?? today,
      updatedAt: stamp,
    }
    update((d) => {
      const deleted = { ...d.deleted }
      delete deleted['b:' + month]
      return { ...d, deleted, bilans: [...d.bilans.filter((b) => b.month !== month), bilan] }
    })
    close()
  }

  return (
    <Screen title={`Bilan ${deMonth(month)}`} back={close}>
      <Card tone="dark" className="relative overflow-hidden p-6">
        <Shapes variant="stack" className="pointer-events-none absolute -right-4 -bottom-3 h-32 w-32 opacity-95 min-[380px]:h-36 min-[380px]:w-36" />
        <div className="relative flex flex-col gap-3">
          <Chip dark className="self-start">
            {cap(formatMonthKey(month))}
          </Chip>
          <span className="text-[0.9375rem] text-white/75">À épargner</span>
          <span className="num display text-[2.5rem] min-[380px]:text-[2.875rem]">{formatEuros(expected)}</span>
          <span className="max-w-[62%] text-[0.875rem] text-white/75">
            Ta part {formatEuros(f.total)} − dépenses {expensesLabel}
            {f.commission > 0 && ` − salon ${formatEuros(f.commission)}`}
          </span>
        </div>
      </Card>

      {changed && (
        <Card tone="blue" className="flex flex-col gap-3">
          <p className="text-[0.9375rem]">
            Des journées ont changé depuis ce bilan : ta part du mois est maintenant de <strong>{formatEuros(currentTotal)}</strong> (au lieu de {formatEuros(frozenTotal!)}).
          </p>
          <SecondaryButton onClick={() => setRefresh(true)}>Mettre à jour le bilan</SecondaryButton>
        </Card>
      )}

      <Card className="py-2">
        <div className="flex flex-col divide-y divide-line">
          {entries.map((e) => (
            <Row key={e.date} label={formatDayLong(e.date)} value={formatEuros(e.amount)} />
          ))}
          <Row label={`Ta part en ${monthName(month)}`} value={formatEuros(currentTotal)} strong />
        </div>
      </Card>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Card tone="orange" className="flex flex-col gap-3">
          <span className="text-[1.0625rem] font-semibold">As-tu bien gardé {expensesLabel} pour tes dépenses perso&nbsp;?</span>
          <Segmented
            label="Dépenses perso gardées"
            value={kept}
            className="bg-white/65"
            onChange={(v) => (setKept(v), setError(null))}
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
          />
          {kept === 'non' && <p className="text-[0.875rem] text-ink/85">Pas grave. Si tu as dépensé plus que prévu, ça se verra dans l'écart.</p>}
        </Card>

        <Card className="flex flex-col gap-4">
          <Field label={'Combien as-tu réellement mis de côté ?'} htmlFor="actual" error={error}>
            <MoneyInput id="actual" value={actual} onChange={(v) => (setActual(v), setError(null))} large placeholder={centsToInput(expected)} />
          </Field>
          {diff !== null && (
            <div className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${diff > 0 ? 'bg-good-soft' : diff < 0 ? 'bg-bad-soft' : 'bg-violet-soft'}`}>
              <span className="text-[0.9375rem]">
                {diff > 0 && 'Tu es en avance sur ton plan.'}
                {diff === 0 && 'Pile dans le plan.'}
                {diff < 0 && `Il te manque ${formatEuros(-diff)}.`}
              </span>
              <span className={`num display shrink-0 text-[1.625rem] ${diff > 0 ? 'text-good' : diff < 0 ? 'text-bad' : ''}`}>{formatSigned(diff)}</span>
            </div>
          )}
        </Card>

        <PrimaryButton type="submit" icon={<IconCheck size={20} />}>
          {refresh ? 'Enregistrer le bilan mis à jour' : 'Enregistrer le bilan'}
        </PrimaryButton>
      </form>

      {editing && (
        <DangerButton
          confirmText="Confirmer la suppression"
          onConfirm={() => {
            update((d) => ({ ...d, bilans: d.bilans.filter((b) => b.id !== editing.id), deleted: { ...d.deleted, ['b:' + editing.month]: nowIso() } }))
            close()
          }}
        >
          Supprimer ce bilan
        </DangerButton>
      )}
    </Screen>
  )
}
