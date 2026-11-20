// Graphiques faits main (SVG) : axes gradués avec unités, grille, courbe lissée, sélection au toucher.
// Les valeurs sont en centimes pour l'unité « eur », en nombre pour l'unité « count ».

import { useId, useState, type ReactNode } from 'react'
import { groupThousands, labelIndexes, niceScale, smoothPath } from './lib/charts'
import { formatEuros } from './lib/money'

export interface ChartPoint {
  key: string
  /** Étiquette sous l'axe horizontal (« oct », « 12/10 »). */
  label: string
  value: number
  /** Texte complet affiché à la sélection (« Octobre 2026 »). */
  title: string
}

interface Common {
  points: ChartPoint[]
  unit: 'eur' | 'count'
  /** Titre de l'axe vertical, avec son unité (« Ta part (€) »). */
  yTitle: string
  /** Titre de l'axe horizontal (« Mois »). */
  xTitle: string
  /** Couleur de la courbe ou des barres (variable CSS). */
  color?: string
  /** Nom court de ce que mesure le graphique, pour la lecture à voix haute. */
  summary: string
  /** Mot après la valeur d'un compteur (« clients »). */
  countWord?: string
  height?: number
  defaultKey?: string
  /** Ligne pointillée horizontale (objectif, moyenne). */
  line?: { value: number; label: string; color?: string }
}

const W = 320
const toDisplay = (unit: 'eur' | 'count', v: number) => (unit === 'eur' ? v / 100 : v)
const fmtTick = (unit: 'eur' | 'count', v: number) => (unit === 'eur' ? `${groupThousands(v)} €` : groupThousands(v))

function fmtValue(unit: 'eur' | 'count', v: number, word?: string) {
  if (unit === 'eur') return formatEuros(v)
  return `${groupThousands(v)}${word ? ` ${word}` : ''}`
}

function useGeometry(c: Common) {
  const H = c.height ?? 230
  const left = c.unit === 'eur' ? 58 : 34
  const M = { l: left, r: 14, t: 26, b: 48 }
  const plotW = W - M.l - M.r
  const plotH = H - M.t - M.b
  const maxVal = Math.max(...c.points.map((p) => toDisplay(c.unit, p.value)), c.line ? toDisplay(c.unit, c.line.value) : 0)
  const scale = niceScale(maxVal * 1.05, 4, c.unit === 'count')
  const y = (v: number) => M.t + plotH * (1 - toDisplay(c.unit, v) / scale.max)
  const yTick = (t: number) => M.t + plotH * (1 - t / scale.max)
  return { H, M, plotW, plotH, scale, y, yTick }
}

function Axes({ c, g, xLabels }: { c: Common; g: ReturnType<typeof useGeometry>; xLabels: { x: number; text: string; bold?: boolean }[] }) {
  const { H, M, plotW, scale, yTick } = g
  const txt = { fontSize: 11, fill: 'var(--muted)', fontVariantNumeric: 'tabular-nums' as const }
  return (
    <>
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={M.l + plotW} y1={yTick(t)} y2={yTick(t)} stroke={t === 0 ? 'var(--ink)' : 'var(--line)'} strokeOpacity={t === 0 ? 0.35 : 1} strokeWidth={1} />
          <text x={M.l - 8} y={yTick(t)} textAnchor="end" dominantBaseline="middle" {...txt}>
            {fmtTick(c.unit, t)}
          </text>
        </g>
      ))}
      <text x={0} y={11} {...txt} fontWeight={600}>
        {c.yTitle}
      </text>
      {xLabels.map((l) => (
        <text key={l.x} x={l.x} y={H - M.b + 17} textAnchor="middle" {...txt} fontWeight={l.bold ? 700 : 400} fill={l.bold ? 'var(--ink)' : 'var(--muted)'}>
          {l.text}
        </text>
      ))}
      <text x={M.l + plotW / 2} y={H - 6} textAnchor="middle" {...txt} fontWeight={600}>
        {c.xTitle}
      </text>
    </>
  )
}

