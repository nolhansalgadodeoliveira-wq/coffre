// Les dates sont manipulées en texte AAAA-MM-JJ et converties en jours UTC,
// pour ne jamais être décalées d'un jour par les changements d'heure.

const DAY_MS = 86_400_000

export function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days)
}

/** Jour de la semaine : 0 = dimanche, 6 = samedi. */
export function weekday(iso: string): number {
  return new Date(toDayNumber(iso) * DAY_MS).getUTCDay()
}

export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return fromDayNumber(toDayNumber(iso)) === iso
}

/** Date du jour dans le fuseau de l'appareil. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Samedi du week-end le plus récent (aujourd'hui si on est samedi, hier si dimanche). */
export function latestSaturday(today: string): string {
  const back = (weekday(today) + 1) % 7 // samedi → 0, dimanche → 1, lundi → 2…
  return addDays(today, -back)
}

/**
 * Ramène une date au samedi du week-end de la MÊME SEMAINE (du lundi au dimanche) :
 * lundi à samedi → le samedi de cette semaine, dimanche → la veille.
 * Ex. jeudi 6 août 2026 → samedi 8 août (et non le 1er août).
 */
export function saturdayOf(iso: string): string {
  const wd = weekday(iso)
  return wd === 0 ? addDays(iso, -1) : addDays(iso, 6 - wd)
}

const longFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const longYearFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dayWeekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
const monthOnlyFmt =new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
const monthFmt =new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function asDate(iso: string): Date {
  return new Date(toDayNumber(iso) * DAY_MS)
}

/** « 15 novembre » */
export function formatDay(iso: string): string {
  return longFmt.format(asDate(iso))
}

/** « 1 avril 2027 » → « 1er avril 2027 » */
export function formatDayYear(iso: string): string {
  return longYearFmt.format(asDate(iso)).replace(/^1 /, '1er ').replace(/ /g, ' ')
}

/** « Week-end du 15-16 novembre » */
export function formatWeekend(saturday: string): string {
  const sunday = addDays(saturday, 1)
  if (saturday.slice(0, 7) === sunday.slice(0, 7)) {
    const month = monthOnlyFmt.format(asDate(saturday))
    // Espaces insécables et tiret liés : « 14-15 novembre » ne se coupe jamais en fin de ligne.
    return `${Number(saturday.slice(8))}⁠-⁠${Number(sunday.slice(8))} ${month}`
  }
  return `${formatDay(saturday)} – ${formatDay(sunday)}`.replace(/ (?!–)/g, ' ')
}

/** « novembre 2026 » */
export function formatMonth(year: number, month: number): string {
  return monthFmt.format(new Date(Date.UTC(year, month, 1)))
}

// ---- Mois (clé « AAAA-MM ») ----

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

function monthParts(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number)
  return [y, m]
}

/** Dernier jour du mois : « 2026-10 » → « 2026-10-31 ». */
export function lastDayOfMonth(key: string): string {
  const [y, m] = monthParts(key)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return addDays(next, -1)
}

export function addMonths(key: string, n: number): string {
  const [y, m] = monthParts(key)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Tous les samedis d'un mois : 4 ou 5 dates. */
export function saturdaysOf(key: string): string[] {
  const first = `${key}-01`
  let d = addDays(first, (6 - weekday(first) + 7) % 7)
  const end = lastDayOfMonth(key)
  const out: string[] = []
  while (d <= end) {
    out.push(d)
    d = addDays(d, 7)
  }
  return out
}

/** « novembre 2026 » */
export function formatMonthKey(key: string): string {
  const [y, m] = monthParts(key)
  return formatMonth(y, m - 1)
}

/** « novembre » */
export function monthName(key: string): string {
  return monthOnlyFmt.format(asDate(`${key}-01`))
}

/** « sam. 7 novembre » */
export function formatDayWeekday(iso: string): string {
  return dayWeekdayFmt.format(asDate(iso)).replace(/ 1 /, ' 1er ')
}

/** « de novembre », « d'octobre » : l'élision devant une voyelle (août, avril, octobre). */
export function deMonth(key: string): string {
  const name = monthName(key)
  return /^[aeiouy]/i.test(name) ? `d'${name}` : `de ${name}`
}

const SHORT_MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

/** « oct », « sept » : assez court pour tenir sous une barre. */
export function monthShort(key: string): string {
  return SHORT_MONTHS[Number(key.slice(5, 7)) - 1]
}

// ---- Jours et semaines (du lundi au dimanche) ----

export const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
export const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const WEEKDAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
/** Ordre d'affichage : lundi en premier. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/** Nombre de jours de a à b (b − a). */
export function daysBetween(a: string, b: string): number {
  return toDayNumber(b) - toDayNumber(a)
}

/** Lundi de la semaine d'une date. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7))
}

/** Tous les jours d'un mois. */
export function datesOfMonth(key: string): string[] {
  const out: string[] = []
  for (let d = `${key}-01`; d.slice(0, 7) === key; d = addDays(d, 1)) out.push(d)
  return out
}

/** « 3-9 novembre » ou « 27 oct. – 2 nov. » */
export function formatWeekRange(monday: string): string {
  const sunday = addDays(monday, 6)
  if (monday.slice(0, 7) === sunday.slice(0, 7)) return `${Number(monday.slice(8))}⁠-⁠${Number(sunday.slice(8))} ${monthName(monday.slice(0, 7))}`
  return `${formatDay(monday)} – ${formatDay(sunday)}`.replace(/ (?!–)/g, ' ')
}

/** « samedi 7 novembre » */
export function formatDayLong(iso: string): string {
  return `${WEEKDAY_LONG[weekday(iso)]} ${formatDay(iso).replace(/^1 /, '1er ')}`
}
