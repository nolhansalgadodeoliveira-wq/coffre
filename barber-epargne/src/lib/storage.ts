// Sauvegarde locale (localStorage), import / export, et conversion des anciennes données.

import { currentAccount } from './accounts'
import { entryCategories, expenseCategories, incomeCategories } from './calc'
import { EMPTY_META, type SyncMeta } from './sync'
import type { AppData, Bilan, CategoryDef, Commission, DayStatus, Entry, Expense, Goal, Settings } from './types'
import { DEFAULT_SETTINGS, EMPTY_DATA, EPOCH, MAX_CLIENTS, MAX_DAY_GROSS, MAX_GOALS, MIN_DATE } from './types'
import { addDays, isValidIso } from './dates'

const KEY = 'caisse-weekend:v1'

/** Clé de stockage du compte connecté (le premier compte garde les clés d'origine : rien n'est perdu). */
export function scoped(base: string): string {
  const ns = currentAccount()?.ns
  return ns ? `${base}@${ns}` : base
}
export const dataKey = () => scoped(KEY)
const BROKEN_PREFIX = 'coffre-abime:'

/** Contenu illisible trouvé au démarrage, mis de côté pour ne jamais le perdre. */
export let recoveredBroken: { key: string; raw: string } | null = null

export function loadData(): AppData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(dataKey())
  } catch {
    return EMPTY_DATA
  }
  if (!raw) return EMPTY_DATA
  try {
    const parsed = parseData(JSON.parse(raw))
    if (parsed) return parsed
  } catch {
    /* illisible : traité juste en dessous */
  }
  // Données abîmées : on les garde sous une autre clé AVANT que la première saisie ne les écrase.
  const key = BROKEN_PREFIX + new Date().toISOString()
  try {
    localStorage.setItem(key, raw)
  } catch {
    /* stockage plein : on garde au moins la copie en mémoire pour le téléchargement */
  }
  recoveredBroken = { key, raw }
  return EMPTY_DATA
}

/** Renvoie false si l'appareil refuse l'enregistrement (navigation privée, stockage plein). */
export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(dataKey(), JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isoOk = (v: unknown): v is string => isStr(v) && isValidIso(v) && v >= MIN_DATE
const clampInt = (v: unknown, min: number, max: number, dflt: number) => (isInt(v) && v >= min && v <= max ? v : dflt)
const stamp = (v: unknown) => (isStr(v) && !Number.isNaN(Date.parse(v)) ? v : EPOCH)

function parseCommission(v: unknown): Commission {
  const c = (v ?? {}) as Record<string, unknown>
  const mode = c.mode === 'fixed' ? 'fixed' : 'percent'
  const raw = typeof c.value === 'number' && c.value >= 0 ? c.value : 0
  return { enabled: c.enabled === true, mode, value: mode === 'percent' ? Math.min(raw, 100) : Math.min(Math.round(raw), MAX_DAY_GROSS * 31) }
}

/** Une journée : rejetée si sa date ou son montant est absurde. */
function parseEntry(x: Record<string, unknown>, keepPct: number): Entry | null {
  if (!isStr(x?.id) || !isoOk(x.date)) return null
  const gross = isInt(x.gross) && x.gross >= 0 ? x.gross : isInt(x.amount) && x.amount >= 0 ? Math.round((x.amount * 100) / keepPct) : null
  if (gross === null || gross > MAX_DAY_GROSS) return null
  const tipsIn = isInt(x.tips) && x.tips >= 0 && x.tips <= MAX_DAY_GROSS ? x.tips : 0
  const amount = isInt(x.amount) && x.amount >= 0 && x.amount <= gross + tipsIn ? x.amount : Math.round((gross * keepPct) / 100)
  return {
    id: x.id,
    date: x.date,
    gross,
    amount,
    ...(tipsIn > 0 ? { tips: tipsIn } : {}),
    ...(typeof x.keepPct === 'number' && x.keepPct > 0 && x.keepPct <= 100 ? { keepPct: x.keepPct } : {}),
    ...parseParts(x.parts, gross),
    ...(isInt(x.clients) && x.clients >= 0 && x.clients <= MAX_CLIENTS ? { clients: x.clients } : {}),
    updatedAt: stamp(x.updatedAt),
  }
}

/**
 * Anciennes données (version 1, par week-end) → journées.
 * Un week-end avec détail donne un samedi et, s'il a été saisi, un dimanche. Sans détail, tout va sur le samedi.
 */
function entriesFromWeekends(weekends: unknown[]): Entry[] {
  const out: Entry[] = []
  for (const w of weekends as Record<string, unknown>[]) {
    if (!isStr(w?.id) || !isoOk(w.date) || !isInt(w.amount) || w.amount < 0) continue
    const clients = isInt(w.clients) && w.clients >= 0 && w.clients <= MAX_CLIENTS ? { clients: w.clients } : {}
    if (isInt(w.sat)) {
      const satGross = isInt(w.satGross) ? w.satGross : w.sat * 2
      out.push({ id: w.id + '-sam', date: w.date, gross: satGross, amount: w.sat, ...clients, updatedAt: EPOCH })
      if (isInt(w.sunGross) || (isInt(w.sun) && w.sun > 0)) {
        const sun = isInt(w.sun) ? w.sun : 0
        out.push({ id: w.id + '-dim', date: addDays(w.date, 1), gross: isInt(w.sunGross) ? w.sunGross : sun * 2, amount: sun, updatedAt: EPOCH })
      }
    } else {
      out.push({ id: w.id, date: w.date, gross: isInt(w.gross) ? w.gross : w.amount * 2, amount: w.amount, ...clients, updatedAt: EPOCH })
    }
  }
  return out.filter((e) => e.gross <= MAX_DAY_GROSS)
}

function parseParts(v: unknown, gross: number): { parts?: Entry['parts'] } {
  if (!v || typeof v !== 'object') return {}
  const parts: Record<string, number> = {}
  let total = 0
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[\w-]{1,40}$/.test(k) || !isInt(x) || x <= 0) continue
    parts[k] = x
    total += x
  }
  if (total === 0 || total > gross) return {}
  return { parts }
}

