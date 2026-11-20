import { useState, type FormEvent } from 'react'
import { checkPassword, createAccount, listAccounts, rememberedEmail, rememberEmail, startSession } from '../lib/accounts'
import { IconChevronLeft } from '../icons'
import Logo from '../Logo'
import Shapes from '../Shapes'
import { Field, inputClass, PrimaryButton } from '../ui'

type Step = 'home' | 'login' | 'signup'

/**
 * Premier écran : créer un compte (une seule fois) ou se connecter. Une fois connecté, la connexion est
 * mémorisée sur l'appareil : on n'a plus rien à retaper.
 */
export default function Welcome() {
  const hasAccount = listAccounts().length > 0
  const [step, setStep] = useState<Step>('home')
  const [email, setEmail] = useState(rememberedEmail)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (step === 'signup' && password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    setBusy(true)
    const r = step === 'signup' ? await createAccount(email, password) : await checkPassword(email, password)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    rememberEmail(r.account.email)
    startSession(r.account.id, remember)
    // On repart d'un état propre avec les données de ce compte.
    window.location.reload()
  }

  const go = (s: Step) => {
    setStep(s)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]"
      style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}
    >
      {step !== 'home' && (
        <button type="button" onClick={() => go('home')} aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-full bg-surface active:scale-95">
          <IconChevronLeft size={20} />
        </button>
      )}

      {step === 'home' && (
        <>
          <section className="relative flex min-h-[54dvh] flex-1 flex-col overflow-hidden rounded-[36px] bg-violet p-6">
            <div className="flex items-center gap-2.5">
              <Logo size={34} />
              <span className="text-[1.1875rem] font-semibold">Coffre</span>
            </div>
            <div className="flex flex-1 items-center justify-center py-4">
              <div className="float-in">
                <Shapes className="bob h-60 w-60" />
              </div>
            </div>
            <h1 className="display text-[2.5rem] [text-wrap:balance]">
              Chaque jour compte.
            </h1>
          </section>
          <div className="flex flex-col gap-3">
            {hasAccount ? (
              <>
                <PrimaryButton onClick={() => go('login')}>Me connecter</PrimaryButton>
                <button type="button" onClick={() => go('signup')} className="h-12 text-[1rem] font-medium">
                  Créer un autre compte
                </button>
              </>
            ) : (
              <PrimaryButton onClick={() => go('signup')}>Créer mon compte</PrimaryButton>
            )}
          </div>
        </>
      )}

      {step !== 'home' && (
        <form onSubmit={submit} className="flex flex-col gap-5 pt-2" noValidate>
          <div className="flex flex-col gap-2">
            <h1 className="display text-[2.125rem]">{step === 'login' ? 'Connexion' : 'Créer mon compte'}</h1>
            <p className="text-[1rem] text-muted">
              {step === 'login' ? 'Ton e-mail et ton mot de passe.' : 'Une seule fois : ton e-mail et un mot de passe de 6 caractères minimum.'}
            </p>
          </div>
          <Field label="Adresse e-mail" htmlFor="email">
            <input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoFocus={!email} value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} className={`${inputClass} bg-surface`} />
          </Field>
          <Field label="Mot de passe" htmlFor="password" error={step === 'login' ? error : null}>
            <input id="password" type="password" autoComplete={step === 'login' ? 'current-password' : 'new-password'} autoFocus={Boolean(email)} value={password} onChange={(e) => (setPassword(e.target.value), setError(null))} className={`${inputClass} bg-surface`} />
          </Field>
          {step === 'signup' && (
            <Field label="Confirmer le mot de passe" htmlFor="confirm" error={error}>
              <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => (setConfirm(e.target.value), setError(null))} className={`${inputClass} bg-surface`} />
            </Field>
          )}
          <label className="flex items-center gap-3 text-[1rem]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-6 w-6 accent-[#121215]" />
            Rester connecté sur cet appareil
          </label>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Un instant…' : step === 'login' ? 'Me connecter' : 'Créer mon compte'}
          </PrimaryButton>
          <button type="button" onClick={() => go(step === 'login' ? 'signup' : 'login')} className="h-12 text-[1rem] font-medium">
            {step === 'login' ? 'Pas encore de compte ? En créer un' : 'J’ai déjà un compte'}
          </button>
          {step === 'login' && (
            <p className="rounded-2xl bg-surface p-4 text-[0.875rem] text-muted">
              Mot de passe oublié ? Il ne peut pas être récupéré par e-mail : les comptes restent sur cet appareil. Crée un nouveau compte puis restaure ton fichier de sauvegarde (Réglages → Restaurer depuis un fichier).
            </p>
          )}
        </form>
      )}
    </main>
  )
}
