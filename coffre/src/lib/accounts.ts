// Comptes sur l'appareil : e-mail + mot de passe, connexion mémorisée.
//
// Important : tout reste sur ce téléphone (aucun serveur). Un compte sert à :
//  - protéger l'accès à l'app par mot de passe,
//  - séparer les données de plusieurs personnes qui utilisent le même appareil,
//  - mémoriser la connexion pour ne pas la retaper à chaque ouverture.
// Les comptes ne sont PAS partagés entre appareils : pour changer de téléphone, on utilise le fichier de sauvegarde.
// Le mot de passe n'est jamais enregistré : seulement une empreinte (PBKDF2-SHA256, 150 000 tours, sel aléatoire).

export interface Account {
  id: string
  email: string
  salt: string
  hash: string
  createdAt: string
  /**
   * Préfixe des clés de stockage de ce compte. Vide pour le tout premier compte : il reprend les données
   * déjà présentes sur le téléphone (avant l'arrivée des comptes), rien n'est perdu.
   */
  ns: string
}

const ACCOUNTS_KEY = 'coffre-comptes:v1'
const SESSION_KEY = 'coffre-session:v1'
const ITERATIONS = 150_000
export const MIN_PASSWORD = 6

export const normEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export function listAccounts(): Account[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') as Account[]
    return Array.isArray(raw) ? raw.filter((a) => a && typeof a.id === 'string' && typeof a.email === 'string' && typeof a.hash === 'string') : []
  } catch {
    return []
  }
}
function saveAccounts(list: Account[]): boolean {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

const toHex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b instanceof Uint8Array ? b : b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)))

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('crypto')
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return toHex(bits)
}

/** Comparaison en temps constant. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export type AuthResult = { ok: true; account: Account } | { ok: false; error: string }

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  if (!validEmail(email)) return { ok: false, error: 'Cette adresse e-mail n’est pas valide.' }
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.` }
  const list = listAccounts()
  if (list.some((a) => a.email === normEmail(email))) return { ok: false, error: 'Un compte existe déjà avec cet e-mail. Connecte-toi.' }
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const id = toHex(crypto.getRandomValues(new Uint8Array(8)))
    const account: Account = { id, email: normEmail(email), salt: toHex(salt), hash: await derive(password, salt), createdAt: new Date().toISOString(), ns: list.length === 0 ? '' : id }
    if (!saveAccounts([...list, account])) return { ok: false, error: 'Cet appareil refuse l’enregistrement (navigation privée ou stockage plein).' }
    return { ok: true, account }
  } catch {
    return { ok: false, error: 'Ce navigateur ne permet pas de protéger un mot de passe. Ouvre l’app depuis son adresse https.' }
  }
}

export async function checkPassword(email: string, password: string): Promise<AuthResult> {
  const a = listAccounts().find((x) => x.email === normEmail(email))
  try {
    // Même durée de calcul que le compte existe ou non (on ne révèle pas quels e-mails existent).
    const h = await derive(password, a ? fromHex(a.salt) : new Uint8Array(16))
    if (a && same(h, a.hash)) return { ok: true, account: a }
  } catch {
    return { ok: false, error: 'Ce navigateur ne permet pas de vérifier un mot de passe. Ouvre l’app depuis son adresse https.' }
  }
  return { ok: false, error: 'E-mail ou mot de passe incorrect.' }
}

export async function changePassword(id: string, oldPassword: string, newPassword: string): Promise<string | null> {
  const list = listAccounts()
  const a = list.find((x) => x.id === id)
  if (!a) return 'Compte introuvable.'
  if (newPassword.length < MIN_PASSWORD) return `Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`
  const r = await checkPassword(a.email, oldPassword)
  if (!r.ok) return 'Le mot de passe actuel est incorrect.'
  const salt = crypto.getRandomValues(new Uint8Array(16))
  a.salt = toHex(salt)
  a.hash = await derive(newPassword, salt)
  return saveAccounts(list) ? null : 'Impossible d’enregistrer le nouveau mot de passe.'
}

/** Supprime le compte et TOUTES ses données sur cet appareil (clés commençant par le préfixe du compte). */
export function deleteAccount(id: string): void {
  const list = listAccounts()
  const a = list.find((x) => x.id === id)
  if (!a) return
  saveAccounts(list.filter((x) => x.id !== id))
  try {
    const dead: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (a.ns ? k.endsWith('@' + a.ns) : /^(caisse-weekend|coffre-copies|coffre-derniere-sauvegarde|coffre-compliments):v1$/.test(k)) dead.push(k)
    }
    dead.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignoré */
  }
  endSession()
}

// ---- Session mémorisée ----
// « Rester connecté » : l'identifiant du compte est gardé sur l'appareil (localStorage) tant qu'on ne se déconnecte pas.
// Sans : il n'est gardé que pour la session du navigateur (sessionStorage).

export function startSession(id: string, remember: boolean): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id)
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
export function currentAccount(): Account | null {
  try {
    const id = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    return (id && listAccounts().find((a) => a.id === id)) || null
  } catch {
    return null
  }
}
export const rememberedEmail = (): string => {
  try {
    return localStorage.getItem('coffre-email:v1') ?? ''
  } catch {
    return ''
  }
}
export function rememberEmail(email: string): void {
  try {
    localStorage.setItem('coffre-email:v1', normEmail(email))
  } catch {
    /* ignoré */
  }
}
