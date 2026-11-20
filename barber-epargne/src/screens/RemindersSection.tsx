import { useEffect, useState } from 'react'
import type { ScreenProps } from '../App'
import { disablePush, enablePush, fetchPublicKey, isIOS, loadPrefs, localTest, pushSupport, sendServerTest, updateTime } from '../lib/push'
import { Card, Chip, Notice, PrimaryButton, SecondaryButton, Toggle, inputClass } from '../ui'

/** « Rappel de fin de journée » dans les réglages. */
export default function RemindersSection({ account, open }: Pick<ScreenProps, 'account' | 'open'>) {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const [serverReady, setServerReady] = useState<boolean | null>(null)
  const support = pushSupport()
  const userId = account.id

  useEffect(() => {
    let alive = true
    void fetchPublicKey().then((k) => alive && setServerReady(k !== null))
    return () => {
      alive = false
    }
  }, [])

  // Seul un refus explicite (autorisation retirée dans les réglages du téléphone) éteint le rappel.
  const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const on = prefs.enabled && !denied

  async function toggle(next: boolean) {
    if (!userId) return
    setMessage(null)
    setBusy(true)
    if (next) {
      const r = await enablePush(userId, prefs.time)
      if (r.ok) {
        setPrefs(loadPrefs())
        setMessage({ text: `Rappel activé : tu seras prévenu à ${prefs.time} les jours où tu travailles et où rien n’est encore saisi.` })
      } else setMessage({ text: r.error, bad: true })
    } else {
      await disablePush(userId)
      setPrefs(loadPrefs())
      setMessage({ text: 'Rappel désactivé sur ce téléphone.' })
    }
    setBusy(false)
  }

  async function changeTime(time: string) {
    if (!/^\d{1,2}:\d{2}$/.test(time)) return
    setPrefs({ ...prefs, time })
    if (userId) {
      const r = await updateTime(userId, time)
      setMessage(r.ok ? { text: `Heure du rappel : ${time}.` } : { text: r.error, bad: true })
    }
  }

  async function serverTest() {
    setBusy(true)
    setMessage(null)
    const r = await sendServerTest()
    setBusy(false)
    if (!r) return setMessage({ text: 'Le serveur ne répond pas. Touche « Configurer les rappels » pour le vérifier.', bad: true })
    setMessage(r.sent > 0 ? { text: 'Notification envoyée par le serveur : elle doit arriver dans quelques secondes.' } : { text: r.failed > 0 ? 'L’envoi a échoué. Désactive puis réactive le rappel.' : 'Aucun téléphone inscrit : active d’abord le rappel.', bad: true })
  }

  async function localCheck() {
    setMessage((await localTest()) ? { text: 'Notification affichée sur ce téléphone.' } : { text: 'Impossible d’afficher une notification. Vérifie l’autorisation.', bad: true })
  }

  return (
    <Card tone="orange" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[1.1875rem] font-semibold">Rappel de fin de journée</span>
        {on && <Chip>Activé</Chip>}
      </div>
      <p className="text-[0.9375rem] text-ink/85">Une notification à la fin de chaque jour où tu travailles, pour saisir ce que tu as gagné. Rien ne part si tu as déjà saisi ta journée.</p>

      {!support.ok ? (
        <p className="rounded-2xl bg-white/60 p-3 text-[0.9375rem]">
          {support.reason === 'needs-install'
            ? 'Sur iPhone, les notifications marchent seulement quand l’app est ajoutée à l’écran d’accueil : ouvre-la dans Safari, touche Partager, puis « Sur l’écran d’accueil ». Rouvre-la ensuite depuis l’icône.'
            : isIOS()
              ? 'Cette version d’iOS ne gère pas les notifications des apps web (iOS 16.4 ou plus récent requis).'
              : 'Ce navigateur ne gère pas les notifications. Essaie avec Chrome ou Safari.'}
        </p>
      ) : serverReady === false ? (
        <>
          <p className="rounded-2xl bg-white/60 p-3 text-[0.9375rem]">Le serveur d’envoi n’est pas encore configuré. C’est à faire une seule fois, par le propriétaire de l’app.</p>
          <PrimaryButton onClick={() => open({ kind: 'rappels' })}>Configurer les rappels</PrimaryButton>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="remind-toggle" className="text-[1rem] font-medium">
              Me rappeler
            </label>
            <Toggle id="remind-toggle" checked={on} onChange={(v) => void toggle(v)} label="Activer le rappel de fin de journée" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="remind-time" className="text-[1rem] font-medium">
              À quelle heure
            </label>
            <input id="remind-time" type="time" value={prefs.time.padStart(5, '0')} onChange={(e) => void changeTime(e.target.value)} className={`${inputClass} w-36 bg-white/70 text-center`} />
          </div>
          {prefs.enabled && denied && <Notice bad>Les notifications ont été refusées pour Coffre. Autorise-les dans les réglages de ton téléphone (Réglages → Notifications → Coffre), puis réactive le rappel.</Notice>}
          {on && (
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton onClick={() => void localCheck()}>Voir un exemple</SecondaryButton>
              <SecondaryButton onClick={() => void serverTest()} disabled={busy}>
                Test serveur
              </SecondaryButton>
            </div>
          )}
          <button type="button" onClick={() => open({ kind: 'rappels' })} className="h-11 text-[0.9375rem] text-ink/80">
            Vérifier la configuration du serveur
          </button>
        </>
      )}
      {message && <Notice bad={message.bad}>{message.text}</Notice>}
    </Card>
  )
}
