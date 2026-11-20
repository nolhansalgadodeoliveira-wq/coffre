import { useState } from 'react'
import type { Update } from '../App'
import { nowIso } from '../App'
import { addMonths, formatDayYear, isValidIso, monthKeyOf, todayIso, WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '../lib/dates'
import { centsToInput, formatEuros, parseEuros } from '../lib/money'
import type { AppData } from '../lib/types'
import { emojiFor, saveGoal } from '../lib/goals'
import { BARBER, findProfession } from '../lib/professions'
import ProfessionPicker, { choiceFrom, type ProfessionChoice } from './ProfessionPicker'
import { changeWorkdays } from '../lib/calc'
import { IconCheck, IconChevronLeft } from '../icons'
import Shapes from '../Shapes'
import { Field, inputClass, MoneyInput, PrimaryButton } from '../ui'

const KEEP = [100, 60, 50, 40]

/** Présentation en 5 étapes (prénom, métier, jours, part gardée, objectif). `replay` : relancée depuis les réglages (valeurs actuelles pré-remplies). */
export default function Onboarding({ data, update, replay, done, refresh }: { data: AppData; update: Update; replay?: boolean; done: () => void; refresh?: { email: string; run: () => Promise<void>; status: string } }) {
  const [refreshing, setRefreshing] = useState(false)
  const s = data.settings
  const [step, setStep] = useState(0)
  const [name, setName] = useState(s.name)
  const [workdays, setWorkdays] = useState<number[]>(s.workdays)
  const [hours, setHours] = useState(String(s.hoursPerDay).replace('.', ','))
  const [keep, setKeep] = useState(String(s.keepPct).replace('.', ','))
  const [expenses, setExpenses] = useState(centsToInput(s.personalExpenses))
  // Première étape : le premier objectif (les autres s'ajoutent ensuite depuis l'accueil).
  const first = s.goals.find((g) => !g.done)
  const [goalName, setGoalName] = useState(first?.name ?? 'Mariage')
  const [goal, setGoal] = useState(first?.amount ? centsToInput(first.amount) : '')
  const defaultDate = first && first.date > todayIso() ? first.date : `${addMonths(monthKeyOf(todayIso()), 6)}-01`
  const [goalDate, setGoalDate] = useState(defaultDate)
  const [error, setError] = useState<string | null>(null)
  // Métier : celui déjà choisi (ou barbier pour les comptes d'avant cette option).
  const [choice, setChoice] = useState<ProfessionChoice | null>(() => {
    if (!s.profession && !replay) return null
    const t = findProfession(s.profession?.id) ?? BARBER
    return { ...choiceFrom(t, s.profession?.label), income: s.incomeCats ?? t.income, expenses: s.expenseCats ?? t.expenses }
  })
  function choose(c: ProfessionChoice) {
    // Nouveau métier : ses jours et sa part gardée habituels sont proposés (modifiables aux étapes suivantes).
    if (c.template.id !== choice?.template.id) {
      setWorkdays(c.template.workdays)
      setKeep(String(c.template.keepPct))
    }
    setChoice(c)
    setError(null)
  }

  const keepNum = Number(keep.replace(',', '.'))
  const hoursNum = Number(hours.replace(',', '.'))
  const STEPS = 5

  function next() {
    setError(null)
    if (step === 1 && !choice) return setError('Choisis ton métier dans la liste (ou « Autre métier »).')
    if (step === 2) {
      if (workdays.length === 0) return setError('Choisis au moins un jour. Tu pourras toujours ajouter un jour en plus.')
      if (!(hoursNum > 0 && hoursNum <= 24)) return setError('Indique un nombre d’heures entre 1 et 24.')
    }
    if (step === 3) {
      if (!(keepNum > 0 && keepNum <= 100)) return setError('La part gardée doit être entre 1 et 100 %.')
      if (parseEuros(expenses) === null) return setError('Indique tes dépenses perso par mois (0 si aucune).')
    }
    if (step === 4) {
      const g = goal.trim() === '' ? 0 : parseEuros(goal)
      if (g === null) return setError('Le montant de l’objectif n’est pas valide.')
      if (g > 0 && (!isValidIso(goalDate) || goalDate <= todayIso())) return setError('Choisis une date dans le futur.')
      const now = nowIso()
      update((d) => {
        const withGoal = g > 0 ? saveGoal(d, { name: goalName.trim() || 'Mon objectif', emoji: emojiFor(goalName), amount: g, date: goalDate }, now, first?.id) : d
        return {
        ...withGoal,
        days: changeWorkdays(withGoal, workdays, todayIso()),
        settings: {
          ...withGoal.settings,
          name: name.trim().slice(0, 40),
          workdays,
          hoursPerDay: hoursNum,
          keepPct: keepNum,
          ...(choice ? { profession: choice.profession, incomeCats: choice.income, expenseCats: choice.expenses } : {}),
          personalExpenses: parseEuros(expenses) ?? d.settings.personalExpenses,
          onboarded: true,
          updatedAt: now,
        },
      }
      })
      done()
      return
    }
    setStep(step + 1)
  }

  const toggleDay = (d: number) => setWorkdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
  const example = Number.isFinite(keepNum) && keepNum > 0 ? Math.round(keepNum) : 0

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]"
      style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
    >
      <div className="flex items-center gap-3">
        {step > 0 || replay ? (
          <button type="button" aria-label="Retour" onClick={() => (step > 0 ? (setStep(step - 1), setError(null)) : done())} className="flex h-12 w-12 items-center justify-center rounded-full bg-surface active:scale-95">
            <IconChevronLeft size={20} />
          </button>
        ) : (
          <span className="h-12 w-12" />
        )}
        <p className="sr-only">Étape {step + 1} sur {STEPS}</p>
        <div className="flex flex-1 justify-center gap-2" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-ink' : i < step ? 'w-2 bg-ink' : 'w-2 bg-line'}`} />
          ))}
        </div>
        <span className="h-12 w-12" />
      </div>

      {step === 0 && (
        <section className="flex flex-1 flex-col gap-5">
          {refresh && !replay && (
            <div className="flex flex-col gap-2 rounded-2xl bg-violet-soft p-4 text-[0.9375rem]">
              <span>
                <strong>Tu as déjà utilisé Coffre ?</strong> Tes données sont dans ton compte ({refresh.email}) seulement si elles ont été envoyées depuis l’autre appareil : ouvre l’app dessus, connecté à ce compte, puis reviens ici.
              </span>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true)
                  void refresh.run().finally(() => setRefreshing(false))
                }}
                className="h-11 self-start rounded-full bg-ink px-5 font-semibold text-white active:scale-95"
              >
                {refreshing ? 'Recherche…' : 'Retrouver mes données'}
              </button>
              {refresh.status === 'offline' && <span className="text-[0.8125rem]">Pas de connexion internet pour l’instant.</span>}
              {refresh.status === 'synced' && !refreshing && <span className="text-[0.8125rem]">Aucune donnée trouvée dans ce compte pour l’instant.</span>}
            </div>
          )}
          <div className="relative overflow-hidden rounded-[32px] bg-violet p-6">
            <Shapes variant="small" className="bob absolute -top-2 -right-3 h-28 w-28" />
            <h1 className="display relative max-w-[70%] text-[2.125rem]">Faisons connaissance</h1>
            <p className="relative max-w-[70%] pt-2 text-[1rem] text-ink/80">Cinq questions, et ton Coffre est prêt.</p>
          </div>
          <Field label="Ton prénom" htmlFor="name" hint="Pour te dire bonjour. Facultatif.">
            <input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} bg-surface`} maxLength={40} />
          </Field>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="display text-[2rem]">Quel est ton métier&nbsp;?</h1>
            <p className="text-[1rem] text-muted">L’app s’adapte : ce que tu encaisses, tes dépenses, tes jours de travail. Tout reste modifiable.</p>
          </div>
          <ProfessionPicker value={choice} onChange={choose} />
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-1 flex-col gap-5">
          <h1 className="display text-[2rem]">Quels jours travailles-tu d’habitude&nbsp;?</h1>
          <div className="grid grid-cols-4 gap-1.5 min-[380px]:grid-cols-7" role="group" aria-label="Jours travaillés">
            {WEEK_ORDER.map((d) => {
              const on = workdays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_LONG[d]}
                  onClick={() => toggleDay(d)}
                  className={`flex h-20 flex-col items-center justify-center gap-1 rounded-full border-[1.5px] text-[0.875rem] font-medium active:scale-95 ${on ? 'border-ink bg-ink text-white' : 'border-ink/25 bg-surface text-ink'}`}
                >
                  {WEEKDAY_SHORT[d].replace('.', '')}
                  <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
          <p className="rounded-2xl bg-blue-soft p-4 text-[0.9375rem]">Un jour en plus de temps en temps ? Pas besoin de le prévoir : tu pourras saisir n’importe quel jour.</p>
          <Field label="Heures travaillées par jour" htmlFor="hours" hint="Sert à calculer ce que tu gagnes par heure.">
            <input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className={`${inputClass} num bg-surface`} />
          </Field>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-1 flex-col gap-5">
          <h1 className="display text-[2rem]">Sur ce que tu encaisses, combien gardes-tu&nbsp;?</h1>
          <div className="grid grid-cols-4 gap-2">
            {KEEP.map((k) => (
              <button key={k} type="button" aria-pressed={keepNum === k} onClick={() => setKeep(String(k))} className={`h-14 rounded-full text-[1.0625rem] font-semibold active:scale-95 ${keepNum === k ? 'bg-ink text-white' : 'bg-surface'}`}>
                {k} %
              </button>
            ))}
          </div>
          <Field label="Ou une autre part (%)" htmlFor="keep">
            <input id="keep" inputMode="decimal" value={keep} onChange={(e) => setKeep(e.target.value)} className={`${inputClass} num bg-surface`} />
          </Field>
          <p className="rounded-2xl bg-orange-soft p-4 text-[0.9375rem]">
            {example === 100 ? (
              <>Tu gardes tout ce que tu encaisses : c’est le cas de la plupart des indépendants. Tes dépenses seront retirées à part.</>
            ) : (
              <>
                Sur 100 € encaissés, tu gardes <strong>{example} €</strong>. Tu saisiras toujours le total encaissé : l’app calcule ta part.
              </>
            )}
          </p>
          <Field label="Tes dépenses perso par mois" htmlFor="expenses" hint="Ce que tu dépenses pour toi. Le reste va à l’épargne.">
            <MoneyInput id="expenses" value={expenses} onChange={setExpenses} className="bg-surface" />
          </Field>
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-1 flex-col gap-5">
          <h1 className="display text-[2rem]">Pour quoi mets-tu de côté&nbsp;?</h1>
          <div className="flex items-end gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-[1.75rem]" role="img" aria-label={`Symbole choisi : ${emojiFor(goalName)}`}>
              {emojiFor(goalName)}
            </span>
            <div className="min-w-0 flex-1">
              <Field label="Nom de l’objectif" htmlFor="goalName">
                <input id="goalName" value={goalName} onChange={(e) => setGoalName(e.target.value)} className={`${inputClass} bg-surface`} maxLength={40} placeholder="Ex. Mariage, Moto, Ski…" />
              </Field>
            </div>
          </div>
          <Field label="Montant à mettre de côté" htmlFor="goal" hint="Tu pourras le changer quand tu veux.">
            <MoneyInput id="goal" value={goal} onChange={setGoal} placeholder="Ex. 6 000" className="bg-surface" />
          </Field>
          <Field label="Pour quand ?" htmlFor="goalDate" hint={isValidIso(goalDate) ? `Objectif : ${formatDayYear(goalDate)}` : undefined}>
            <input id="goalDate" type="date" value={goalDate} min={todayIso()} onChange={(e) => setGoalDate(e.target.value)} className={`${inputClass} bg-surface`} />
          </Field>
          {parseEuros(goal) ? <p className="text-[0.9375rem] text-muted">Objectif : {formatEuros(parseEuros(goal)!)} pour « {goalName || 'mon objectif'} ».</p> : null}
          <p className="rounded-2xl bg-surface p-3 text-[0.875rem] text-muted">Tu as plusieurs projets (ski, voyage…) ? Tu pourras ajouter d’autres objectifs depuis l’accueil.</p>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-bad-soft p-4 text-[0.9375rem] text-bad">
          {error}
        </p>
      )}

      <PrimaryButton onClick={next} icon={step === 4 ? <IconCheck size={20} /> : undefined}>
        {step === 0 ? (name.trim() ? 'Continuer' : 'Passer') : step === 4 ? 'C’est parti' : 'Continuer'}
      </PrimaryButton>
    </main>
  )
}
