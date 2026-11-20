// Clés VAPID : l'identité du serveur qui envoie les notifications. Aucune dépendance (testé dans push.test.ts).

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function urlBase64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Génère une paire de clés VAPID (courbe P-256), au format attendu par la bibliothèque web-push. */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)) // 65 octets, commence par 0x04
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64url(pub), privateKey: jwk.d! }
}

/** Secret aléatoire lisible (lettres et chiffres, sans caractères ambigus). */
export function randomSecret(length = 32): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
