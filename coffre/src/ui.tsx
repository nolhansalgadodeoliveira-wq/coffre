// Composants réutilisés sur tous les écrans. Style : cartes très arrondies, boutons en pilule, encre presque noire.

import { useState, type ReactNode } from 'react'
import { IconArrow, IconChevronLeft } from './icons'

export type Tone = 'white' | 'violet' | 'orange' | 'blue' | 'pink' | 'peach' | 'dark' | 'plain'

const TONES: Record<Tone, string> = {
  white: 'bg-surface',
  violet: 'bg-violet',
  orange: 'bg-orange',
  blue: 'bg-blue',
  pink: 'bg-pink',
  peach: 'bg-peach',
  dark: 'bg-ink text-white',
  plain: '',
}

export function Screen({ title, children, back, action }: { title: string; children: ReactNode; back?: () => void; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-12 items-center gap-3">
        {back && (
          <RoundButton label="Retour" onClick={back}>
            <IconChevronLeft size={20} />
          </RoundButton>
        )}
        <h1 className="display min-w-0 flex-1 text-[1.875rem] [text-wrap:balance]">{title}</h1>
        {action}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '', tone = 'white' }: { children: ReactNode; className?: string; tone?: Tone }) {
  return <section className={`rounded-[28px] p-5 ${TONES[tone]} ${className}`}>{children}</section>
}

/** Petite étiquette en pilule, comme « Medium » / « Light » sur les modèles. */
export function Chip({ children, className = '', dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-[0.8125rem] font-medium ${/\bbg-/.test(className) ? 'text-ink' : dark ? 'bg-white/20 text-white' : 'bg-white/65 text-ink'} ${className}`}>
      {children}
    </span>
  )
}

/** Interrupteur : zone tactile de 48 px autour d'un rail de 56 × 32. */
export function Toggle({ checked, onChange, id, label }: { checked: boolean; onChange: (v: boolean) => void; id?: string; label: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="-m-2 shrink-0 p-2">
      <span className={`relative block h-8 w-14 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-line'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}

/** Barre de progression accessible. */
export function ProgressBar({ value, label, className = 'h-3 bg-white/60', fill = 'bg-ink' }: { value: number; label: string; className?: string; fill?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <span className={`block overflow-hidden rounded-full ${className}`} role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={`block h-full rounded-full transition-[width] duration-700 ${fill}`} style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
    </span>
  )
}

/** Bouton rond (retour, flèches). */
export function RoundButton({
  children,
  onClick,
  label,
  className = 'bg-surface',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95 disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  )
}

/** Flèche ronde en bas d'une carte, comme sur les modèles. */
export function ArrowBadge({ className = 'bg-surface text-ink' }: { className?: string }) {
  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${className}`} aria-hidden="true">
      <IconArrow size={20} />
    </span>
  )
}

export function PrimaryButton(props: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; icon?: ReactNode }) {
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex h-15 w-full items-center justify-between gap-3 rounded-full bg-ink pr-2 pl-6 text-[1.0625rem] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
    >
      <span className="min-w-0 flex-1 text-left leading-tight">{props.children}</span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink">{props.icon ?? <IconArrow size={20} />}</span>
    </button>
  )
}

export function SecondaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="h-14 w-full rounded-full bg-surface px-5 text-[1rem] font-medium active:scale-[0.98] disabled:opacity-40"
    >
      {props.children}
    </button>
  )
}

/** Suppression en deux temps : le premier appui demande confirmation dans la page. */
export function DangerButton({ children, onConfirm, confirmText }: { children: ReactNode; onConfirm: () => void; confirmText: string }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={`h-14 w-full rounded-full px-5 text-[1rem] font-medium ${armed ? 'bg-bad text-white' : 'bg-bad-soft text-bad'}`}
    >
      {armed ? confirmText : children}
    </button>
  )
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[0.9375rem] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.875rem] text-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[0.875rem] text-muted">{hint}</p>
      )}
    </div>
  )
}

export const inputClass =
  'h-14 w-full min-w-0 rounded-2xl border-2 border-transparent bg-field px-4 text-[1.0625rem] outline-none focus:border-ink'

/** Champ montant en euros, avec le symbole € collé à droite. `onTone` : posé sur une carte de couleur. */
export function MoneyInput({
  id,
  value,
  onChange,
  large,
  placeholder,
  onTone,
  className = '',
}: {
  id: string
  value: string
  onChange: (v: string) => void
  large?: boolean
  placeholder?: string
  onTone?: boolean
  className?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} num pr-10 ${onTone ? 'bg-white/70 placeholder:text-ink/40' : ''} ${large ? 'display h-18 text-[2.125rem]' : ''} ${className}`}
      />
      <span className={`pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 ${onTone ? 'text-ink/50' : 'text-muted'} ${large ? 'text-[1.5rem] font-semibold' : ''}`}>€</span>
    </div>
  )
}

/** Sélecteur en pilule noire, comme « Weekly / Month » sur les modèles. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className = 'bg-surface',
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-1 rounded-full p-1.5 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-11 min-w-0 flex-1 rounded-full px-1.5 text-[0.9375rem] leading-tight font-medium ${value === o.value ? 'bg-ink text-white' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Ligne libellé / montant, alignée en colonne. */
export function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 text-[1rem] ${strong ? 'font-semibold' : ''}`}>
      <span className={`min-w-0 ${strong ? '' : 'text-muted'}`}>{label}</span>
      <span className={`num text-right whitespace-nowrap ${color}`}>{value}</span>
    </div>
  )
}

/** Pastille d'écart : verte si en avance, rouge si en retard. */
export function DeltaChip({ value, children }: { value: number; children: ReactNode }) {
  const style = value > 0 ? 'bg-good-soft text-good' : value < 0 ? 'bg-bad-soft text-bad' : 'bg-white/70 text-ink'
  return <span className={`num inline-flex h-8 items-center rounded-full px-3 text-[0.875rem] font-semibold whitespace-nowrap ${style}`}>{children}</span>
}

/** Message d'information ou d'erreur. */
export function Notice({ children, bad }: { children: ReactNode; bad?: boolean }) {
  return (
    <p role={bad ? 'alert' : 'status'} className={`rounded-2xl p-4 text-[0.9375rem] ${bad ? 'bg-bad-soft text-bad' : 'bg-violet-soft'}`}>
      {children}
    </p>
  )
}
