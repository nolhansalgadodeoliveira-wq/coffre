// Synchronisation automatique des données du compte connecté avec sa copie en ligne.
// L'app enregistre toujours d'abord sur l'appareil ; la copie en ligne suit quelques secondes après chaque
// modification, à l'ouverture de l'app et au retour du réseau. Sur un autre appareil, on retrouve tout.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from './accounts'
import { createStore, deleteRemoteCopy, supabase } from './cloud'
import { loadMeta, saveMeta } from './storage'
import { EMPTY_META, syncOnce, type SyncMeta, type SyncResult } from './sync'
import type { AppData } from './types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'relogin' | 'error'

const DEBOUNCE_MS = 1500
/** Au-delà, on considère qu'il n'y a pas de réseau (connexion très mauvaise) : rien n'est perdu, on réessaiera. */
const TIMEOUT_MS = 8000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('network timeout')), TIMEOUT_MS))])
}

export function useSync(account: Account, data: AppData, replaceData: (d: AppData) => void) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const metaRef = useRef<SyncMeta>(loadMeta())
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(metaRef.current.lastSyncAt)
  const [dirty, setDirty] = useState(metaRef.current.dirty)
  /** Premier téléchargement sur cet appareil (rien encore reçu du compte) : on attend avant d'afficher l'app. */
  const [firstPull, setFirstPull] = useState(metaRef.current.version === null)
  const dataRef = useRef(data)
  dataRef.current = data
  const running = useRef<Promise<void> | null>(null)
  const again = useRef(false)
  const runId = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fromCloud = useRef<AppData | null>(null)
  const firstRun = useRef(true)

  const setMeta = useCallback((m: SyncMeta) => {
    metaRef.current = m
    saveMeta(m)
    setLastSyncAt(m.lastSyncAt)
    setDirty(m.dirty)
  }, [])

  const apply = useCallback(
    (res: SyncResult) => {
      if (res.kind === 'pulled' || res.kind === 'merged') {
        fromCloud.current = res.data
        replaceData(res.data)
      }
      setMeta(res.meta)
      setError(null)
      setStatus('synced')
    },
    [replaceData, setMeta],
  )

  const sync = useCallback(async (): Promise<void> => {
    if (running.current) {
      again.current = true
      return running.current
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline')
      setFirstPull(false)
      return
    }
    setStatus('syncing')
    const id = ++runId.current
    running.current = (async () => {
      try {
        const { data: s } = await withTimeout(supabase.auth.getSession())
        if (id !== runId.current) return
        if (!s.session || s.session.user.id !== account.id) {
          setStatus('relogin')
          return
        }
        const res = await withTimeout(syncOnce(dataRef.current, metaRef.current, createStore(account.id), account.id, new Date().toISOString()))
        // Passe abandonnée (le réseau est revenu entre-temps et une nouvelle passe a démarré) : son résultat est ignoré.
        if (id === runId.current) apply(res)
      } catch (e) {
        if (id !== runId.current) return
        const msg = e instanceof Error ? e.message : ''
        const offline = /fetch|network|failed|load failed/i.test(msg)
        setStatus(offline ? 'offline' : 'error')
        setError(offline ? null : msg === 'conflit' ? 'Un autre appareil modifie tes données en même temps. Réessaie dans un instant.' : 'La synchronisation a échoué. Tes données restent sur cet appareil.')
      } finally {
        setFirstPull(false)
      }
    })()
    const mine = running.current
    await mine
    if (running.current === mine) running.current = null
    if (again.current) {
      again.current = false
      await sync()
    }
  }, [account.id, apply])

  // Au lancement : récupère ce qui a changé ailleurs.
  useEffect(() => {
    void sync()
    // Délai de sécurité : sans réponse du serveur, on n'attend pas plus de 6 secondes pour afficher l'app.
    const t = setTimeout(() => setFirstPull(false), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chaque modification : marquée « à envoyer », puis envoyée peu après.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (data === fromCloud.current) {
      fromCloud.current = null
      return
    }
    setMeta({ ...metaRef.current, dirty: true })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void sync(), DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Reprise de l'app, passage en arrière-plan et retour du réseau.
  useEffect(() => {
    const onVisible = () => void sync()
    // Retour du réseau : une passe bloquée pendant la coupure est abandonnée, on repart tout de suite.
    const onOnline = () => {
      runId.current++
      running.current = null
      again.current = false
      void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [sync])

  /** Envoie ce qui attend. Renvoie false s'il reste des modifications non envoyées (pas de réseau). */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    if (metaRef.current.dirty) await sync()
    return !metaRef.current.dirty
  }, [sync])

  const deleteOnline = useCallback(async (): Promise<string | null> => {
    const err = await deleteRemoteCopy(account.id)
    if (!err) setMeta({ ...EMPTY_META })
    return err
  }, [account.id, setMeta])

  return { status, error, lastSyncAt, dirty, firstPull, syncNow: sync, flush, deleteOnline }
}

export type Sync = ReturnType<typeof useSync>