function DataTable({ c }: { c: Common }) {
  return (
    <details className="text-[0.875rem]">
      <summary className="cursor-pointer py-1 text-muted">Voir les chiffres</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{c.summary}</caption>
        <tbody className="divide-y divide-line">
          {[...c.points].reverse().map((p) => (
            <tr key={p.key}>
              <th scope="row" className="py-2 text-left font-normal text-muted">
                {p.title}
              </th>
              <td className="num py-2 text-right font-semibold">{fmtValue(c.unit, p.value, c.countWord)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/** Légende de la ligne pointillée (objectif, moyenne), sous le graphique. */
function Legend({ c }: { c: Common }) {
  if (!c.line) return null
  const color = c.line.color ?? 'var(--orange-deep)'
  return (
    <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
      <svg width="26" height="6" aria-hidden="true">
        <line x1="0" x2="26" y1="3" y2="3" stroke={color} strokeWidth="2" strokeDasharray="5 4" />
      </svg>
      <span>
        {c.line.label} : <strong className="num text-ink">{fmtValue(c.unit, c.line.value)}</strong>
      </span>
    </p>
  )
}

function Readout({ title, value }: { title: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-[0.875rem]" aria-live="polite">
      <span className="min-w-0 text-muted">{title}</span>
      <span className="num shrink-0 text-[1.125rem] font-semibold">{value}</span>
    </p>
  )
}

/** Courbe lissée avec aire, axes gradués et sélection d'un point au toucher. */
export function LineChart(c: Common): ReactNode {
  const id = useId().replace(/:/g, '')
  const g = useGeometry(c)
  const { H, M, plotW, plotH, y } = g
  const n = c.points.length
  const [sel, setSel] = useState<string | null>(c.defaultKey ?? null)
  const color = c.color ?? 'var(--violet-deep)'
  const padX = 10
  const x = (i: number) => (n === 1 ? M.l + plotW / 2 : M.l + padX + (i * (plotW - 2 * padX)) / (n - 1))
  const idx = Math.max(0, c.points.findIndex((p) => p.key === sel))
  const cur = c.points[sel === null ? n - 1 : idx]
  const curI = sel === null ? n - 1 : idx
  const pts = c.points.map((p, i) => [x(i), y(p.value)] as [number, number])
  const line = smoothPath(pts)
  const area = n > 1 ? `${line} L${x(n - 1)} ${M.t + plotH} L${x(0)} ${M.t + plotH} Z` : ''
  const show = labelIndexes(n, 7)
  const xLabels = c.points.map((p, i) => ({ x: x(i), text: p.label, bold: i === curI })).filter((_, i) => show.has(i))
  const band = n > 1 ? (plotW - 2 * padX) / (n - 1) : plotW

  if (n === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Readout title={cur.title} value={fmtValue(c.unit, cur.value, c.countWord)} />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" style={{ touchAction: 'pan-y' }} role="img" aria-label={`Graphique : ${c.summary}. ${c.points.length} points, de ${c.points[0].title} à ${c.points[n - 1].title}.`}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <Axes c={c} g={g} xLabels={xLabels} />
        {c.line && <line x1={M.l} x2={M.l + plotW} y1={y(c.line.value)} y2={y(c.line.value)} stroke={c.line.color ?? 'var(--orange-deep)'} strokeWidth={1.5} strokeDasharray="5 4" />}
        {area && <path d={area} fill={`url(#a${id})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={x(curI)} x2={x(curI)} y1={M.t} y2={M.t + plotH} stroke={color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.6} />
        {pts.map(([px, py], i) => (
          <circle key={c.points[i].key} cx={px} cy={py} r={i === curI ? 6.5 : 3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
        ))}
        {c.points.map((p, i) => (
          <rect
            key={p.key}
            x={x(i) - band / 2}
            y={M.t - 6}
            width={band}
            height={plotH + 12}
            fill="transparent"
            aria-hidden="true"
            onClick={() => setSel(p.key)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(p.key)}
            onPointerDown={() => setSel(p.key)}
          />
        ))}
      </svg>
      <Legend c={c} />
      <DataTable c={c} />
    </div>
  )
}

/** Histogramme avec les mêmes axes gradués. */
export function BarChart(c: Common & { highlightBest?: boolean }): ReactNode {
  const g = useGeometry(c)
  const { H, M, plotW, plotH, y } = g
  const n = c.points.length
  const best = c.points.reduce((b, p) => (p.value > (b?.value ?? -1) ? p : b), c.points[0])
  const [sel, setSel] = useState<string | null>(c.defaultKey ?? (c.highlightBest ? best?.key : null) ?? null)
  const color = c.color ?? 'var(--violet-deep)'
  const band = plotW / Math.max(n, 1)
  const bw = Math.min(band * 0.58, 34)
  const cx = (i: number) => M.l + band * (i + 0.5)
  const cur = c.points.find((p) => p.key === sel) ?? c.points[n - 1]
  const xLabels = c.points.map((p, i) => ({ x: cx(i), text: p.label, bold: p.key === cur?.key }))
  if (n === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Readout title={cur.title} value={fmtValue(c.unit, cur.value, c.countWord)} />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" style={{ touchAction: 'pan-y' }} role="img" aria-label={`Graphique : ${c.summary}. ${n} barres.`}>
        <Axes c={c} g={g} xLabels={xLabels} />
        {c.line && <line x1={M.l} x2={M.l + plotW} y1={y(c.line.value)} y2={y(c.line.value)} stroke={c.line.color ?? 'var(--orange-deep)'} strokeWidth={1.5} strokeDasharray="5 4" />}
        {c.points.map((p, i) => {
          const top = y(p.value)
          const h = Math.max(2, M.t + plotH - top)
          const on = p.key === cur.key
          return (
            <g key={p.key}>
              <path d={`M${cx(i) - bw / 2} ${M.t + plotH} V${top + 6} a6 6 0 0 1 6 -6 h${bw - 12} a6 6 0 0 1 6 6 V${M.t + plotH} Z`} fill={color} fillOpacity={on ? 1 : 0.4} style={h < 8 ? { opacity: 0.6 } : undefined} />
              {n <= 8 && (
                <text x={cx(i)} y={top - 5} textAnchor="middle" fontSize={11} fontWeight={on ? 700 : 400} fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {c.unit === 'eur' ? `${groupThousands(p.value / 100)} €` : groupThousands(p.value)}
                </text>
              )}
              <rect x={cx(i) - band / 2} y={M.t - 6} width={band} height={plotH + 12} fill="transparent" aria-hidden="true" onClick={() => setSel(p.key)} onPointerDown={() => setSel(p.key)} onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(p.key)} />
            </g>
          )
        })}
      </svg>
      <Legend c={c} />
      <DataTable c={c} />
    </div>
  )
}