const ID_RE = /^[\w-]{1,40}$/

function parseCats(v: unknown): CategoryDef[] | undefined {
  if (!Array.isArray(v)) return undefined
  const seen = new Set<string>()
  const out: CategoryDef[] = []
  for (const x of v as Record<string, unknown>[]) {
    if (!x || !isStr(x.id) || !ID_RE.test(x.id) || seen.has(x.id) || !isStr(x.label) || !x.label.trim()) continue
    seen.add(x.id)
    out.push({
      id: x.id,
      label: x.label.slice(0, 40),
      emoji: isStr(x.emoji) && x.emoji.length <= 8 ? x.emoji : '•',
      ...(x.kind === 'tips' || x.kind === 'home' ? { kind: x.kind } : {}),
    })
  }
  return out.slice(0, 12)
}

function parseExpense(x: Record<string, unknown>): Expense | null {
  if (!isStr(x?.id) || !ID_RE.test(x.id) || !isoOk(x.date) || !isInt(x.amount) || x.amount <= 0 || x.amount > MAX_DAY_GROSS * 10) return null
  return {
    id: x.id,
    date: x.date,
    cat: isStr(x.cat) && ID_RE.test(x.cat) ? x.cat : 'autre',
    amount: x.amount,
    ...(isStr(x.note) && x.note.trim() ? { note: x.note.slice(0, 80) } : {}),
    updatedAt: stamp(x.updatedAt),
  }
}

const MAX_GOAL = 100_000_000_00

function parseGoal(x: Record<string, unknown>): Goal | null {
  if (!isStr(x?.id) || !isoOk(x.date)) return null
  const amount = clampInt(x.amount, 0, MAX_GOAL, 0)
  const done = x.done as Record<string, unknown> | undefined
  return {
    id: x.id.slice(0, 40),
    name: isStr(x.name) && x.name.trim() ? x.name.slice(0, 40) : 'Objectif',
    emoji: isStr(x.emoji) && x.emoji.length <= 8 ? x.emoji : '🎯',
    amount,
    date: x.date,
    createdAt: stamp(x.createdAt),
    ...(done && isStr(done.at) ? { done: { at: stamp(done.at), spent: clampInt(done.spent, 0, MAX_GOAL, 0) } } : {}),
  }
}

/** Objectifs ; les anciennes données (un seul objectif : goalName / goalAmount / goalDate) sont converties. */
function parseGoals(s: Record<string, unknown>): Goal[] {
  if (Array.isArray(s.goals)) {
    const seen = new Set<string>()
    return (s.goals as Record<string, unknown>[]).map(parseGoal).filter((g): g is Goal => g !== null && !seen.has(g.id) && Boolean(seen.add(g.id))).slice(0, MAX_GOALS)
  }
  const amount = clampInt(s.goalAmount, 0, MAX_GOAL, 0)
  if (amount <= 0) return []
  const name = isStr(s.goalName) && s.goalName.trim() ? s.goalName.slice(0, 40) : 'Mon objectif'
  return [{ id: 'objectif-1', name, emoji: /mariage/i.test(name) ? '💍' : '🎯', amount, date: isoOk(s.goalDate) ? s.goalDate : '2027-04-01', createdAt: EPOCH }]
}

