// Comptes : e-mail + mot de passe, enregistrés en ligne (Supabase). Le même compte retrouve ses données sur
// n'importe quel appareil. La connexion est mémorisée sur l'appareil (« rester connecté »).
//
// Les données sont aussi gardées sur l'appareil (l'app marche sans réseau), rangées par compte :
// plusieurs personnes peuvent utiliser le même téléphone sans voir les données des autres.
//
// Les anciens comptes « sur l'appareil seulement » (version précédente) sont repris automatiquement :
// à la première connexion avec le même e-mail et le même mot de passe, le compte est créé en ligne
// et ses données y sont envoyées.

import { friendlyError, setRemember, supabase } from './cloud'

export interface Account {
  id: string
  email: string
  /** Préfixe des clés de stockage de ce compte sur l'appareil. */
  ns: string
}

const SESSION_KEY = 'coffre-session:v1'
const LOCAL_ACCOUNTS_KEY = 'coffre-comptes:v1'
const LEGACY_CLAIMED_KEY = 'coffre-donnees-reprises:v1'
const ITERATIONS = 150_000
export const MIN_PASSWORD = 6

export const normEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

/**
 * `code` : 'exists' = un compte en ligne existe déjà avec cet e-mail mais ce mot de passe ne l'ouvre pas ;
 * 'wrong' = e-mail ou mot de passe incorrect. L'écran propose alors « Mot de passe oublié ? ».
 */
export type AuthResult = { ok: true; account: Account } | { ok: false; error: string; code?: 'exists' | 'wrong' }

const EXISTS_MSG = 'Un compte existe déjà avec cet e-mail, mais pas avec ce mot de passe. Si c’est le tien, touche « Mot de passe oublié ? » : tu recevras un code pour en choisir un nouveau, et tes données seront gardées.'
const WRONG_MSG = 'E-mail ou mot de passe incorrect.'

// ---- Session mémorisée sur l'appareil ----

export function currentAccount(): Account | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as Partial<Account>
    return typeof a.id === 'string' && typeof a.email === 'string' ? { id: a.id, email: a.email, ns: typeof a.ns === 'string' ? a.ns : a.id } : null
  } catch {
    return null
  }
}

function startSession(a: Account, remember: boolean): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(a))
    localStorage.setItem('coffre-email:v1', a.email)
  } catch {
    /* ignoré */
  }
}

export function endSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignoré */
  }
}

export const rememberedEmail = (): string => {
  try {
    return localStorage.getItem('coffre-email:v1') ?? ''
  } catch {
    return ''
  }
}

// ---- Données déjà présentes sur l'appareil ----

/** Copie les données d'un ancien espace de stockage (préfixe `from`) vers celui du compte, si le compte n'a encore rien ici. */
function adoptLocalData(fromNs: string, toNs: string): void {
  try {
    const suffix = (ns: string) => (ns ? `@${ns}` : '')
    const target = 'caisse-weekend:v1' + suffix(toNs)
    if (localStorage.getItem(target)) return
    for (const base of ['caisse-weekend:v1', 'coffre-copies:v1', 'coffre-derniere-sauvegarde:v1', 'coffre-compliments:v1']) {
      const v = localStorage.getItem(base + suffix(fromNs))
      if (v !== null && localStorage.getItem(base + suffix(toNs)) === null) localStorage.setItem(base + suffix(toNs), v)
    }
  } catch {
    /* ignoré */
  }
}

/**
 * Données créées avant les comptes en ligne (sans préfixe) : reprises une seule fois, par le premier compte
 * qui se connecte sur cet appareil. Elles sont fusionnées avec celles du compte en ligne à la synchronisation.
 */
function claimLegacyData(ns: string): void {
  try {
    if (localStorage.getItem(LEGACY_CLAIMED_KEY)) return
    if (localStorage.getItem('caisse-weekend:v1')) adoptLocalData('', ns)
    localStorage.setItem(LEGACY_CLAIMED_KEY, ns)
  } catch {
    /* ignoré */
  }
}

// ---- Anciens comptes « sur l'appareil seulement » ----

interface LocalAccount {
  id: string
  email: string
  salt: string
  hash: string
  ns: string
}

function localAccounts(): LocalAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]') as LocalAccount[]
    return Array.isArray(raw) ? raw.filter((a) => a && typeof a.email === 'string' && typeof a.hash === 'string') : []
  } catch {
    return []
  }
}

const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)))

async function localPasswordOk(a: LocalAccount, password: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(a.salt) as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
    return toHex(bits) === a.hash
  } catch {
    return false
  }
}

// ---- Connexion, création de compte ----

function finish(id: string, email: string, remember: boolean): Account {
  const account: Account = { id, email: normEmail(email), ns: id }
  claimLegacyData(account.ns)
  // Ancien compte « sur l'appareil » avec le même e-mail : ses données sont reprises par le compte en ligne.
  const local = localAccounts().find((a) => a.email === account.email)
  if (local) adoptLocalData(local.ns, account.ns)
  startSession(account, remember)
  return account
}

