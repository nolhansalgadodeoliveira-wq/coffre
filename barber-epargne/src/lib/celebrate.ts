// Célébration d'une progression : l'accueil compare ce qu'il affiche à ce qu'il affichait la dernière fois
// (gardé sur l'appareil, par compte) et anime la différence : compteur qui monte, barres qui avancent, « +X € ».

import { useEffect, useRef, useState } from 'react'
import { scoped } from './storage'

export interface ProgressSnapshot {
  month: string
  /** Déjà de côté (centimes). */
  available: number
  /** Déjà de côté par objectif. */
  goals: Record<string, number>
  /** Dépenses perso du mois déjà couvertes. */
  covered: number
}

export interface Celebration {
  kind: 'saved' | 'covered'
  /** Gain affiché (centimes). */
  gain: number
  from: ProgressSnapshot
}

const KEY = 'coffre-progression:v1'

function readSnapshot(): ProgressSnapshot | null {
  try {
    const s = JSON.parse(localStorage.getItem(scoped(KEY)) || 'null') as ProgressSnapshot | null
    return s && typeof s.available === 'number' ? s : null
  } catch {
    return null
  }
}
function writeSnapshot(s: ProgressSnapshot): void {
  try {
    localStorage.setItem(scoped(KEY), JSON.stringify(s))
  } catch {
    /* ignoré */
  }
}

/**
 * Compare l'état actuel au dernier affiché. Renvoie une célébration si l'épargne a augmenté
 * (ou, sinon, si les dépenses du mois sont mieux couvertes), puis mémorise l'état actuel.
 */
export function useCelebration(now: ProgressSnapshot): Celebration | null {
  const [celebration] = useState<Celebration | null>(() => {
    const prev = readSnapshot()
    if (!prev) return null
    if (now.available > prev.available) return { kind: 'saved', gain: now.available - prev.available, from: prev }
    if (prev.month === now.month && now.covered > prev.covered) return { kind: 'covered', gain: now.covered - prev.covered, from: prev }
    return null
  })
  const key = JSON.stringify(now)
  useEffect(() => {
    writeSnapshot(now)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return celebration
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Nombre qui monte de `from` à `to` (après `delay` ms), en ralentissant à la fin. */
export function useCountUp(to: number, from: number | null, delay = 500, duration = 1300): number {
  const [value, setValue] = useState(from ?? to)
  const raf = useRef(0)
  useEffect(() => {
    if (from === null || from === to || reduced()) {
      setValue(to)
      return
    }
    let start = 0
    const tick = (t: number) => {
      if (!start) start = t
      const k = Math.min(1, Math.max(0, (t - start - delay) / duration))
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (k < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [to, from, delay, duration])
  return value
}

/** Valeur qui vaut `from` au premier affichage puis `to` juste après (pour animer une barre en CSS). */
export function useGrow<T>(to: T, from: T | null, delay = 450): T {
  const [value, setValue] = useState<T>(from ?? to)
  useEffect(() => {
    if (from === null) {
      setValue(to)
      return
    }
    const t = setTimeout(() => setValue(to), reduced() ? 0 : delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(to)])
  return value
}
