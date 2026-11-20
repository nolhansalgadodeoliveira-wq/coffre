// Verrou de l'app : Face ID / Touch ID (via les « passkeys » du téléphone, WebAuthn) et un code à 4 chiffres en secours.
//
// Ce verrou protège l'OUVERTURE de l'app sur ce téléphone (quelqu'un à qui tu prêtes ton téléphone).
// Le code n'est jamais enregistré : seulement une empreinte (PBKDF2-SHA256 + sel).
// Les réglages du verrou sont propres à chaque compte et à chaque appareil.

import { scoped } from './storage'

const KEY = 'coffre-verrou:v1'
const ITERATIONS = 100_000
/** Après ce temps en arrière-plan, l'app se reverrouille. */
export const RELOCK_AFTER_MS = 60_000

export interface LockConfig {
  /** Empreinte du code de secours. */
  salt: string
  hash: string
  /** Identifiant de la clé Face ID / Touch ID (base64url), si activée. */
  credentialId?: string
}

const toHex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b instanceof Uint8Array ? b : b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)))
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))

export function loadLock(): LockConfig | null {
  try {
    const raw = JSON.parse(localStorage.getItem(scoped(KEY)) || 'null') as LockConfig | null
    return raw && typeof raw.hash === 'string' && typeof raw.salt === 'string' ? raw : null
  } catch {
    return null
  }
}

function saveLock(c: LockConfig | null): void {
  try {
    if (c) localStorage.setItem(scoped(KEY), JSON.stringify(c))
    else localStorage.removeItem(scoped(KEY))
  } catch {
    /* ignoré */
  }
}

async function digest(code: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'])
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256))
}

export const validCode = (c: string) => /^\d{4}$/.test(c)

/** Active le verrou avec un code à 4 chiffres (garde Face ID s'il était déjà activé). */
export async function setCode(code: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prev = loadLock()
  saveLock({ salt: toHex(salt), hash: await digest(code, salt), ...(prev?.credentialId ? { credentialId: prev.credentialId } : {}) })
}

export async function checkCode(code: string): Promise<boolean> {
  const c = loadLock()
  if (!c) return true
  const h = await digest(code, fromHex(c.salt))
  if (h.length !== c.hash.length) return false
  let d = 0
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ c.hash.charCodeAt(i)
  return d === 0
}

export function removeLock(): void {
  saveLock(null)
}

/** Face ID / Touch ID / empreinte disponible sur cet appareil ? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    const P = window.PublicKeyCredential as (typeof PublicKeyCredential & { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }) | undefined
    return Boolean(P && (await P.isUserVerifyingPlatformAuthenticatorAvailable?.()))
  } catch {
    return false
  }
}

/** Crée la clé Face ID de l'app sur ce téléphone (le téléphone demande Face ID). À appeler depuis un toucher. */
export async function enableBiometric(email: string): Promise<string | null> {
  const c = loadLock()
  if (!c) return 'Choisis d’abord un code de secours.'
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Coffre', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: email, displayName: `Coffre · ${email}` },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    if (!cred) return 'Face ID n’a pas pu être activé.'
    saveLock({ ...c, credentialId: b64u(cred.rawId) })
    return null
  } catch (e) {
    return e instanceof DOMException && e.name === 'NotAllowedError' ? 'Activation annulée.' : 'Face ID n’est pas disponible ici. Le code reste actif.'
  }
}

export function disableBiometric(): void {
  const c = loadLock()
  if (c) saveLock({ salt: c.salt, hash: c.hash })
}

/** Demande Face ID / Touch ID. À appeler depuis un toucher (exigence du téléphone). */
export async function unlockWithBiometric(): Promise<boolean> {
  const c = loadLock()
  if (!c?.credentialId) return false
  try {
    const r = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64u(c.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return r !== null
  } catch {
    return false
  }
}
