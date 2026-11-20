import { useState } from 'react'
import type { ScreenProps } from '../App'
import { PROJECT_URL } from '../lib/cloud'
import { generateVapidKeys, pingServer, randomSecret, type ServerStatus } from '../lib/push'
import { setupSql, singleFileFunction } from '../lib/remindersSetup'
import { IconCheck } from '../icons'
import { Card, Notice, PrimaryButton, Screen, SecondaryButton } from '../ui'

const KEYS = 'coffre-vapid:v1'
interface Keys {
  publicKey: string
  privateKey: string
  cronSecret: string
}

function loadKeys(): Keys | null {
  try {
    const k = JSON.parse(localStorage.getItem(KEYS) || 'null') as Keys | null
    return k && k.publicKey && k.privateKey && k.cronSecret ? k : null
  } catch {
    return null
  }
}

/** Assistant de configuration des rappels : génère les clés et prépare tout ce qu'il faut coller dans Supabase. */
export default function RemindersSetup({ account, close }: Pick<ScreenProps, 'account' | 'close'>) {
  const [keys, setKeys] = useState<Keys | null>(loadKeys)
  const [status, setStatus] = useState<ServerStatus | 'unreachable' | null>(null)
  const [busy, setBusy] = useState(false)

  const functionUrl = `${PROJECT_URL}/functions/v1/reminders`
  const subject = `mailto:${account.email}`

  async function generate() {
    const k = { ...(await generateVapidKeys()), cronSecret: randomSecret(32) }
    try {
      localStorage.setItem(KEYS, JSON.stringify(k))
    } catch {
      /* gardées en mémoire seulement */
    }
    setKeys(k)
    setStatus(null)
  }

  async function check() {
    setBusy(true)
    const r = await pingServer()
    setStatus(r ?? 'unreachable')
    setBusy(false)
    // Tout est en place : la clé privée n'a plus besoin de rester sur ce téléphone.
    if (r && r.vapid && r.keyMatches && r.cron && r.table) {
      try {
        localStorage.removeItem(KEYS)
      } catch {
        /* ignoré */
      }
    }
  }

  const ok = status && status !== 'unreachable' && status.vapid && status.keyMatches && status.cron && status.table

  return (
    <main className="mx-auto min-h-dvh max-w-lg pt-[max(20px,env(safe-area-inset-top))] pb-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <Screen title="Configurer les rappels" back={close}>
        <Card tone="violet" className="flex flex-col gap-2">
          <span className="text-[1.125rem] font-semibold">Une seule fois, environ 10 minutes</span>
          <p className="text-[0.9375rem] text-ink/85">
            Pour que le rappel arrive même quand l’app est fermée, un petit programme tourne sur ton compte Supabase. Cet assistant prépare tout : tu n’as qu’à copier et coller.
          </p>
        </Card>


        <Step n={1} title="Générer tes clés" done={!!keys}>
          <p className="text-[0.9375rem] text-muted">Ce sont les « papiers d’identité » de ton serveur d’envoi. Elles sont créées ici, sur ton téléphone.</p>
          {!keys ? (
            <PrimaryButton onClick={() => void generate()}>Générer mes clés</PrimaryButton>
          ) : (
            <p className="text-[0.875rem] text-muted">Clés prêtes. Si tu en régénères, il faudra refaire les étapes 2 et 3.</p>
          )}
        </Step>

        {keys && (
          <>
            <Step n={2} title="Préparer la base de données">
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-[0.9375rem]">
                <li>Dans Supabase, ouvre <strong>SQL Editor</strong>, puis <strong>New query</strong>.</li>
                <li>Colle le script ci-dessous et touche <strong>Run</strong>.</li>
              </ol>
              <CopyBlock label="Copier le script SQL" text={setupSql({ publicKey: keys.publicKey, functionUrl, cronSecret: keys.cronSecret })} />
            </Step>

            <Step n={3} title="Créer la fonction d’envoi">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.9375rem]">
                <li>Dans Supabase : <strong>Edge Functions → Deploy a new function</strong> (via l’éditeur).</li>
                <li>
                  Nom : <code className="rounded bg-field px-1.5 py-0.5">reminders</code>. Colle le code ci-dessous, puis <strong>Deploy</strong>.
                </li>
                <li>Dans les réglages de cette fonction, <strong>désactive la vérification JWT</strong> (« Verify JWT » ou « Enforce JWT verification »).</li>
                <li>
                  Ajoute ces 4 <strong>secrets</strong> (Edge Functions → Secrets) :
                </li>
              </ol>
              <CopyBlock label="Copier le code de la fonction" text={singleFileFunction()} />
              <div className="flex flex-col gap-2 rounded-2xl bg-field p-3">
                <Secret name="VAPID_PUBLIC_KEY" value={keys.publicKey} />
                <Secret name="VAPID_PRIVATE_KEY" value={keys.privateKey} />
                <Secret name="VAPID_SUBJECT" value={subject} />
                <Secret name="CRON_SECRET" value={keys.cronSecret} />
              </div>
            </Step>
          </>
        )}

        <Step n={keys ? 4 : 2} title="Vérifier" done={!!ok}>
          <p className="text-[0.9375rem] text-muted">L’app interroge ta fonction et te dit exactement ce qui manque.</p>
          <SecondaryButton onClick={() => void check()} disabled={busy}>
            {busy ? 'Vérification…' : 'Vérifier la configuration'}
          </SecondaryButton>
          {status === 'unreachable' && (
            <Notice bad>La fonction « reminders » ne répond pas. Vérifie qu’elle est bien déployée, qu’elle s’appelle exactement « reminders », et que la vérification JWT est désactivée.</Notice>
          )}
          {status && status !== 'unreachable' && (
            <ul className="flex flex-col gap-2.5">
              <Check ok label="Fonction joignable" />
              <Check ok={status.vapid} label="Clés VAPID présentes" hint="Ajoute VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les secrets de la fonction." />
              <Check ok={status.keyMatches} label="Clé publique identique dans la base" hint="La clé publique du secret ne correspond pas à celle du script SQL. Relance le script SQL et recopie les secrets de l’étape 3." />
              <Check ok={status.cron} label="Secret du planificateur présent" hint="Ajoute le secret CRON_SECRET." />
              <Check ok={status.subject} label="Adresse de contact (VAPID_SUBJECT)" hint="Ajoute le secret VAPID_SUBJECT (facultatif mais recommandé)." soft />
              <Check ok={status.table} label="Table des rappels" hint="Relance le script SQL de l’étape 2." />
            </ul>
          )}
          {ok && (
            <>
              <Notice>Tout est en place. Le serveur vérifiera toutes les 15 minutes qui doit être prévenu.</Notice>
              <PrimaryButton onClick={close} icon={<IconCheck size={20} />}>
                Activer sur ce téléphone
              </PrimaryButton>
            </>
          )}
        </Step>
      </Screen>
    </main>
  )
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-semibold ${done ? 'bg-good-soft text-good' : 'bg-ink text-white'}`}>{done ? '✓' : n}</span>
        <span className="text-[1.125rem] font-semibold">{title}</span>
      </div>
      {children}
    </Card>
  )
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copie ce texte :', text)
    }
  }
  return { copied, copy }
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const { copied, copy } = useCopy(text)
  return (
    <div className="flex flex-col gap-2">
      <SecondaryButton onClick={() => void copy()}>{copied ? 'Copié ✓' : label}</SecondaryButton>
      <details className="text-[0.8125rem]">
        <summary className="cursor-pointer py-1 text-muted">Voir le texte</summary>
        <pre className="mt-1 max-h-56 overflow-auto rounded-2xl bg-field p-3 text-[0.75rem] leading-snug whitespace-pre-wrap break-all">{text}</pre>
      </details>
    </div>
  )
}

function Secret({ name, value }: { name: string; value: string }) {
  const { copied, copy } = useCopy(value)
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-semibold">{name}</span>
        <span className="block truncate text-[0.75rem] text-muted">{value}</span>
      </span>
      <button type="button" onClick={() => void copy()} className="h-11 shrink-0 rounded-full bg-surface px-4 text-[0.875rem] font-medium">
        {copied ? 'Copié ✓' : 'Copier'}
      </button>
    </div>
  )
}

function Check({ ok, label, hint, soft }: { ok: boolean; label: string; hint?: string; soft?: boolean }) {
  return (
    <li className="flex gap-3 text-[0.9375rem]">
      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-bold ${ok ? 'bg-good-soft text-good' : soft ? 'bg-blue-soft text-ink' : 'bg-bad-soft text-bad'}`}>
        {ok ? '✓' : soft ? 'i' : '!'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">
          {label}
          <span className="sr-only"> : {ok ? 'bon' : soft ? 'information' : 'à corriger'}</span>
        </span>
        {!ok && hint && <span className="text-muted">{hint}</span>}
      </span>
    </li>
  )
}
