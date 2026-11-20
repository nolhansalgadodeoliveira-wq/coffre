import { useRef, useState, type FormEvent } from 'react'
import type { ScreenProps } from '../App'
import { changePassword, clearLocalData, signOutEverywhere } from '../lib/accounts'
import { disablePush, loadPrefs } from '../lib/push'
import { lastBackupAt, listSnapshots, saveBackupFile, snapshotData } from '../lib/backup'
import { formatDayYear } from '../lib/dates'
import { mergeData } from '../lib/sync'
import { parseData } from '../lib/storage'
import { Card, DangerButton, inputClass, Notice, PrimaryButton, SecondaryButton } from '../ui'

function when(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `aujourd’hui à ${time}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`
}

/** « Compte et sauvegarde » en haut des réglages. */
export default function AccountSection({ account, sync, data, update, today }: Pick<ScreenProps, 'account' | 'sync' | 'data' | 'update' | 'today'>) {
  const [unsynced, setUnsynced] = useState(false)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const [last, setLast] = useState(lastBackupAt)
  const [showCopies, setShowCopies] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function saveFile() {
    const r = await saveBackupFile(data, today)
    if (r !== 'cancelled') {
      setLast(lastBackupAt())
      setMessage({ text: r === 'shared' ? 'Sauvegarde enregistrée.' : 'Fichier de sauvegarde téléchargé.' })
    }
  }

  async function restore(file: File) {
    try {
      const parsed = parseData(JSON.parse(await file.text()))
      if (!parsed) return setMessage({ text: 'Ce fichier n’est pas une sauvegarde de l’app.', bad: true })
      // Fusion : tes journées actuelles sont gardées, celles du fichier s'ajoutent (la plus récente gagne pour un même jour).
      update((d) => mergeData(d, parsed))
      setMessage({ text: `Sauvegarde restaurée : ${parsed.entries.length} journées, ${parsed.bilans.length} bilans (fusionnés avec tes données).` })
    } catch {
      setMessage({ text: 'Impossible de lire ce fichier.', bad: true })
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    const err = await changePassword(account.email, oldPw, newPw)
    setMessage(err ? { text: err, bad: true } : { text: 'Mot de passe modifié.' })
    if (!err) (setPwOpen(false), setOldPw(''), setNewPw(''))
  }

  const [leaving, setLeaving] = useState(false)
  async function signOut(force = false) {
    // On envoie d'abord ce qui attend : rien n'est perdu, tout se retrouve sur l'autre appareil.
    setLeaving(true)
    const sent = force || (await sync.flush())
    setLeaving(false)
    if (!sent) return setUnsynced(true)
    // Les rappels de ce téléphone sont liés au compte : on les retire avant de partir.
    if (loadPrefs().enabled) await disablePush(account.id)
    await signOutEverywhere()
    window.location.reload()
  }

  const syncText =
    sync.status === 'syncing'
      ? 'Synchronisation…'
      : sync.status === 'offline'
        ? 'Hors ligne : la synchronisation reprendra au retour du réseau.'
        : sync.status === 'relogin'
          ? 'Reconnecte-toi pour synchroniser (déconnexion puis connexion).'
          : sync.status === 'error'
            ? sync.error
            : sync.lastSyncAt
              ? `Données en ligne à jour (${when(sync.lastSyncAt)}). Tu les retrouves sur tous tes appareils, rien à faire.`
              : 'Prêt à synchroniser.'

  const copies = showCopies ? listSnapshots() : []

  return (
    <Card tone="violet" className="flex flex-col gap-4">
      <span className="text-[1.1875rem] font-semibold">Mon compte</span>

      <div className="flex flex-col gap-3 rounded-[22px] bg-white/70 p-4">
        <p className="text-[0.9375rem] break-all">{account.email}</p>
        <p role="status" className={`text-[0.875rem] ${sync.status === 'error' ? 'font-medium text-bad' : 'text-ink/80'}`}>
          {syncText}
        </p>
        {(sync.status === 'error' || sync.status === 'relogin') && <SecondaryButton onClick={() => void sync.syncNow()}>Réessayer</SecondaryButton>}
        {pwOpen ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => void submitPassword(e)}>
            <label htmlFor="oldpw" className="text-[0.9375rem] font-medium">Mot de passe actuel</label>
            <input id="oldpw" type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={`${inputClass} bg-white`} />
            <label htmlFor="newpw" className="text-[0.9375rem] font-medium">Nouveau mot de passe</label>
            <input id="newpw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={`${inputClass} bg-white`} />
            <PrimaryButton type="submit">Enregistrer le mot de passe</PrimaryButton>
          </form>
        ) : (
          <SecondaryButton onClick={() => setPwOpen(true)}>Changer mon mot de passe</SecondaryButton>
        )}
        {unsynced ? (
          <>
            <Notice bad>Des modifications ne sont pas encore en ligne (pas de réseau ?). Elles restent sur ce téléphone, mais tu ne les verras pas sur un autre appareil tant qu’elles ne sont pas envoyées.</Notice>
            <DangerButton confirmText="Me déconnecter quand même" onConfirm={() => void signOut(true)}>
              Me déconnecter quand même
            </DangerButton>
          </>
        ) : (
          <SecondaryButton disabled={leaving} onClick={() => void signOut()}>
            {leaving ? 'Envoi de tes dernières données…' : 'Me déconnecter'}
          </SecondaryButton>
        )}
        <p className="text-[0.8125rem] text-ink/75">Tu restes connecté sur cet appareil tant que tu ne te déconnectes pas.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-white/70 p-4">
        <span className="font-semibold">Sauvegarde</span>
        <p className="text-[0.9375rem] text-ink/85">
          Tes données sont déjà gardées dans ton compte en ligne. En plus, l’app garde une copie par jour sur ce téléphone (14 jours), et tu peux enregistrer un fichier pour en garder une ailleurs (sur iPhone : « Enregistrer dans Fichiers »).</p>
        <p className="text-[0.875rem] text-ink/80">{last ? `Dernier fichier : ${when(last)}` : 'Aucun fichier enregistré pour l’instant.'}</p>
        <PrimaryButton onClick={() => void saveFile()}>Enregistrer un fichier de sauvegarde</PrimaryButton>
        <SecondaryButton onClick={() => fileRef.current?.click()}>Restaurer depuis un fichier</SecondaryButton>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void restore(f)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => setShowCopies((v) => !v)} aria-expanded={showCopies} className="h-11 text-[0.9375rem] text-ink/80">
          {showCopies ? 'Masquer les copies automatiques' : 'Revenir à une copie automatique'}
        </button>
        {showCopies && (
          <div className="flex flex-col gap-2">
            <p className="text-[0.8125rem] text-muted">Utile si tu as effacé quelque chose par erreur.</p>
            {copies.length === 0 && <p className="text-[0.875rem]">Pas encore de copie.</p>}
            {copies.map((c) => (
              <DangerButton
                key={c.day}
                confirmText={`Remplacer mes données par la copie du ${formatDayYear(c.day)}`}
                onConfirm={() => {
                  const d = snapshotData(c)
                  if (!d) return setMessage({ text: 'Cette copie est illisible.', bad: true })
                  update(() => ({ ...d, settings: { ...d.settings, updatedAt: new Date().toISOString() } }))
                  setMessage({ text: `Données remises comme le ${formatDayYear(c.day)}.` })
                }}
              >
                {`Copie du ${formatDayYear(c.day)} · ${c.data.entries.length} journées`}
              </DangerButton>
            ))}
          </div>
        )}
      </div>

      {message && <Notice bad={message.bad}>{message.text}</Notice>}

      <DangerButton
        confirmText="Confirmer : tout supprimer, en ligne et ici"
        onConfirm={() =>
          void sync.deleteOnline().then(async (err) => {
            if (err) return setMessage({ text: err, bad: true })
            clearLocalData(account.ns)
            await signOutEverywhere()
            window.location.reload()
          })
        }
      >
        Supprimer mes données (en ligne et sur ce téléphone)
      </DangerButton>
      <p className="text-[0.75rem] text-ink/75">Tes données sont gardées sur ce téléphone et dans ton compte en ligne : connecte-toi sur un autre appareil avec le même e-mail pour les retrouver.</p>
    </Card>
  )
}
