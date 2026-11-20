import { useState } from 'react'
import { BARBER, GENERIC, normalize, PROFESSIONS, searchProfessions, type Profession } from '../lib/professions'
import type { CategoryDef } from '../lib/types'
import { inputClass } from '../ui'

export interface ProfessionChoice {
  profession: { id: string; label: string }
  income: CategoryDef[]
  expenses: CategoryDef[]
  /** Modèle d'origine (pour les réglages par défaut : jours, part gardée). */
  template: Profession
}

export function choiceFrom(p: Profession, label?: string): ProfessionChoice {
  return { profession: { id: p.id, label: label?.trim() || p.label }, income: p.income, expenses: p.expenses, template: p }
}

/** Métiers proposés avant que la personne tape quoi que ce soit (les plus courants). */
const POPULAR = ['batiment', 'vtc', 'barbier', 'commerce', 'freelance', 'livreur', 'esthetique', 'sante'].map((id) => PROFESSIONS.find((p) => p.id === id)!)

const slug = (t: string) => normalize(t).replace(/ /g, '-').slice(0, 30) || 'cat'

/**
 * Choix du métier : la personne tape son métier, l'app propose les plus proches ; puis les catégories
 * de recettes et de dépenses du métier s'affichent, et on peut en enlever ou en ajouter.
 */
export default function ProfessionPicker({ value, onChange, tone = 'surface' }: { value: ProfessionChoice | null; onChange: (c: ProfessionChoice) => void; tone?: 'surface' | 'field' }) {
  const [text, setText] = useState(value?.profession.label ?? '')
  const [newIncome, setNewIncome] = useState('')
  const [newExpense, setNewExpense] = useState('')
  const found = text.trim() ? searchProfessions(text, 4) : POPULAR
  const bg = tone === 'surface' ? 'bg-surface' : 'bg-field'

  const pick = (p: Profession) => {
    // Le nom tapé par la personne est gardé s'il est plus précis (« Installateur clim »).
    const typed = text.trim()
    onChange(choiceFrom(p, typed && !found.slice(0, 1).every((f) => normalize(f.label) === normalize(typed)) && p.id !== GENERIC.id ? typed : p.label))
  }

  const addCat = (kind: 'income' | 'expenses', label: string) => {
    if (!value || !label.trim()) return
    const list = value[kind]
    if (list.length >= 12) return
    let id = slug(label)
    while (list.some((c) => c.id === id)) id += '-2'
    onChange({ ...value, [kind]: [...list, { id, label: label.trim().slice(0, 40), emoji: '🏷️' }] })
  }
  const removeCat = (kind: 'income' | 'expenses', id: string) => {
    if (!value) return
    if (kind === 'income' && value.income.filter((c) => c.kind !== 'tips').length <= 1 && value.income.find((c) => c.id === id)?.kind !== 'tips') return
    onChange({ ...value, [kind]: value[kind].filter((c) => c.id !== id) })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="metier" className="text-[0.9375rem] font-medium">
          Ton métier
        </label>
        <input id="metier" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. installateur clim, VTC, coiffeuse…" autoComplete="organization-title" className={`${inputClass} ${bg}`} />
        <div className="flex flex-col gap-2" role="listbox" aria-label="Métiers proposés">
          {found.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={value?.template.id === p.id}
              onClick={() => pick(p)}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2 text-left text-[0.9375rem] active:scale-[0.99] ${value?.template.id === p.id ? 'bg-ink text-white' : bg}`}
            >
              <span className="text-[1.25rem]" aria-hidden="true">
                {p.emoji}
              </span>
              <span className="font-medium">{p.label}</span>
            </button>
          ))}
          {text.trim() !== '' && (
            <button
              type="button"
              role="option"
              aria-selected={value?.template.id === GENERIC.id}
              onClick={() => onChange(choiceFrom(GENERIC, text))}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2 text-left text-[0.9375rem] active:scale-[0.99] ${value?.template.id === GENERIC.id ? 'bg-ink text-white' : bg}`}
            >
              <span className="text-[1.25rem]" aria-hidden="true">
                {GENERIC.emoji}
              </span>
              <span>
                <span className="font-medium">Autre métier : « {text.trim()} »</span>
                <span className="block text-[0.8125rem] opacity-75">Catégories de base, à adapter</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {value && (
        <>
          <CatList
            title="Ce que tu encaisses"
            hint="Le premier est celui que tu saisis chaque jour ; les autres se détaillent si besoin."
            cats={value.income}
            onRemove={(id) => removeCat('income', id)}
            add={newIncome}
            setAdd={setNewIncome}
            onAdd={() => (addCat('income', newIncome), setNewIncome(''))}
            placeholder="Ajouter (ex. Ventes de pièces)"
            bg={bg}
          />
          <CatList
            title="Tes dépenses"
            hint={value.expenses.length ? 'Ce que tu achètes ou paies pour travailler. Elles sont retirées de tes recettes.' : 'Aucune : tu n’auras pas de dépenses à saisir. Ajoutes-en si besoin.'}
            cats={value.expenses}
            onRemove={(id) => removeCat('expenses', id)}
            add={newExpense}
            setAdd={setNewExpense}
            onAdd={() => (addCat('expenses', newExpense), setNewExpense(''))}
            placeholder="Ajouter (ex. Location d’outils)"
            bg={bg}
          />
        </>
      )}
    </div>
  )
}

function CatList({ title, hint, cats, onRemove, add, setAdd, onAdd, placeholder, bg }: { title: string; hint: string; cats: CategoryDef[]; onRemove: (id: string) => void; add: string; setAdd: (v: string) => void; onAdd: () => void; placeholder: string; bg: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[1rem] font-semibold">{title}</span>
      <span className="text-[0.8125rem] text-muted">{hint}</span>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <span key={c.id} className={`flex h-10 items-center gap-1.5 rounded-full pl-3 text-[0.875rem] ${bg}`}>
            <span aria-hidden="true">{c.emoji}</span>
            {c.label}
            <button type="button" onClick={() => onRemove(c.id)} aria-label={`Retirer ${c.label}`} className="flex h-10 w-9 items-center justify-center rounded-full text-[1.125rem] text-muted active:scale-90">
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
      >
        <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder={placeholder} maxLength={40} className={`${inputClass} ${bg} h-11 flex-1`} aria-label={placeholder} />
        <button type="submit" disabled={!add.trim()} className="h-11 shrink-0 rounded-full bg-ink px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-40">
          Ajouter
        </button>
      </form>
    </div>
  )
}

export { BARBER }
