// Rappels de fin de journée : notifications Web Push.
//
// Principe : le téléphone s'abonne auprès du système de notifications (Apple, Google…), puis donne son
// « adresse d'abonnement » à Supabase. Toutes les 15 minutes, une fonction Supabase regarde qui doit être
// prévenu (jour travaillé, heure passée, rien saisi) et envoie la notification, app fermée.

import { supabase } from './cloud'

// ---------- Compatibilité ----------

export type PushSupport = { ok: true } | { ok: false; reason: 'unsupported' | 'needs-install' }

export const isIOS = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = (): boolean => window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Sur iPhone, les notifications ne marchent que pour une app ajoutée à l'écran d'accueil. */
export function pushSupport(): PushSupport {
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'needs-install' }
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return { ok: false, reason: 'unsupported' }
  return { ok: true }
}

// ---------- Préférences de cet appareil ----------

export interface PushPrefs {
  enabled: boolean
  /** Heure locale du rappel, « HH:MM ». */
  time: string
}

const PREFS_KEY = 'coffre-push:v1'
export const DEFAULT_TIME = '20:30'

export function loadPrefs(): PushPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<PushPrefs>
    return { enabled: p.enabled === true, time: typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : DEFAULT_TIME }
  } catch {
    return { enabled: false, time: DEFAULT_TIME }
  }
}

export function savePrefs(p: PushPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignoré */
  }
}

// Les clés VAPID (identité du serveur d'envoi) sont générées dans vapid.ts.
export { generateVapidKeys, randomSecret, urlBase64ToBytes } from './vapid'
import { urlBase64ToBytes } from './vapid'

// ---------- Abonnement ----------

const SETTINGS_TABLE = 'app_settings'
const REMINDERS_TABLE = 'reminders'
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'

/** La clé publique du serveur d'envoi, publiée dans la table app_settings par la configuration. */
export async function fetchPublicKey(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(SETTINGS_TABLE).select('value').eq('key', 'vapid_public').maybeSingle()
  return error || !data ? null : (data.value as string)
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('sw')), 5000))
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } catch {
    throw new Error('Le mode hors ligne n’est pas prêt. Ouvre l’app installée sur ton écran d’accueil, puis réessaie.')
  }
}

export type Result = { ok: true } | { ok: false; error: string }

async function subscribe(reg: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const key = urlBase64ToBytes(publicKey)
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    const current = existing.options?.applicationServerKey
    const same = current && new Uint8Array(current).length === key.length && new Uint8Array(current).every((b, i) => b === key[i])
    if (same) return existing
    await existing.unsubscribe() // les clés du serveur ont changé : il faut se réabonner
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
}

async function saveRow(userId: string, sub: PushSubscription, time: string): Promise<string | null> {
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return 'Abonnement incomplet.'
  const { error } = await supabase!.from(REMINDERS_TABLE).upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, remind_at: time, timezone: timezone(), created_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' })
  return error ? 'Impossible d’enregistrer le rappel sur ton compte. Vérifie la configuration (table « reminders »).' : null
}

/** Active les rappels sur cet appareil. À appeler depuis un appui (iPhone exige un geste de l'utilisateur). */
export async function enablePush(userId: string, time: string): Promise<Result> {
  const support = pushSupport()
  if (!support.ok) return { ok: false, error: support.reason === 'needs-install' ? 'Ajoute d’abord l’app à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-la depuis l’icône.' : 'Ce navigateur ne gère pas les notifications.' }
  if (!supabase) return { ok: false, error: 'La sauvegarde en ligne n’est pas activée.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'Les notifications sont refusées. Autorise-les dans les réglages de ton téléphone (Réglages → Notifications → Coffre).' }
  const publicKey = await fetchPublicKey()
  if (!publicKey) return { ok: false, error: 'Les rappels ne sont pas encore configurés sur ton compte Supabase. Touche « Configurer les rappels ».' }
  try {
    const sub = await subscribe(await registration(), publicKey)
    const err = await saveRow(userId, sub, time)
    if (err) return { ok: false, error: err }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.length > 0 && e.message.length < 160 && !/push service|subscribe/i.test(e.message) ? e.message : 'L’abonnement aux notifications a échoué. Réessaie depuis l’app installée.' }
  }
  savePrefs({ enabled: true, time })
  return { ok: true }
}

export async function updateTime(userId: string, time: string): Promise<Result> {
  savePrefs({ enabled: loadPrefs().enabled, time })
  if (!loadPrefs().enabled) return { ok: true }
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    if (!sub) return { ok: false, error: 'Abonnement introuvable : désactive puis réactive le rappel.' }
    const err = await saveRow(userId, sub, time)
    return err ? { ok: false, error: err } : { ok: true }
  } catch {
    return { ok: false, error: 'Impossible de changer l’heure pour le moment.' }
  }
}

/** Désactive les rappels de cet appareil (désabonnement + suppression de la ligne côté compte). */
export async function disablePush(userId: string | null): Promise<void> {
  savePrefs({ enabled: false, time: loadPrefs().time })
  try {
    const reg = await registration()
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      if (supabase && userId) await supabase.from(REMINDERS_TABLE).delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* hors ligne ou service worker absent : la ligne sera nettoyée par le serveur (abonnement expiré) */
  }
}

/** À l'ouverture de l'app : garde l'abonnement, l'heure et le fuseau à jour (voyage, abonnement renouvelé). */
export async function refreshSubscription(userId: string): Promise<void> {
  const prefs = loadPrefs()
  if (!prefs.enabled || !supabase || !pushSupport().ok || Notification.permission === 'denied') return
  try {
    const publicKey = await fetchPublicKey()
    if (!publicKey) return
    const sub = await subscribe(await registration(), publicKey)
    await saveRow(userId, sub, prefs.time)
  } catch {
    /* silencieux : on réessaiera à la prochaine ouverture */
  }
}

// ---------- Vérifications et tests ----------

export interface ServerStatus {
  ok: boolean
  vapid: boolean
  subject: boolean
  cron: boolean
  keyMatches: boolean
  table: boolean
}

/** Demande à la fonction Supabase si tout est en place. null = fonction injoignable. */
export async function pingServer(): Promise<ServerStatus | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('reminders', { body: { ping: true } })
  return error || !data ? null : (data as ServerStatus)
}

/** Fait envoyer une vraie notification de test à cet appareil par le serveur. */
export async function sendServerTest(): Promise<{ sent: number; failed: number } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke('reminders', { body: { test: true } })
  return error || !data ? null : (data as { sent: number; failed: number })
}

/** Affiche une notification locale (sans serveur) pour vérifier que le téléphone les autorise. */
export async function localTest(): Promise<boolean> {
  try {
    if (Notification.permission === 'denied') return false
    const reg = await registration()
    await reg.showNotification('Ta journée est finie ?', { body: 'Voilà à quoi ressemblera ton rappel.', icon: './icon-192.png', tag: 'test-local', data: { url: './#saisir' } })
    return true
  } catch {
    return false
  }
}

/** Pastille de nombre sur l'icône de l'app (jours à saisir). Sans effet là où ce n'est pas géré. */
export function setBadge(n: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (n > 0) void nav.setAppBadge?.(n)
    else void nav.clearAppBadge?.()
  } catch {
    /* ignoré */
  }
}