function parseSettings(v: unknown, legacy: boolean): Settings {
  const s = (v ?? {}) as Record<string, unknown>
  const workdays = Array.isArray(s.workdays) ? [...new Set((s.workdays as unknown[]).filter((d): d is number => isInt(d) && d >= 0 && d <= 6))] : DEFAULT_SETTINGS.workdays
  return {
    name: isStr(s.name) ? s.name.slice(0, 40) : '',
    workdays: workdays.length ? workdays : DEFAULT_SETTINGS.workdays,
    hoursPerDay: typeof s.hoursPerDay === 'number' && s.hoursPerDay > 0 && s.hoursPerDay <= 24 ? s.hoursPerDay : DEFAULT_SETTINGS.hoursPerDay,
    keepPct: typeof s.keepPct === 'number' && s.keepPct > 0 && s.keepPct <= 100 ? s.keepPct : DEFAULT_SETTINGS.keepPct,
    personalExpenses: clampInt(s.personalExpenses, 0, 100_000_00, DEFAULT_SETTINGS.personalExpenses),
    goals: parseGoals(s),
    ...(isStr((s.profession as Record<string, unknown> | undefined)?.id) && isStr((s.profession as Record<string, unknown>).label)
      ? { profession: { id: String((s.profession as Record<string, unknown>).id).slice(0, 40), label: String((s.profession as Record<string, unknown>).label).slice(0, 60) } }
      : {}),
    ...(parseCats(s.incomeCats)?.length ? { incomeCats: parseCats(s.incomeCats) } : {}),
    ...(parseCats(s.expenseCats) ? { expenseCats: parseCats(s.expenseCats) } : {}),
    ...(typeof s.homeKeepPct === 'number' && s.homeKeepPct > 0 && s.homeKeepPct <= 100 ? { homeKeepPct: s.homeKeepPct } : {}),
    commission: parseCommission(s.commission),
    // Ancienne version : l'utilisateur n'a jamais vu la présentation, on la lui montre une fois.
    onboarded: legacy ? false : s.onboarded === true,
    updatedAt: stamp(s.updatedAt),
  }
}

/** Vérifie un fichier importé ou une copie en ligne. Renvoie null s'il n'a pas la bonne forme. */
export function parseData(input: unknown): AppData | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const o = input as Record<string, unknown>
  const legacy = Array.isArray(o.weekends)
  if (!legacy && !Array.isArray(o.entries)) return null
  if (!Array.isArray(o.bilans)) return null

  const settings = parseSettings(o.settings, legacy)
  const raw = legacy ? entriesFromWeekends(o.weekends as unknown[]) : (o.entries as Record<string, unknown>[]).map((x) => parseEntry(x, settings.keepPct)).filter((e): e is Entry => e !== null)

  // Une seule journée par date (la plus récente gagne), identifiants uniques.
  const byDate = new Map<string, Entry>()
  for (const e of raw) {
    const prev = byDate.get(e.date)
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.date, e)
  }
  const ids = new Set<string>()
  const entries = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const id = ids.has(e.id) ? `${e.id}-${e.date}` : e.id
      ids.add(id)
      return id === e.id ? e : { ...e, id }
    })

  const bilans: Bilan[] = []
  const legacyWeekendDates = legacy ? new Map((o.weekends as Record<string, unknown>[]).filter((w) => isStr(w?.id) && isStr(w?.date)).map((w) => [w.id as string, w.date as string])) : null
  for (const x of o.bilans as Record<string, unknown>[]) {
    if (!isStr(x?.id) || !isInt(x.actual) || x.actual < 0) continue
    let month: string | null = isStr(x.month) && /^\d{4}-\d{2}$/.test(x.month) ? x.month : null
    if (!month && legacyWeekendDates && Array.isArray(x.weekendIds)) {
      const dates = (x.weekendIds as unknown[]).filter(isStr).map((id) => legacyWeekendDates.get(id)).filter(isStr).sort()
      if (dates.length) month = dates[dates.length - 1].slice(0, 7)
    }
    if (!month || bilans.some((b) => b.month === month)) continue
    bilans.push({
      id: x.id,
      month,
      expensesKept: x.expensesKept !== false,
      actual: Math.min(x.actual, 100_000_000_00),
      personalExpenses: clampInt(x.personalExpenses, 0, 100_000_00, DEFAULT_SETTINGS.personalExpenses),
      commission: parseCommission(x.commission),
      ...(isInt(x.total) && x.total >= 0 ? { total: x.total } : {}),
      ...(isInt(x.expected) && x.expected >= 0 ? { expected: x.expected } : {}),
      createdAt: isStr(x.createdAt) ? x.createdAt : '',
      updatedAt: stamp(x.updatedAt),
    })
  }

  const days: Record<string, DayStatus> = {}
  if (o.days && typeof o.days === 'object') {
    for (const [k, v] of Object.entries(o.days as Record<string, unknown>)) {
      if (isoOk(k) && (v === 'repos' || v === 'prevu' || v === 'extra')) days[k] = v
    }
  }
  // Ancienne version : « prévu » voulait dire samedi ou dimanche, ce qui est le réglage par défaut. Rien à convertir.

  const deleted: Record<string, string> = {}
  if (o.deleted && typeof o.deleted === 'object') {
    for (const [k, v] of Object.entries(o.deleted as Record<string, unknown>)) if (/^[ebx]:/.test(k) && isStr(v)) deleted[k] = v
  }

  const expenseIds = new Set<string>()
  const expenses = (Array.isArray(o.expenses) ? (o.expenses as Record<string, unknown>[]) : [])
    .map(parseExpense)
    .filter((e): e is Expense => e !== null && !expenseIds.has(e.id) && Boolean(expenseIds.add(e.id)))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { version: 2, entries, bilans, days, deleted, expenses, settings }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Export tableur : une ligne par journée, séparateur « ; » et virgule décimale, lisible par Excel en français. */
