// Comptes en ligne (Supabase) : e-mail + mot de passe, et copie des données de chaque compte.
// Le projet est intégré à l'app : l'adresse et la clé « publishable » sont faites pour être publiques,
// la sécurité vient des règles de la base (chacun ne lit et n'écrit que sa propre ligne).
// Ne jamais mettre ici le mot de passe de la base ni une clé secrète / service_role.

import { createClient } from '@supabase/supabase-js'
import { parseData } from './storage'
import type { CloudStore, RemoteDoc } from './sync'
import type { AppData } from './types'

const URL = 'https://tbstvayobvtngfwqgeah.supabase.co'
const KEY = 'sb_publishable_Md6Efa6epbiGFqKo3cc2Pg_hzoknu76'

const REMEMBER_KEY = 'coffre-rester-connecte:v1'
export function setRemember(on: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? '1' : '0')
  } catch {
    /* ignoré */
  }
}
const remember = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0'
  } catch {
    return true
  }
}

/** Session gardée sur l'appareil (« rester connecté ») ou seulement le temps de la session du navigateur. */
const authStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k) ?? sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k: string, v: string) => {
    try {
      if (remember()) {
        localStorage.setItem(k, v)
        sessionStorage.removeItem(k)
      } else {
        sessionStorage.setItem(k, v)
        localStorage.removeItem(k)
      }
    } catch {
      /* ignoré */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    } catch {
      /* ignoré */
    }
  },
}

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: authStorage, storageKey: 'coffre-auth:v1' },
})

export function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.'
  if (m.includes('already registered') || m.includes('already exists')) return 'Un compte existe déjà avec cet e-mail. Connecte-toi.'
  if (m.includes('password') && (m.includes('least') || m.includes('weak') || m.includes('short'))) return 'Mot de passe trop court : 6 caractères minimum.'
  if (m.includes('same password') || (m.includes('password') && m.includes('different'))) return 'Choisis un mot de passe différent de l’actuel.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Attends une minute puis réessaie.'
  if (m.includes('email not confirmed')) return 'Ce compte attend une confirmation par e-mail (réglage du projet).'
  if (m.includes('signups not allowed')) return 'La création de compte est désactivée pour le moment.'
  if (m.includes('invalid') && m.includes('email')) return 'Cette adresse e-mail n’est pas valide.'
  if (m.includes('fetch') || m.includes('network') || m.includes('failed')) return 'Pas de connexion internet. Réessaie quand tu as du réseau.'
  return 'Impossible de te connecter pour le moment. Réessaie dans un instant.'
}

const TABLE = 'user_data'

/** La copie en ligne d'un compte : une ligne par utilisateur, protégée côté serveur (RLS). */
export function createStore(userId: string): CloudStore {
  return {
    async load(): Promise<RemoteDoc | null> {
      const { data, error } = await supabase.from(TABLE).select('data, version, updated_at').eq('user_id', userId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const parsed: AppData | null = parseData(data.data)
      if (!parsed) throw new Error('Les données en ligne sont illisibles.')
      return { data: parsed, version: data.version as number, updatedAt: data.updated_at as string }
    },
    async save(d: AppData, expectedVersion: number | null): Promise<number | null> {
      if (expectedVersion === null) {
        const { error } = await supabase.from(TABLE).insert({ user_id: userId, data: d, version: 1 })
        if (error) {
          if (error.code === '23505') return null
          throw new Error(error.message)
        }
        return 1
      }
      const { data, error } = await supabase
        .from(TABLE)
        .update({ data: d, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('version', expectedVersion)
        .select('version')
      if (error) throw new Error(error.message)
      return data && data.length > 0 ? expectedVersion + 1 : null
    },
  }
}

export async function deleteRemoteCopy(userId: string): Promise<string | null> {
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId)
  return error ? 'Impossible de supprimer la copie en ligne pour le moment. Réessaie.' : null
}
