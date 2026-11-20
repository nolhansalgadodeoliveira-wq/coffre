// Logique des rappels de fin de journée. Aucune dépendance : testée dans src/lib/reminders.test.ts.
//
// Toutes les 15 minutes, le serveur appelle `run`. Pour chaque appareil inscrit, on envoie UNE notification par jour si :
//  - l'heure du rappel (dans le fuseau de l'utilisateur) est passée, depuis moins de 3 heures ;
//  - ce jour est un jour travaillé prévu (jours habituels, jours en plus, hors repos exceptionnel) ;
//  - rien n'a encore été saisi pour ce jour.

export interface Sub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  /** Heure locale du rappel, « HH:MM ». */
  remind_at: string
  /** Fuseau IANA de l'appareil (« Europe/Paris »). */
  timezone: string
  /** Dernier jour (AAAA-MM-JJ, heure locale) où un rappel a été envoyé. */
  last_sent: string | null
  created_at?: string
}

export interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

export interface LocalParts {
  /** AAAA-MM-JJ */
  date: string
  /** Minutes depuis minuit, heure locale. */
  minutes: number
  /** 0 = dimanche … 6 = samedi */
  weekday: number
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Date et heure locales dans un fuseau donné (un fuseau inconnu retombe sur Paris). */
export function localParts(now: Date, timeZone: string): LocalParts {
  let tz = timeZone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
  } catch {
    tz = 'Europe/Paris'
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  }
}

/** « 20:30 » → 1230. Renvoie null si l'heure est invalide. */
export function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '')
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h <= 23 && min <= 59 ? h * 60 + min : null
}

// deno-lint-ignore no-explicit-any
type AnyData = any

/** Ce jour est-il un jour de travail prévu ? Même règle que dans l'app. */
export function isPlanned(data: AnyData, date: string, weekday: number): boolean {
  const override = data?.days?.[date]
  if (override === 'repos') return false
  if (override === 'prevu' || override === 'extra') return true
  const workdays: unknown = data?.settings?.workdays
  return Array.isArray(workdays) ? workdays.includes(weekday) : weekday === 0 || weekday === 6
}

export function hasEntry(data: AnyData, date: string): boolean {
  return Array.isArray(data?.entries) && data.entries.some((e: { date?: string }) => e?.date === date)
}

export type Decision = 'send' | 'already' | 'not-yet' | 'too-late' | 'bad-time' | 'no-data' | 'not-planned' | 'entered'

/** Contrôles qui ne demandent pas de charger les données : heure et un seul envoi par jour. */
export function timeCheck(sub: Sub, now: Date, windowMinutes = 180): { decision: Decision | null; local: LocalParts } {
  const local = localParts(now, sub.timezone)
  const at = toMinutes(sub.remind_at)
  if (at === null) return { decision: 'bad-time', local }
  if (sub.last_sent === local.date) return { decision: 'already', local }
  if (local.minutes < at) return { decision: 'not-yet', local }
  if (local.minutes > at + windowMinutes) return { decision: 'too-late', local }
  return { decision: null, local }
}

export function decide(sub: Sub, data: AnyData | null, now: Date, windowMinutes = 180): { decision: Decision; date: string } {
  const t = timeCheck(sub, now, windowMinutes)
  if (t.decision) return { decision: t.decision, date: t.local.date }
  if (!data) return { decision: 'no-data', date: t.local.date }
  if (!isPlanned(data, t.local.date, t.local.weekday)) return { decision: 'not-planned', date: t.local.date }
  if (hasEntry(data, t.local.date)) return { decision: 'entered', date: t.local.date }
  return { decision: 'send', date: t.local.date }
}

export function buildPayload(data: AnyData | null): Payload {
  const name = typeof data?.settings?.name === 'string' ? data.settings.name.trim() : ''
  return {
    title: 'Ta journée est finie ?',
    body: name ? `${name}, combien as-tu gagné aujourd’hui ?` : 'Combien as-tu gagné aujourd’hui ?',
    url: './#saisir',
    tag: 'journee',
  }
}

export function buildTestPayload(): Payload {
  return { title: 'Coffre', body: 'Les rappels fonctionnent. Tu recevras une notification à la fin de tes jours de travail.', url: './', tag: 'test' }
}

export interface Deps {
  listSubs(): Promise<Sub[]>
  loadData(userIds: string[]): Promise<Record<string, AnyData>>
  send(sub: Sub, payload: Payload): Promise<'ok' | 'gone' | 'error'>
  markSent(sub: Sub, date: string): Promise<void>
  removeSub(sub: Sub): Promise<void>
}

export interface Report {
  checked: number
  sent: number
  removed: number
  errors: number
  skipped: Record<string, number>
}

export async function run(deps: Deps, now: Date = new Date()): Promise<Report> {
  const report: Report = { checked: 0, sent: 0, removed: 0, errors: 0, skipped: {} }
  const skip = (why: string) => (report.skipped[why] = (report.skipped[why] ?? 0) + 1)

  // Un même appareil peut avoir plusieurs lignes (changement de compte) : seule la plus récente reçoit.
  const byEndpoint = new Map<string, Sub>()
  for (const s of await deps.listSubs()) {
    const prev = byEndpoint.get(s.endpoint)
    if (!prev || (s.created_at ?? '') > (prev.created_at ?? '')) byEndpoint.set(s.endpoint, s)
  }
  const subs = [...byEndpoint.values()]
  report.checked = subs.length

  const candidates = subs.filter((s) => {
    const t = timeCheck(s, now)
    if (t.decision) skip(t.decision)
    return t.decision === null
  })
  if (candidates.length === 0) return report

  const data = await deps.loadData([...new Set(candidates.map((s) => s.user_id))])
  for (const sub of candidates) {
    const d = decide(sub, data[sub.user_id] ?? null, now)
    if (d.decision !== 'send') {
      skip(d.decision)
      continue
    }
    const result = await deps.send(sub, buildPayload(data[sub.user_id]))
    if (result === 'ok') {
      await deps.markSent(sub, d.date)
      report.sent++
    } else if (result === 'gone') {
      await deps.removeSub(sub)
      report.removed++
    } else {
      report.errors++
    }
  }
  return report
}