export function toCsv(data: AppData): string {
  const eur = (c: number) => (c / 100).toFixed(2).replace('.', ',')
  const cats = incomeCategories(data.settings)
  const lines = [['date', 'encaissé', ...cats.map((c) => c.label.toLowerCase()), 'autres', 'ta part', 'part gardée (%)', 'clients'].join(';')]
  for (const e of [...data.entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const byCat = entryCategories(e, data.settings)
    lines.push([e.date, eur(e.gross), ...cats.map((c) => eur(byCat[c.id] ?? 0)), eur(byCat.autres ?? 0), eur(e.amount), e.keepPct ?? '', e.clients ?? ''].join(';'))
  }
  if (data.expenses.length) {
    const xcats = expenseCategories(data.settings)
    lines.push('', 'dépenses', 'date;catégorie;montant;note')
    for (const x of data.expenses) lines.push(`${x.date};${xcats.find((c) => c.id === x.cat)?.label ?? 'Autres'};${eur(x.amount)};${(x.note ?? '').replace(/;/g, ',')}`)
  }
  return '\ufeff' + lines.join('\r\n')
}

// ---- État de la synchronisation, de l'accueil et des compliments, enregistrés sur l'appareil ----

const WELCOME_KEY = 'coffre-welcome:v1'
const SEEN_KEY = 'coffre-compliments:v1'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string, on = true): void {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* ignoré */
  }
}

export const welcomeDone = () => readFlag(WELCOME_KEY)
export const markWelcomeDone = () => writeFlag(WELCOME_KEY)
export const resetWelcome = () => writeFlag(WELCOME_KEY, false)

export function seenCompliments(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(scoped(SEEN_KEY)) || '[]') as string[])
  } catch {
    return new Set()
  }
}
export function markComplimentSeen(key: string): void {
  try {
    const s = seenCompliments()
    s.add(key)
    localStorage.setItem(scoped(SEEN_KEY), JSON.stringify([...s].slice(-200)))
  } catch {
    /* ignoré */
  }
}

/** Téléchargement d'un fichier (export, copie de secours). */
export function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ---- État de la synchronisation du compte connecté ----

const META_KEY = 'coffre-sync:v1'

export function loadMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(scoped(META_KEY))
    if (!raw) return EMPTY_META
    const m = JSON.parse(raw) as Partial<SyncMeta>
    return {
      userId: typeof m.userId === 'string' ? m.userId : null,
      version: typeof m.version === 'number' ? m.version : null,
      dirty: m.dirty === true,
      lastSyncAt: typeof m.lastSyncAt === 'string' ? m.lastSyncAt : null,
    }
  } catch {
    return EMPTY_META
  }
}

export function saveMeta(m: SyncMeta): void {
  try {
    localStorage.setItem(scoped(META_KEY), JSON.stringify(m))
  } catch {
    /* stockage refusé : la synchronisation repartira de zéro, sans rien perdre */
  }
}
