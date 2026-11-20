// Calculs des graphiques : échelle « ronde » des axes et courbe lissée. Fonctions pures, testées dans charts.test.ts.

export interface Scale {
  /** Valeur maximale de l'axe (arrondie vers le haut sur un pas rond). */
  max: number
  step: number
  /** Graduations de 0 à max. */
  ticks: number[]
}

/**
 * Échelle ronde : des pas de 1, 2, 5 ou 10 × 10^n, pour que l'axe se lise d'un coup d'œil
 * (0, 500, 1 000, 1 500…). `integer` : pas entiers (nombre de clients).
 */
export function niceScale(maxValue: number, target = 4, integer = false): Scale {
  const max = maxValue > 0 && Number.isFinite(maxValue) ? maxValue : 1
  const raw = max / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  if (integer && step < 1) step = 1
  const niceMax = Math.max(step, Math.ceil(max / step - 1e-9) * step)
  const ticks: number[] = []
  for (let i = 0; i * step <= niceMax + step / 1000; i++) ticks.push(Math.round(i * step * 1e6) / 1e6)
  return { max: niceMax, step, ticks }
}

/**
 * Courbe lissée qui ne dépasse jamais les points (interpolation monotone de Fritsch–Butland) :
 * pas de « bosse » artificielle entre deux mois.
 */
export function smoothPath(pts: [number, number][]): string {
  const f = (n: number) => (Math.round(n * 100) / 100).toString()
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`
  if (n === 2) return `M${f(pts[0][0])} ${f(pts[0][1])} L${f(pts[1][0])} ${f(pts[1][1])}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    slope.push((pts[i + 1][1] - pts[i][1]) / dx[i])
  }
  const t: number[] = new Array(n)
  t[0] = slope[0]
  t[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) t[i] = 0
    else t[i] = (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i])
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = dx[i] / 3
    d += ` C${f(x0 + h)} ${f(y0 + t[i] * h)} ${f(x1 - h)} ${f(y1 - t[i + 1] * h)} ${f(x1)} ${f(y1)}`
  }
  return d
}

/** Quelles étiquettes de l'axe horizontal afficher pour qu'elles ne se chevauchent pas. */
export function labelIndexes(n: number, maxLabels: number): Set<number> {
  const out = new Set<number>()
  if (n <= 0) return out
  const step = Math.max(1, Math.ceil(n / maxLabels))
  // On part de la fin : le point le plus récent est toujours étiqueté.
  for (let i = n - 1; i >= 0; i -= step) out.add(i)
  return out
}

/** Entier avec espace fine comme séparateur de milliers : 12345 → « 12 345 ». */
export function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
