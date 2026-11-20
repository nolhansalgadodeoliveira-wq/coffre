import { useState } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { formatDayYear, todayIso, WEEK_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT } from '../lib/dates'
import { centsToInput, formatEurosShort, parseEuros } from '../lib/money'
import { download, toCsv } from '../lib/storage'
import { changeWorkdays } from '../lib/calc'
import type { Settings } from '../lib/types'
import { EMPTY_DATA } from '../lib/types'
import { IconCheck } from '../icons'
import AccountSection from './AccountSection'
import { Card, DangerButton, Field, inputClass, MoneyInput, Notice, PrimaryButton, Screen, SecondaryButton, Segmented, Toggle } from '../ui'

export default function SettingsScreen({ data, update, account, open }: ScreenProps) {
  const s = data.settings
  const [name, setName] = useState(s.name)
  const [workdays, setWorkdays] = useState<number[]>(s.workdays)
  const [hours, setHours] = useState(String(s.hoursPerDay).replace('.', ','))
  const [keep, setKeep] = useState(String(s.keepPct).replace('.', ','))
  const [expenses, setExpenses] = useState(centsToInput(s.personalExpenses))
  const [comEnabled, setComEnabled] = useState(s.commission.enabled)
  const [comMode, setComMode] = useState(s.commission.mode)
  const [comValue, setComValue] = useState(s.commission.value ? (s.commission.mode === 'fixed' ? centsToInput(s.commission.value) : String(s.commission.value).replace('.', ',')) : '')
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  const num = (v: string) => Number(v.replace(',', '.'))

  function save() {
    const e = parseEuros(expenses)
    const k = num(keep)
    const h = num(hours)
    const cv = comValue.trim() === '' ? 0 : comMode === 'fixed' ? parseEuros(comValue) : num(comValue)
    if (workdays.length === 0) return setMessage({ text: 'Choisis au moins un jour de travail habituel.', bad: true })
    if (!(h > 0 && h <= 24)) return setMessage({ text: 'Les heures par jour doivent être entre 1 et 24.', bad: true })
    if (!(k > 0 && k <= 100)) return setMessage({ text: 'La part gardée doit être entre 1 et 100 %.', bad: true })
    if (e === null) return setMessage({ text: 'Indique tes dépenses perso (0 si aucune).', bad: true })
    if (cv === null || Number.isNaN(cv) || cv < 0 || (comMode === 'percent' && cv > 100)) return setMessage({ text: 'La commission doit être un pourcentage entre 0 et 100, ou un montant.', bad: true })

    const settings: Settings = {
      ...s,
      name: name.trim().slice(0, 40),
      workdays,
      hoursPerDay: h,
      keepPct: k,
      personalExpenses: e,
      commission: { enabled: comEnabled, mode: comMode, value: cv },
      updatedAt: nowIso(),
    }
    update((d) => ({ ...d, days: changeWorkdays(d, settings.workdays, todayIso()), settings }))
    setMessage({ text: 'Réglages enregistrés.' })
  }

  const toggleDay = (d: number) => setWorkdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))

  return (
    <Screen title="Réglages">
      <AccountSection account={account} data={data} update={update} today={todayIso()} />

      <Card className="flex flex-col gap-5">
        <span className="text-[1.1875rem] font-semibold">Profil</span>
        <Field label="Ton prénom" htmlFor="name">
          <input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={40} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-5">
        <span className="text-[1.1875rem] font-semibold">Mon travail</span>
        <div className="flex flex-col gap-2">
          <span className="text-[0.9375rem] font-medium">Jours travaillés d’habitude</span>
          <div className="grid grid-cols-4 gap-1.5 min-[380px]:grid-cols-7" role="group" aria-label="Jours travaillés d’habitude">
            {WEEK_ORDER.map((d) => {
              const on = workdays.includes(d)
              return (
                <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAY_LONG[d]} onClick={() => toggleDay(d)} className={`h-12 rounded-full text-[0.875rem] font-medium active:scale-95 ${on ? 'bg-ink text-white' : 'bg-field text-ink'}`}>
                  {WEEKDAY_SHORT[d].replace('.', '')}
                </button>
              )
            })}
          </div>
          <span className="text-[0.875rem] text-muted">Un jour en plus de temps en temps ? Saisis-le simplement, ou marque-le dans le calendrier.</span>
        </div>
        <Field label="Heures par jour" htmlFor="hours">
          <input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className={`${inputClass} num`} />
        </Field>
        <Field label="Part que tu gardes sur ce que tu encaisses (%)" htmlFor="keep" hint="S’applique aux prochaines journées saisies. Les anciennes ne changent pas.">
          <input id="keep" inputMode="decimal" value={keep} onChange={(e) => setKeep(e.target.value)} className={`${inputClass} num`} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <span className="text-[1.1875rem] font-semibold">Mes objectifs</span>
        {s.goals.filter((g) => !g.done).length === 0 ? (
          <p className="text-[0.9375rem] text-muted">Aucun objectif pour l’instant.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[0.9375rem]">
            {s.goals
              .filter((g) => !g.done)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((g) => (
                <li key={g.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {g.emoji} {g.name}
                  </span>
                  <span className="num shrink-0 text-muted">
                    {formatEurosShort(g.amount)} · {formatDayYear(g.date)}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <SecondaryButton onClick={() => open({ kind: 'objectifs' })}>Gérer mes objectifs</SecondaryButton>
      </Card>

      <Card className="flex flex-col gap-5">
        <span className="text-[1.1875rem] font-semibold">Mon budget</span>
        <Field label="Dépenses perso par mois" htmlFor="expenses" hint="Retirées de ta part chaque mois : le reste, c’est ton épargne.">
          <MoneyInput id="expenses" value={expenses} onChange={setExpenses} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 flex-col">
            <span className="text-[1.0625rem] font-semibold">Frais du salon</span>
            <span className="text-[0.875rem] text-muted">Loyer du fauteuil ou commission, retirés chaque mois.</span>
          </span>
          <Toggle id="comEnabled" checked={comEnabled} onChange={setComEnabled} label="Retirer des frais du salon" />
        </div>
        {comEnabled && (
          <>
            <Segmented
              label="Type de frais"
              value={comMode}
              className="bg-field"
              onChange={(v) => (setComMode(v), setComValue(''))}
              options={[
                { value: 'fixed', label: 'Fixe par mois' },
                { value: 'percent', label: 'Pourcentage' },
              ]}
            />
            <Field label={comMode === 'percent' ? 'Pourcentage de ta part' : 'Montant par mois'} htmlFor="comValue">
              {comMode === 'percent' ? (
                <div className="relative">
                  <input id="comValue" inputMode="decimal" value={comValue} onChange={(e) => setComValue(e.target.value)} className={`${inputClass} num pr-10`} />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">%</span>
                </div>
              ) : (
                <MoneyInput id="comValue" value={comValue} onChange={setComValue} />
              )}
            </Field>
          </>
        )}
      </Card>

      {message && <Notice bad={message.bad}>{message.text}</Notice>}

      <PrimaryButton onClick={save} icon={<IconCheck size={20} />}>
        Enregistrer les réglages
      </PrimaryButton>

      <Card tone="blue" className="flex flex-col gap-3">
        <span className="text-[1.1875rem] font-semibold">Tableur</span>
        <p className="text-[0.875rem] text-ink/85">Tes journées dans un fichier à ouvrir avec Excel ou Numbers.</p>
        <SecondaryButton onClick={() => download(`coffre-${todayIso()}.csv`, toCsv(data), 'text/csv;charset=utf-8')}>Exporter pour un tableur (CSV)</SecondaryButton>
      </Card>

      <SecondaryButton onClick={() => open({ kind: 'presentation' })}>Revoir la présentation</SecondaryButton>

      <DangerButton
        confirmText="Tout effacer définitivement"
        onConfirm={() => {
          update(() => ({ ...EMPTY_DATA, settings: { ...data.settings, updatedAt: nowIso() } }))
          setMessage({ text: 'Toutes les journées et tous les bilans ont été effacés.' })
        }}
      >
        Effacer toutes les données
      </DangerButton>
    </Screen>
  )
}
