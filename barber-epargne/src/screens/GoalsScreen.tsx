import { useState } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { goalsPlan, type GoalPlan } from '../lib/calc'
import { addMonths, formatDayYear, formatMonthKey, isValidIso, monthKeyOf } from '../lib/dates'
import { completeGoal, emojiFor, emojiSearch, removeGoal, reopenGoal, saveGoal, validateGoal } from '../lib/goals'
import { centsToInput, formatEurosShort, parseEuros } from '../lib/money'
import { MAX_GOALS } from '../lib/types'
import { IconCheck, IconPlus } from '../icons'
import { Card, Chip, DangerButton, Field, inputClass, MoneyInput, Notice, PrimaryButton, ProgressBar, Screen, SecondaryButton } from '../ui'

/** Liste des objectifs : progression, montant par mois, objectif réalisé. */
export function GoalsScreen({ data, update, today, open, close }: ScreenProps) {
  const plan = goalsPlan(data, today)
  const done = data.settings.goals.filter((g) => g.done)
  const count = data.settings.goals.length

  return (
    <Screen title="Mes objectifs" back={close}>
      <Card tone="violet" className="flex flex-col gap-2">
        <span className="text-[0.9375rem] text-ink/80">Épargne disponible</span>
        <span className="num display text-[2.25rem]">{formatEurosShort(plan.available)}</span>
        <p className="text-[0.875rem] text-ink/85">
          Elle est répartie <strong>par date</strong> : l’objectif le plus proche est rempli en premier, le reste va au suivant.
          {plan.goals.length > 0 && plan.perMonth > 0 && (
            <>
              {' '}
              Pour tout tenir : <strong>{formatEurosShort(plan.perMonth)} par mois</strong>.
            </>
          )}
        </p>
      </Card>

      {plan.goals.map((g) => (
        <GoalCard key={g.goal.id} plan={g} onEdit={() => open({ kind: 'objectif', goalId: g.goal.id, fromList: true })} onDone={() => update((d) => completeGoal(d, g.goal.id, g.saved, nowIso()))} />
      ))}

      {plan.goals.length === 0 && <p className="text-[1rem] text-muted">Aucun objectif en cours. Ajoute ce pour quoi tu mets de côté : mariage, ski, voyage…</p>}

      {count < MAX_GOALS && (
        <PrimaryButton onClick={() => open({ kind: 'objectif', fromList: true })} icon={<IconPlus size={20} />}>
          Ajouter un objectif
        </PrimaryButton>
      )}

      {plan.free > 0 && plan.goals.length > 0 && <Notice>Tous tes objectifs sont remplis : {formatEurosShort(plan.free)} de plus sont de côté. Ajoute un nouvel objectif !</Notice>}

      {done.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="display pt-2 text-[1.375rem]">Réalisés</h2>
          {done.map((g) => (
            <Card key={g.id} className="flex items-center gap-3">
              <span className="text-[1.5rem]" aria-hidden="true">
                {g.emoji}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{g.name}</span>
                <span className="text-[0.8125rem] text-muted">{formatEurosShort(g.done!.spent)} utilisés</span>
              </span>
              <button type="button" onClick={() => update((d) => reopenGoal(d, g.id, nowIso()))} className="h-11 rounded-full px-3 text-[0.875rem] text-muted">
                Annuler
              </button>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}

function GoalCard({ plan: g, onEdit, onDone }: { plan: GoalPlan; onEdit: () => void; onDone: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-soft text-[1.5rem]" aria-hidden="true">
          {g.goal.emoji}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[1.125rem] font-semibold">{g.goal.name}</span>
          <span className="text-[0.8125rem] text-muted">
            {formatDayYear(g.goal.date)}
            {!g.passed && ` · J-${g.daysLeft}`}
          </span>
        </span>
        <Chip>{Math.round(g.progress * 100)} %</Chip>
      </div>
      <div className="flex justify-between text-[0.9375rem]">
        <span className="num">
          <strong>{formatEurosShort(g.saved)}</strong> <span className="text-muted">/ {formatEurosShort(g.goal.amount)}</span>
        </span>
        {!g.reached && <span className="num text-muted">reste {formatEurosShort(g.remaining)}</span>}
      </div>
      <ProgressBar value={g.progress} label={`${g.goal.name} : ${Math.round(g.progress * 100)} %`} className="h-3 bg-line" fill={g.reached ? 'bg-good' : 'bg-violet-deep'} />
      <p className="rounded-2xl bg-field p-3 text-[0.9375rem]">
        {g.reached
          ? 'Tout est de côté. Bravo !'
          : g.passed
            ? `La date est passée. Il manquait ${formatEurosShort(g.remaining)}.`
            : `Mets ${formatEurosShort(g.perMonth)} de côté par mois pour cet objectif. ${g.onTrack ? 'À ce rythme, tu y arrives.' : `À ce rythme : environ ${Math.round(g.projectedPct * 100)} % à la date.`}`}
      </p>
      <div className="flex flex-col gap-2">
        <SecondaryButton onClick={onEdit}>Modifier</SecondaryButton>
        {(g.reached || g.passed) && (
          <DangerButton confirmText={`Confirmer : ${formatEurosShort(g.saved)} utilisés pour ${g.goal.name}`} onConfirm={onDone}>
            C’est fait, j’ai utilisé cet argent
          </DangerButton>
        )}
      </div>
    </Card>
  )
}

/** Ajouter ou modifier un objectif. */
export function GoalEditScreen({ data, update, today, open, close: closeAll, goalId, fromList }: ScreenProps & { goalId?: string; fromList?: boolean }) {
  // Ouvert depuis la liste des objectifs : on y revient.
  const close = () => (fromList ? open({ kind: 'objectifs' }) : closeAll())
  const editing = data.settings.goals.find((g) => g.id === goalId)
  const [name, setName] = useState(editing?.name ?? '')
  // Symbole automatique d'après le nom (un objectif existant garde le sien tant qu'on ne change pas son nom).
  // Emoji touché parmi les suggestions (remis à l'automatique dès qu'on change le nom).
  const [picked, setPicked] = useState<string | null>(editing?.emoji ?? null)
  const emoji = picked ?? emojiFor(name)
  const suggestions = emojiSearch(name, 8)
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amount) : '')
  const [date, setDate] = useState(editing?.date ?? '')
  const [error, setError] = useState<string | null>(null)
  // Simulateur : « et si je mettais X € par mois ? »
  const [whatIf, setWhatIf] = useState('')

  const cents = parseEuros(amount)
  // Aperçu : ce qu'il faudrait mettre de côté par mois avec cet objectif.
  const preview =
    cents && isValidIso(date) && date > today && name.trim()
      ? goalsPlan(saveGoal(data, { name, emoji, amount: cents, date }, nowIso(), editing?.id), today).goals.find((g) => (editing ? g.goal.id === editing.id : g.goal.name === name.trim().slice(0, 40) && g.goal.date === date))
      : undefined

  function save() {
    const input = { name, emoji, amount: cents ?? 0, date }
    const err = validateGoal(input, today, !editing)
    if (err) return setError(err)
    update((d) => saveGoal(d, input, nowIso(), editing?.id))
    close()
  }

  return (
    <Screen title={editing ? 'Modifier l’objectif' : 'Nouvel objectif'} back={close}>
      <Card className="flex flex-col gap-5">
        <div className="flex items-end gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-soft text-[1.75rem]" aria-label={`Symbole choisi : ${emoji}`} role="img">
            {emoji}
          </span>
          <div className="min-w-0 flex-1">
            <Field label="Nom de l’objectif" htmlFor="gname">
              <input id="gname" value={name} maxLength={40} autoFocus={!editing} onChange={(e) => (setName(e.target.value), setPicked(null), setError(null))} className={inputClass} placeholder="Ex. Moto, Ski, Voyage à Bali…" />
            </Field>
          </div>
        </div>
        {suggestions.length > 1 ? (
          <div className="-mt-1 flex flex-col gap-2">
            <span className="text-[0.8125rem] text-muted">Symbole choisi d’après le nom. Touche-en un autre si tu préfères :</span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((e) => (
                <button key={e} type="button" aria-pressed={e === emoji} aria-label={`Choisir ${e}`} onClick={() => setPicked(e)} className={`h-11 w-11 rounded-full text-[1.25rem] active:scale-95 ${e === emoji ? 'bg-violet-soft ring-2 ring-ink' : 'bg-field'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="-mt-2 text-[0.8125rem] text-muted">Le symbole se choisit tout seul d’après le nom.</p>
        )}
        <Field label="Montant à mettre de côté" htmlFor="gamount">
          <MoneyInput id="gamount" value={amount} onChange={(v) => (setAmount(v), setError(null))} placeholder="Ex. 800" />
        </Field>
        <Field label="Pour quand ?" htmlFor="gdate" hint={isValidIso(date) ? (date <= today ? 'Cette date est déjà passée.' : formatDayYear(date)) : undefined}>
          <input id="gdate" type="date" value={date} min={editing ? undefined : today} onChange={(e) => (setDate(e.target.value), setError(null))} className={inputClass} />
        </Field>
      </Card>

      {preview && preview.reached && <Notice>Ton épargne actuelle couvre déjà tout cet objectif.</Notice>}
      {preview && !preview.reached && (
        <Notice>
          Il faudra mettre <strong>{formatEurosShort(preview.perMonth)} de côté par mois</strong> pour « {preview.goal.name} ».
          {preview.saved > 0 && ` ${formatEurosShort(preview.saved)} sont déjà de côté pour lui.`}
        </Notice>
      )}
      {preview && !preview.reached && (
        <Card tone="blue" className="flex flex-col gap-3">
          <span className="text-[1.0625rem] font-semibold">Et si…</span>
          <Field label="Je mets de côté chaque mois" htmlFor="whatif">
            <MoneyInput id="whatif" value={whatIf} onChange={setWhatIf} placeholder={centsToInput(preview.perMonth)} />
          </Field>
          {(() => {
            const m = parseEuros(whatIf)
            if (!m || m <= 0) return <p className="text-[0.875rem] text-ink/80">Tape un montant pour voir quand tu atteindrais cet objectif.</p>
            const months = Math.ceil(preview.remaining / m)
            const reach = addMonths(monthKeyOf(today), months)
            const inTime = reach <= monthKeyOf(date)
            return (
              <p className="text-[0.9375rem]">
                Tu l’atteindrais en <strong>{formatMonthKey(reach)}</strong> ({months} mois) : {inTime ? 'avant ta date, c’est bon ✓' : `après ta date du ${formatDayYear(date)}.`}
              </p>
            )
          })()}
        </Card>
      )}
      {error && <Notice bad>{error}</Notice>}

      <PrimaryButton onClick={save} icon={<IconCheck size={20} />}>
        Enregistrer
      </PrimaryButton>
      {editing && (
        <DangerButton
          confirmText="Confirmer la suppression"
          onConfirm={() => {
            update((d) => removeGoal(d, editing.id, nowIso()))
            close()
          }}
        >
          Supprimer cet objectif
        </DangerButton>
      )}
    </Screen>
  )
}
