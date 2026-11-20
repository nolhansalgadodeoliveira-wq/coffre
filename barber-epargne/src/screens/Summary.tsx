import { useState } from 'react'
import type { ScreenProps } from '../App'
import { autoSaved, baselineDay, savedAfterBaseline, categoryTotals, costsOfMonth, entriesOfMonth, expenseCategories, expenseTotals, expensesOfMonth, goalsPlan, incomeCategories, OTHER_COLOR, tracksExpenses, type CategoryView } from '../lib/calc'
import { addMonths, formatDayLong, formatMonthKey, monthKeyOf } from '../lib/dates'
import { formatEurosShort } from '../lib/money'
import type { AppData, Entry } from '../lib/types'
import { IconChevronLeft, IconChevronRight } from '../icons'
import { Card, Notice, PrimaryButton, Screen, Toggle } from '../ui'

export type Period = 'mois' | 'annee'

interface Figures {
  title: string
  share: number
  gross: number
  days: number
  perDay: number
  best: Entry | null
  categories: Record<string, number>
  /** Dépenses professionnelles de la période, et leur détail. */
  costs: number
  costTotals: Record<string, number>
  /** Mis de côté : mois terminés (bilan, sinon calcul automatique) ; null si rien de terminé. */
  saved: number | null
  /** Évolution de ta part par rapport à la période d'avant, en % (null si pas comparable). */
  change: number | null
  /** Année : ta part mois par mois. */
  months?: { month: string; share: number }[]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sum = (l: Entry[]) => l.reduce((a, e) => a + e.amount, 0)

function savedOf(data: AppData, month: string, cur: string): number | null {
  if (month >= cur) return null
  const base = data.settings.savedBaseline
  // Mois couverts par le montant déjà coffré : pas de détail (le mois de la saisie : seulement la suite du mois).
  if (base && month < base.month) return null
  if (base && month === base.month) return savedAfterBaseline(data, month, baselineDay(data)!)
  if (entriesOfMonth(data, month).length === 0) return null
  return data.bilans.find((b) => b.month === month)?.actual ?? autoSaved(data, month)
}

export function figures(data: AppData, period: Period, key: string, today: string): Figures {
  const cur = monthKeyOf(today)
  const months = period === 'mois' ? [key] : Array.from({ length: 12 }, (_, i) => `${key}-${String(i + 1).padStart(2, '0')}`)
  const entries = months.flatMap((m) => entriesOfMonth(data, m))
  const share = sum(entries)
  const savedList = months.map((m) => savedOf(data, m, cur)).filter((x): x is number => x !== null)
  const prevKey = period === 'mois' ? addMonths(key, -1) : String(Number(key) - 1)
  const prevShare = period === 'mois' ? sum(entriesOfMonth(data, prevKey)) : Array.from({ length: 12 }, (_, i) => sum(entriesOfMonth(data, `${prevKey}-${String(i + 1).padStart(2, '0')}`))).reduce((a, b) => a + b, 0)
  return {
    title: period === 'mois' ? cap(formatMonthKey(key)) : `Année ${key}`,
    share,
    gross: entries.reduce((a, e) => a + e.gross + (e.tips ?? 0), 0),
    days: entries.length,
    perDay: entries.length ? Math.round(share / entries.length) : 0,
    best: entries.reduce<Entry | null>((b, e) => (!b || e.amount > b.amount ? e : b), null),
    categories: categoryTotals(entries, data.settings),
    costs: months.reduce((a, m) => a + costsOfMonth(data, m), 0),
    costTotals: expenseTotals(months.flatMap((m) => expensesOfMonth(data, m)), data.settings),
    saved: savedList.length ? savedList.reduce((a, b) => a + b, 0) : null,
    change: prevShare > 0 && share > 0 ? ((share - prevShare) / prevShare) * 100 : null,
    months: period === 'annee' ? months.map((m) => ({ month: m, share: sum(entriesOfMonth(data, m)) })) : undefined,
  }
}

/** Catégories affichées : celles du métier, plus « Autres » s'il reste des montants sans catégorie. */
export function withOther(cats: CategoryView[], totals: Record<string, number>): CategoryView[] {
  return totals.autres ? [...cats, { id: 'autres', label: 'Autres', emoji: '•', color: OTHER_COLOR }] : cats
}

/** Part en % lisible : « <1 % » plutôt que « 0 % » pour une petite part. */
const pctText = (part: number, total: number) => (total <= 0 ? '0 %' : part > 0 && (part / total) * 100 < 1 ? '<1 %' : `${Math.round((part / total) * 100)} %`)

/** Barre empilée par catégorie + légende (nom, montant, %), dans l'ordre fixe des catégories. */
export function CategoryBar({ totals, cats, hidden, empty = 'Rien d’encaissé sur cette période.' }: { totals: Record<string, number>; cats: CategoryView[]; hidden?: boolean; empty?: string }) {
  const all = withOther(cats, totals)
  const total = all.reduce((a, c) => a + (totals[c.id] ?? 0), 0)
  if (total <= 0) return <p className="text-[0.9375rem] text-muted">{empty}</p>
  const shown = all.filter((c) => (totals[c.id] ?? 0) > 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={shown.map((c) => `${c.label} ${pctText(totals[c.id], total)}`).join(', ')}>
        {shown.map((c) => (
          <span key={c.id} style={{ width: `${(totals[c.id] / total) * 100}%`, background: c.color }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-[0.9375rem]">
        {shown.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="min-w-0 flex-1">{c.label}</span>
            <span className="num font-semibold">{hidden ? '•••' : formatEurosShort(totals[c.id])}</span>
            <span className="num w-12 text-right text-muted">{pctText(totals[c.id], total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Summary({ data, today, close, period: initialPeriod, periodKey }: ScreenProps & { period: Period; periodKey: string }) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [key, setKey] = useState(periodKey)
  const [hide, setHide] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const f = figures(data, period, key, today)
  const plan = goalsPlan(data, today)
  const money = (c: number) => (hide ? '•••' : formatEurosShort(c))

  const move = (n: number) => setKey(period === 'mois' ? addMonths(key, n) : String(Number(key) + n))
  const switchTo = (p: Period) => {
    setPeriod(p)
    setKey(p === 'mois' ? (key.length === 4 ? monthKeyOf(today) : key) : key.slice(0, 4))
  }
  const isFuture = period === 'mois' ? key > monthKeyOf(today) : Number(key) > Number(today.slice(0, 4))
  const maxMonth = Math.max(1, ...(f.months ?? []).map((m) => m.share))

  async function share() {
    setMessage(null)
    try {
      const blob = await drawImage(f, hide, plan.goals.map((g) => ({ name: `${g.goal.emoji} ${g.goal.name}`, pct: Math.round(g.progress * 100) })), withOther(incomeCategories(data.settings), f.categories))
      const file = new File([blob], `coffre-${key}.png`, { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `Coffre · ${f.title}` })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setMessage('Image téléchargée.')
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setMessage('Impossible de créer l’image sur cet appareil.')
    }
  }

  return (
    <Screen title="Résumé" back={close}>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Période">
        {(['mois', 'annee'] as Period[]).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => switchTo(p)} className={`h-11 rounded-full text-[0.9375rem] font-semibold ${period === p ? 'bg-ink text-white' : 'text-ink'}`}>
            {p === 'mois' ? 'Mois' : 'Année'}
          </button>
        ))}
      </div>

      <Card tone="violet" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Période précédente" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/60 active:scale-95">
            <IconChevronLeft size={18} />
          </button>
          <span className="display text-[1.5rem]">{f.title}</span>
          <button type="button" onClick={() => move(1)} disabled={isFuture} aria-label="Période suivante" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/60 active:scale-95 disabled:opacity-40">
            <IconChevronRight size={18} />
          </button>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.9375rem] text-ink/80">Ta part</span>
          <span className="num display text-[2.75rem]">{money(f.share)}</span>
          {f.change !== null && (
            <span className="text-[0.9375rem] font-medium">
              {f.change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(f.change))} % par rapport {period === 'mois' ? 'au mois d’avant' : 'à l’année d’avant'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-[0.9375rem]">
          <Stat label="Jours travaillés" value={String(f.days)} />
          <Stat label="Par jour en moyenne" value={money(f.perDay)} />
          <Stat label="Encaissé (pourboires compris)" value={money(f.gross)} />
          <Stat label={period === 'mois' ? 'Mis de côté' : 'Mis de côté (mois terminés)'} value={f.saved === null ? 'en cours' : money(f.saved)} />
        </div>
        {data.settings.savedBaseline && (period === 'mois' ? key <= data.settings.savedBaseline.month : key <= data.settings.savedBaseline.month.slice(0, 4)) && (
          <p className="rounded-2xl bg-white/60 p-3 text-[0.875rem]">
            Ton montant déjà coffré ({money(data.settings.savedBaseline.amount)}, saisi à la main) couvre {period === 'mois' && key < data.settings.savedBaseline.month ? 'ce mois' : 'cette période jusqu’à sa saisie'} : il n’est pas détaillé mois par mois.
          </p>
        )}
        {f.best && (
          <p className="text-[0.9375rem]">
            Meilleure journée : <strong>{money(f.best.amount)}</strong>, {formatDayLong(f.best.date)}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <span className="text-[1.125rem] font-semibold">D’où vient l’argent</span>
        <CategoryBar totals={f.categories} cats={incomeCategories(data.settings)} hidden={hide} />
      </Card>

      {tracksExpenses(data.settings) && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[1.125rem] font-semibold">Tes dépenses</span>
            <span className="num font-semibold">{money(f.costs)}</span>
          </div>
          <CategoryBar totals={f.costTotals} cats={expenseCategories(data.settings)} hidden={hide} empty="Aucune dépense sur cette période." />
          <p className="flex justify-between rounded-2xl bg-field p-3 text-[0.9375rem]">
            <span>Il te reste (recettes − dépenses)</span>
            <strong className="num">{money(f.share - f.costs)}</strong>
          </p>
        </Card>
      )}

      {f.months && (
        <Card className="flex flex-col gap-3">
          <span className="text-[1.125rem] font-semibold">Ta part, mois par mois</span>
          <ul className="flex flex-col gap-2">
            {f.months.map((m) => (
              <li key={m.month} className="flex items-center gap-3 text-[0.875rem]">
                <span className="w-10 shrink-0 text-muted">{cap(formatMonthKey(m.month)).slice(0, 4).replace(/\s$/, '')}</span>
                <span className="h-3 min-w-0 flex-1 rounded-full bg-field">
                  <span className="block h-3 rounded-full bg-cat-coupes" style={{ width: `${(m.share / maxMonth) * 100}%` }} />
                </span>
                <span className="num w-16 shrink-0 text-right font-medium">{m.share ? money(m.share) : '–'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {plan.goals.length > 0 && (
        <Card className="flex flex-col gap-2">
          <span className="text-[1.125rem] font-semibold">Tes objectifs aujourd’hui</span>
          {plan.goals.map((g) => (
            <p key={g.goal.id} className="flex justify-between text-[0.9375rem]">
              <span>
                {g.goal.emoji} {g.goal.name}
              </span>
              <span className="num font-semibold">{Math.round(g.progress * 100)} %</span>
            </p>
          ))}
        </Card>
      )}

      <Card className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-semibold">Masquer les montants</span>
          <span className="text-[0.875rem] text-muted">Pour partager sans montrer combien tu gagnes.</span>
        </span>
        <Toggle checked={hide} onChange={setHide} label="Masquer les montants" />
      </Card>
      {f.days === 0 && <Notice>Aucune journée saisie sur cette période.</Notice>}
      {message && <Notice>{message}</Notice>}
      <PrimaryButton onClick={() => void share()}>Partager en image</PrimaryButton>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white/60 p-3">
      <span className="num text-[1.25rem] font-semibold">{value}</span>
      <span className="text-[0.8125rem] leading-snug text-ink/80">{label}</span>
    </div>
  )
}

/** Image 1080 × 1350 (format portrait des réseaux sociaux) du résumé. */
async function drawImage(f: Figures, hide: boolean, goals: { name: string; pct: number }[], cats: CategoryView[]): Promise<Blob> {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  try {
    await document.fonts?.ready
  } catch {
    /* police par défaut */
  }
  const css = getComputedStyle(document.documentElement)
  const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d
  const font = (w: number, s: number) => `${w} ${s}px "Outfit Variable", Outfit, system-ui, sans-serif`
  const money = (x: number) => (hide ? '•••' : formatEurosShort(x))
  const round = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    g.fillStyle = fill
    g.beginPath()
    g.roundRect(x, y, w, h, r)
    g.fill()
  }

  g.fillStyle = v('--bg', '#f4f2fa')
  g.fillRect(0, 0, W, H)
  round(60, 60, W - 120, 520, 56, v('--violet', '#b9a7ff'))
  g.fillStyle = v('--ink', '#121215')
  g.font = font(600, 40)
  g.fillText('Coffre', 120, 150)
  g.font = font(700, 72)
  g.fillText(f.title, 120, 250)
  g.font = font(500, 40)
  g.fillText('Ta part', 120, 340)
  g.font = font(800, 140)
  g.fillText(money(f.share), 120, 480)
  if (f.change !== null) {
    g.font = font(500, 36)
    g.fillText(`${f.change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(f.change))} %`, 120, 545)
  }

  const stats: [string, string][] = [
    [String(f.days), 'jours travaillés'],
    [money(f.perDay), 'par jour'],
    [f.saved === null ? 'en cours' : money(f.saved), 'mis de côté'],
  ]
  stats.forEach(([val, lab], i) => {
    const x = 60 + i * 330
    round(x, 620, 300, 190, 40, '#ffffff')
    g.fillStyle = v('--ink', '#121215')
    g.font = font(700, 56)
    g.fillText(val, x + 36, 710)
    g.font = font(400, 32)
    g.fillStyle = v('--muted', '#5d596b')
    g.fillText(lab, x + 36, 770)
  })

  round(60, 850, W - 120, goals.length ? 260 : 440, 40, '#ffffff')
  g.fillStyle = v('--ink', '#121215')
  g.font = font(600, 38)
  g.fillText('D’où vient l’argent', 110, 920)
  const total = cats.reduce((a, cat) => a + (f.categories[cat.id] ?? 0), 0)
  let x = 110
  const barW = W - 220
  for (const cat of cats) {
    const w = total ? ((f.categories[cat.id] ?? 0) / total) * barW : 0
    if (w <= 0) continue
    g.fillStyle = v(cat.color.slice(4, -1), '#8a8797')
    g.fillRect(x, 950, Math.max(0, w - 4), 28)
    x += w
  }
  let y = 1030
  const shown = cats.filter((cat) => (f.categories[cat.id] ?? 0) > 0).slice(0, goals.length ? 2 : 4)
  for (const cat of shown) {
    g.fillStyle = v(cat.color.slice(4, -1), '#8a8797')
    g.beginPath()
    g.arc(122, y - 12, 12, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = v('--ink', '#121215')
    g.font = font(400, 34)
    g.fillText(`${cat.label} · ${pctText(f.categories[cat.id], total)}`, 150, y)
    y += 56
  }

  if (goals.length) {
    round(60, 1140, W - 120, 150, 40, '#ffffff')
    g.fillStyle = v('--ink', '#121215')
    g.font = font(500, 34)
    g.fillText(goals.slice(0, 2).map((o) => `${o.name} ${o.pct} %`).join('   ·   '), 110, 1230)
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/png'))
}
