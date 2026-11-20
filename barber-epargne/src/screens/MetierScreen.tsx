import { useState } from 'react'
import type { ScreenProps } from '../App'
import { nowIso } from '../App'
import { changeWorkdays } from '../lib/calc'
import { BARBER, findProfession } from '../lib/professions'
import { IconCheck } from '../icons'
import { Card, Notice, PrimaryButton, Screen, Toggle } from '../ui'
import ProfessionPicker, { choiceFrom, type ProfessionChoice } from './ProfessionPicker'

/** Réglages : changer de métier, ou ajuster ses catégories de recettes et de dépenses. */
export default function MetierScreen({ data, update, today, close }: ScreenProps) {
  const s = data.settings
  const [choice, setChoice] = useState<ProfessionChoice>(() => {
    const t = findProfession(s.profession?.id) ?? BARBER
    return { ...choiceFrom(t, s.profession?.label), income: s.incomeCats ?? t.income, expenses: s.expenseCats ?? t.expenses }
  })
  const changed = choice.template.id !== (s.profession?.id ?? BARBER.id)
  const [applyDefaults, setApplyDefaults] = useState(false)

  function save() {
    const now = nowIso()
    update((d) => ({
      ...d,
      days: applyDefaults ? changeWorkdays(d, choice.template.workdays, today) : d.days,
      settings: {
        ...d.settings,
        profession: choice.profession,
        incomeCats: choice.income,
        expenseCats: choice.expenses,
        ...(applyDefaults ? { workdays: choice.template.workdays, keepPct: choice.template.keepPct } : {}),
        updatedAt: now,
      },
    }))
    close()
  }

  return (
    <Screen title="Mon métier" back={close}>
      <ProfessionPicker value={choice} onChange={setChoice} />
      {changed && (
        <Card className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="font-semibold">Prendre aussi ses réglages habituels</span>
            <span className="text-[0.875rem] text-muted">
              Jours de travail et part gardée ({choice.template.keepPct} %). Le passé ne change pas.
            </span>
          </span>
          <Toggle checked={applyDefaults} onChange={setApplyDefaults} label="Prendre aussi ses réglages habituels" />
        </Card>
      )}
      <Notice>Tes journées déjà saisies sont gardées. Une catégorie retirée apparaît dans « Autres » dans les stats.</Notice>
      <PrimaryButton onClick={save} icon={<IconCheck size={20} />}>
        Enregistrer
      </PrimaryButton>
    </Screen>
  )
}