export async function createAccount(email: string, password: string, remember = true): Promise<AuthResult> {
  if (!validEmail(email)) return { ok: false, error: 'Cette adresse e-mail n’est pas valide.' }
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.` }
  setRemember(remember)
  const { data, error } = await supabase.auth.signUp({ email: normEmail(email), password })
  const duplicate = (error && /already (registered|exists)/i.test(error.message)) || (!error && data.user && (data.user.identities?.length ?? 1) === 0)
  if (duplicate) {
    // Le compte existe déjà : si c'est le même mot de passe, on se connecte simplement (pas d'erreur inutile).
    const login = await supabase.auth.signInWithPassword({ email: normEmail(email), password })
    if (!login.error && login.data.user) return { ok: true, account: finish(login.data.user.id, email, remember) }
    return { ok: false, error: EXISTS_MSG, code: 'exists' }
  }
  if (error) return { ok: false, error: friendlyError(error.message) }
  if (!data.session || !data.user) return { ok: false, error: 'Le compte est créé mais demande une confirmation par e-mail (réglage du projet).' }
  return { ok: true, account: finish(data.user.id, email, remember) }
}

export async function signIn(email: string, password: string, remember = true): Promise<AuthResult> {
  if (!validEmail(email)) return { ok: false, error: 'Cette adresse e-mail n’est pas valide.' }
  setRemember(remember)
  const { data, error } = await supabase.auth.signInWithPassword({ email: normEmail(email), password })
  if (!error && data.user) return { ok: true, account: finish(data.user.id, email, remember) }
  const msg = error?.message ?? ''
  if (!/invalid login credentials/i.test(msg)) return { ok: false, error: friendlyError(msg) }

  // Ancien compte de cet appareil (version précédente), pas encore en ligne : on le crée en ligne avec le même mot de passe.
  const local = localAccounts().find((a) => a.email === normEmail(email))
  if (local && (await localPasswordOk(local, password))) {
    const r = await createAccount(email, password, remember)
    // Un compte en ligne existe déjà avec un autre mot de passe : on ne dit pas « compte existant » à quelqu'un qui se connecte,
    // on explique et on propose le code par e-mail (ses données de ce téléphone seront reprises ensuite).
    if (!r.ok && r.code === 'exists') {
      return { ok: false, code: 'exists', error: 'Ton compte existe déjà en ligne avec un autre mot de passe (créé avant la mise à jour). Touche « Mot de passe oublié ? » : un code t’est envoyé par e-mail, et tes données de ce téléphone sont gardées.' }
    }
    return r
  }
  return { ok: false, error: WRONG_MSG, code: 'wrong' }
}

export async function changePassword(email: string, oldPassword: string, newPassword: string): Promise<string | null> {
  if (newPassword.length < MIN_PASSWORD) return `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`
  const check = await supabase.auth.signInWithPassword({ email, password: oldPassword })
  if (check.error) return /invalid login/i.test(check.error.message) ? 'Le mot de passe actuel est incorrect.' : friendlyError(check.error.message)
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return error ? friendlyError(error.message) : null
}

export async function signOutEverywhere(): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch {
    /* hors ligne : la session locale est quand même fermée */
  }
  endSession()
}

/** Efface les données de ce compte sur cet appareil. */
export function clearLocalData(ns: string): void {
  try {
    const dead: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.endsWith('@' + ns)) dead.push(k)
    }
    dead.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignoré */
  }
}

// ---- Mot de passe oublié : un code à 6 chiffres est envoyé par e-mail ----
// (un code plutôt qu'un lien : il marche aussi depuis l'icône de l'écran d'accueil de l'iPhone).

export async function requestPasswordReset(email: string): Promise<string | null> {
  if (!validEmail(email)) return 'Cette adresse e-mail n’est pas valide.'
  const { error } = await supabase.auth.resetPasswordForEmail(normEmail(email))
  if (!error) return null
  const m = error.message.toLowerCase()
  if (m.includes('rate limit') || m.includes('seconds')) return 'Un e-mail vient déjà d’être envoyé. Attends une minute avant de redemander.'
  if (m.includes('not authorized') || m.includes('not allowed') || m.includes('smtp') || m.includes('sending')) return 'L’e-mail n’a pas pu être envoyé pour le moment. Réessaie plus tard.'
  return friendlyError(error.message)
}

export async function resetPassword(email: string, code: string, newPassword: string, remember = true): Promise<AuthResult> {
  const token = code.replace(/\s/g, '')
  if (!/^\d{6,8}$/.test(token)) return { ok: false, error: 'Saisis le code à 6 chiffres reçu par e-mail.' }
  if (newPassword.length < MIN_PASSWORD) return { ok: false, error: `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.` }
  setRemember(remember)
  const { data, error } = await supabase.auth.verifyOtp({ email: normEmail(email), token, type: 'recovery' })
  if (error || !data.user) return { ok: false, error: error && /expired|invalid|token/i.test(error.message) ? 'Code incorrect ou expiré. Demande un nouveau code.' : friendlyError(error?.message ?? '') }
  const up = await supabase.auth.updateUser({ password: newPassword })
  if (up.error) return { ok: false, error: friendlyError(up.error.message) }
  return { ok: true, account: finish(data.user.id, email, remember) }
}
