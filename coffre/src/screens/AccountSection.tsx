import { useRef, useState, type FormEvent } from 'react'
import type { ScreenProps } from '../App'
import { changePassword, deleteAccount, endSession } from '../lib/accounts'
import { lastBackupAt, listSnapshots, saveBackupFile, snapshotData } from '../lib/backup'
import { formatDayYear } from '../lib/dates'
import { mergeData } from '../lib/merge'
import { parseData } from '../lib/storage'
import { Card, DangerButton, inputClass, Notice, PrimaryButton, SecondaryButton } from '../ui'

function when(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `aujourd’hui à ${time}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`
}

/** « Compte et sauvegarde » en haut des réglages. */
export default function AccountSection({ account, data, update, today }: Pick<ScreenProps, 'account' | 'data' | 'update' | 'today'>) {
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
    const err = await changePassword(account.id, oldPw, newPw)
    setMessage(err ? { text: err, bad: true } : { text: 'Mot de passe modifié.' })
    if (!err) (setPwOpen(false), setOldPw(''), setNewPw(''))
  }

  function signOut() {
    endSession()
    window.location.reload()
  }

  const copies = showCopies ? listSnapshots() : []

  return (
    <Card tone="violet" className="flex flex-col gap-4">
      <span className="text-[1.1875rem] font-semibold">Mon compte</span>

      <div className="flex flex-col gap-3 rounded-[22px] bg-white/70 p-4">
        <p className="text-[0.9375rem] break-all">{account.email}</p>
        <p className="text-[0.8125rem] text-ink/80">Tu restes connecté sur cet appareil tant que tu ne te déconnectes pas.</p>
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
        <SecondaryButton onClick={signOut}>Me déconnecter</SecondaryButton>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-white/70 p-4">
        <span className="font-semibold">Sauvegarde</span>
        <p className="text-[0.9375rem] text-ink/85">
          Tes données sont enregistrées automatiquement sur cet appareil, avec une copie par jour pendant 14 jours. Pour les garder en sécurité ailleurs (ou changer de téléphone), enregistre un fichier : sur iPhone, « Enregistrer dans Fichiers » puis iCloud Drive.
        </p>
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
        confirmText="Confirmer : supprimer mon compte et mes données"
        onConfirm={() => {
          deleteAccount(account.id)
          window.location.reload()
        }}
      >
        Supprimer mon compte et mes données
      </DangerButton>
      <p className="text-[0.75rem] text-ink/75">Les comptes et les données restent sur cet appareil, rien n’est envoyé sur Internet. Le mot de passe protège l’ouverture de l’app ; garde aussi un fichier de sauvegarde.</p>
    </Card>
  )
}
