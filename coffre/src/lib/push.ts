// Rappel dans l'app (sans serveur) : heure après laquelle une journée non saisie est signalée,
// et pastille sur l'icône de l'app.

export interface PushPrefs {
  time: string
}

const PREFS_KEY = 'coffre-push:v1'
export const DEFAULT_TIME = '20:30'

export function loadPrefs(): PushPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<PushPrefs>
    return { time: typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : DEFAULT_TIME }
  } catch {
    return { time: DEFAULT_TIME }
  }
}

export function savePrefs(p: PushPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignoré */
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
