import { useEffect, useRef, useState } from 'react'
import { signOutEverywhere } from '../lib/accounts'
import { biometricAvailable, checkCode, disableBiometric, enableBiometric, loadLock, removeLock, setCode, unlockWithBiometric, validCode } from '../lib/lock'
import Logo from '../Logo'
import { Card, Chip, DangerButton, Field, inputClass, Notice, PrimaryButton, SecondaryButton } from '../ui'

/** Écran de verrouillage : Face ID / Touch ID, ou code à 4 chiffres. */
export function LockScreen({ onUnlock, email }: { onUnlock: () => void; email: string }) {
  const lock = loadLock()
  const [code, setCodeText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tries, setTries] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const tried = useRef(false)

  async function bio() {
    if (await unlockWithBiometric()) onUnlock()
  }

  // Face ID proposé tout de suite (si le téléphone l'autorise sans toucher ; sinon le bouton reste là).
  useEffect(() => {
    if (lock?.credentialId && !tried.current) {
      tried.current = true
      void bio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function press(d: string) {
    if (Date.now() < waitUntil) return
    const next = (code + d).slice(0, 4)
    setCodeText(next)
    setError(null)
    if (next.length < 4) return
    if (await checkCode(next)) return onUnlock()
    const t = tries + 1
    setTries(t)
    setCodeText('')
    if (t >= 5) {
      setWaitUntil(Date.now() + 30_000)
      setTries(0)
      setError('Trop d’essais. Attends 30 secondes.')
    } else setError('Code incorrect.')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 py-10">
      <Logo size={56} />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="display text-[1.75rem]">Coffre est verrouillé</h1>
        <p className="text-[0.9375rem] text-muted">Entre ton code{lock?.credentialId ? ' ou utilise Face ID' : ''}.</p>
      </div>
      <div className="flex gap-4" aria-label={`${code.length} chiffres sur 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink ${i < code.length ? 'bg-ink' : ''}`} />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[0.9375rem] font-medium text-bad">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => void press(d)} className="num h-18 w-18 rounded-full bg-surface text-[1.75rem] font-medium active:scale-95 active:bg-violet-soft">
            {d}
          </button>
        ))}
        {lock?.credentialId ? (
          <button type="button" onClick={() => void bio()} aria-label="Déverrouiller avec Face ID" className="h-18 w-18 rounded-full text-[0.8125rem] font-semibold active:scale-95">
            Face ID
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => void press('0')} className="num h-18 w-18 rounded-full bg-surface text-[1.75rem] font-medium active:scale-95 active:bg-violet-soft">
          0
        </button>
        <button type="button" onClick={() => setCodeText(code.slice(0, -1))} aria-label="Effacer un chiffre" className="h-18 w-18 rounded-full text-[1.25rem] active:scale-95">
          ⌫
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          // Code oublié : on se déconnecte ; il faudra retaper son mot de passe, et le verrou est retiré.
          removeLock()
          void signOutEverywhere().then(() => window.location.reload())
        }}
        className="h-11 text-[0.875rem] text-muted underline underline-offset-2"
      >
        Code oublié ? Me reconnecter avec mon mot de passe ({email})
      </button>
    </main>
  )
}

/** Réglages du verrou. */
export function LockSection({ email }: { email: string }) {
  const [lock, setLock] = useState(loadLock)
  const [editing, setEditing] = useState(false)
  const [c1, setC1] = useState('')
  const [c2, setC2] = useState('')
  const [bioOk, setBioOk] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    void biometricAvailable().then(setBioOk)
  }, [])

  async function saveCode() {
    if (!validCode(c1)) return setMessage({ text: 'Le code doit faire 4 chiffres.', bad: true })
    if (c1 !== c2) return setMessage({ text: 'Les deux codes ne sont pas identiques.', bad: true })
    await setCode(c1)
    setLock(loadLock())
    setEditing(false)
    setC1('')
    setC2('')
    setMessage({ text: bioOk && !loadLock()?.credentialId ? 'Code enregistré. Tu peux aussi activer Face ID.' : 'Code enregistré. L’app se verrouille à chaque ouverture.' })
  }

  async function bio() {
    const err = await enableBiometric(email)
    setLock(loadLock())
    setMessage(err ? { text: err, bad: true } : { text: 'Face ID activé.' })
  }

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[1.1875rem] font-semibold">Verrouillage</span>
        {lock && <Chip>{lock.credentialId ? 'Face ID + code' : 'Code'}</Chip>}
      </div>
      <p className="text-[0.9375rem] text-muted">L’app demande Face ID (ou ton code) à chaque ouverture, et après une minute en arrière-plan.</p>

      {(editing || !lock) && (
        <div className="flex flex-col gap-3">
          <Field label={lock ? 'Nouveau code (4 chiffres)' : 'Choisis un code (4 chiffres)'} htmlFor="code1" hint="Il sert si Face ID ne marche pas.">
            <input id="code1" type="password" inputMode="numeric" autoComplete="off" value={c1} onChange={(e) => setC1(digits(e.target.value))} className={`${inputClass} num tracking-[0.5em]`} />
          </Field>
          <Field label="Confirme le code" htmlFor="code2">
            <input id="code2" type="password" inputMode="numeric" autoComplete="off" value={c2} onChange={(e) => setC2(digits(e.target.value))} className={`${inputClass} num tracking-[0.5em]`} />
          </Field>
          <PrimaryButton onClick={() => void saveCode()}>{lock ? 'Changer le code' : 'Activer le verrou'}</PrimaryButton>
        </div>
      )}

      {lock && !editing && (
        <div className="flex flex-col gap-3">
          {bioOk &&
            (lock.credentialId ? (
              <SecondaryButton onClick={() => (disableBiometric(), setLock(loadLock()), setMessage({ text: 'Face ID désactivé : le code reste demandé.' }))}>Désactiver Face ID</SecondaryButton>
            ) : (
              <PrimaryButton onClick={() => void bio()}>Activer Face ID</PrimaryButton>
            ))}
          {!bioOk && <p className="text-[0.875rem] text-muted">Face ID n’est pas disponible dans ce navigateur. Sur iPhone, ouvre l’app depuis son icône sur l’écran d’accueil.</p>}
          <SecondaryButton onClick={() => (setEditing(true), setMessage(null))}>Changer le code</SecondaryButton>
          <DangerButton confirmText="Confirmer : retirer le verrou" onConfirm={() => (removeLock(), setLock(null), setMessage({ text: 'Verrou retiré.' }))}>
            Retirer le verrou
          </DangerButton>
        </div>
      )}
      {message && <Notice bad={message.bad}>{message.text}</Notice>}
    </Card>
  )
}
