import { describe, expect, it } from 'vitest'
import { buildPayload, decide, hasEntry, isPlanned, localParts, run, timeCheck, toMinutes, type Deps, type Sub } from '../../supabase/functions/reminders/logic'

const sub = (over: Partial<Sub> = {}): Sub => ({ endpoint: 'https://push.example/abc', user_id: 'u1', p256dh: 'p', auth: 'a', remind_at: '20:30', timezone: 'Europe/Paris', last_sent: null, created_at: '2026-11-01T00:00:00Z', ...over })
// Samedi 21 novembre 2026, 20h45 à Paris (UTC+1 en novembre) = 19h45 UTC
const SAT_2045 = new Date('2026-11-21T19:45:00Z')
const data = (over: Record<string, unknown> = {}) => ({ settings: { name: 'Alex', workdays: [6, 0] }, entries: [], days: {}, ...over })

describe('heure locale', () => {
  it('convertit dans le fuseau de l’appareil', () => {
    expect(localParts(SAT_2045, 'Europe/Paris')).toEqual({ date: '2026-11-21', minutes: 20 * 60 + 45, weekday: 6 })
    expect(localParts(SAT_2045, 'America/Los_Angeles')).toEqual({ date: '2026-11-21', minutes: 11 * 60 + 45, weekday: 6 })
    expect(localParts(SAT_2045, 'Pacific/Auckland')).toEqual({ date: '2026-11-22', minutes: 8 * 60 + 45, weekday: 0 })
  })
  it('gère l’heure d’été et minuit', () => {
    expect(localParts(new Date('2027-07-10T18:30:00Z'), 'Europe/Paris').minutes).toBe(20 * 60 + 30) // UTC+2
    expect(localParts(new Date('2026-11-21T23:30:00Z'), 'Europe/Paris')).toMatchObject({ date: '2026-11-22', minutes: 30 })
  })
  it('un fuseau inconnu retombe sur Paris', () => {
    expect(localParts(SAT_2045, 'Mars/Olympus').minutes).toBe(20 * 60 + 45)
  })
  it('lit les heures « HH:MM »', () => {
    expect(toMinutes('20:30')).toBe(1230)
    expect(toMinutes('8:05')).toBe(485)
    expect(toMinutes('25:00')).toBeNull()
    expect(toMinutes('abc')).toBeNull()
  })
})

describe('jour prévu', () => {
  it('suit les jours habituels, avec n’importe quels jours', () => {
    expect(isPlanned(data(), '2026-11-21', 6)).toBe(true)
    expect(isPlanned(data(), '2026-11-23', 1)).toBe(false)
    expect(isPlanned(data({ settings: { workdays: [2, 3, 4, 5, 6] } }), '2026-11-24', 2)).toBe(true)
  })
  it('un repos exceptionnel ou un jour en plus prime sur l’habitude', () => {
    expect(isPlanned(data({ days: { '2026-11-21': 'repos' } }), '2026-11-21', 6)).toBe(false)
    expect(isPlanned(data({ days: { '2026-11-25': 'extra' } }), '2026-11-25', 3)).toBe(true)
  })
  it('sans réglage, week-end par défaut', () => {
    expect(isPlanned({}, '2026-11-21', 6)).toBe(true)
    expect(isPlanned({}, '2026-11-23', 1)).toBe(false)
  })
  it('détecte une journée déjà saisie', () => {
    expect(hasEntry(data({ entries: [{ date: '2026-11-21' }] }), '2026-11-21')).toBe(true)
    expect(hasEntry(data(), '2026-11-21')).toBe(false)
  })
})

describe('décision d’envoi', () => {
  it('envoie après l’heure du rappel, un jour travaillé, rien de saisi', () => {
    expect(decide(sub(), data(), SAT_2045).decision).toBe('send')
  })
  it('pas avant l’heure', () => {
    expect(decide(sub(), data(), new Date('2026-11-21T19:00:00Z')).decision).toBe('not-yet') // 20h00
  })
  it('un seul rappel par jour', () => {
    expect(decide(sub({ last_sent: '2026-11-21' }), data(), SAT_2045).decision).toBe('already')
    expect(decide(sub({ last_sent: '2026-11-20' }), data(), SAT_2045).decision).toBe('send')
  })
  it('pas de rappel en retard de plus de 3 heures (serveur en panne)', () => {
    expect(timeCheck(sub(), new Date('2026-11-21T22:45:00Z')).decision).toBe('too-late') // 23h45
    expect(timeCheck(sub(), new Date('2026-11-21T21:30:00Z')).decision).toBeNull() // 22h30, rattrapage
  })
  it('pas de rappel un jour de repos', () => {
    expect(decide(sub(), data(), new Date('2026-11-23T19:45:00Z')).decision).toBe('not-planned') // lundi
    expect(decide(sub(), data({ days: { '2026-11-21': 'repos' } }), SAT_2045).decision).toBe('not-planned')
  })
  it('pas de rappel si la journée est déjà saisie', () => {
    expect(decide(sub(), data({ entries: [{ date: '2026-11-21' }] }), SAT_2045).decision).toBe('entered')
  })
  it('un jour en plus (mercredi) déclenche le rappel', () => {
    expect(decide(sub(), data({ days: { '2026-11-25': 'extra' } }), new Date('2026-11-25T19:45:00Z')).decision).toBe('send')
  })
  it('sans données ou avec une heure invalide : rien', () => {
    expect(decide(sub(), null, SAT_2045).decision).toBe('no-data')
    expect(decide(sub({ remind_at: 'bof' }), data(), SAT_2045).decision).toBe('bad-time')
  })
  it('chacun son fuseau', () => {
    const la = sub({ timezone: 'America/Los_Angeles', remind_at: '11:30' })
    expect(decide(la, data(), SAT_2045).decision).toBe('send')
  })
  it('le message porte le prénom', () => {
    expect(buildPayload(data()).body).toBe('Alex, combien as-tu gagné aujourd’hui ?')
    expect(buildPayload(data({ settings: { name: '' } })).body).toBe('Combien as-tu gagné aujourd’hui ?')
    expect(buildPayload(null).title).toBe('Ta journée est finie ?')
  })
})

describe('passage planifié', () => {
  function fake(subs: Sub[], datas: Record<string, unknown>, result: 'ok' | 'gone' | 'error' = 'ok') {
    const log = { sent: [] as string[], marked: [] as string[], removed: [] as string[], loaded: [] as string[][] }
    const deps: Deps = {
      listSubs: async () => subs,
      loadData: async (ids) => ((log.loaded.push(ids), datas)) as Record<string, unknown>,
      send: async (s, p) => (log.sent.push(`${s.user_id}:${p.title}`), result),
      markSent: async (s, d) => void log.marked.push(`${s.user_id}:${d}`),
      removeSub: async (s) => void log.removed.push(s.endpoint),
    }
    return { deps, log }
  }

  it('envoie, note l’envoi, et ne recommence pas au passage suivant (15 min plus tard)', async () => {
    const subs = [sub()]
    const { deps, log } = fake(subs, { u1: data() })
    const r1 = await run(deps, SAT_2045)
    expect(r1).toMatchObject({ checked: 1, sent: 1, removed: 0, errors: 0 })
    expect(log.marked).toEqual(['u1:2026-11-21'])
    subs[0].last_sent = '2026-11-21' // ce que fait markSent en base
    const r2 = await run(deps, new Date(SAT_2045.getTime() + 15 * 60000))
    expect(r2.sent).toBe(0)
    expect(r2.skipped.already).toBe(1)
  })

  it('ne charge les données que des appareils concernés', async () => {
    const { deps, log } = fake([sub(), sub({ endpoint: 'e2', user_id: 'u2', remind_at: '23:00' })], { u1: data() })
    await run(deps, SAT_2045)
    expect(log.loaded).toEqual([['u1']])
  })

  it('retire un appareil désinscrit', async () => {
    const { deps, log } = fake([sub()], { u1: data() }, 'gone')
    const r = await run(deps, SAT_2045)
    expect(r.removed).toBe(1)
    expect(log.removed).toEqual(['https://push.example/abc'])
    expect(log.marked).toEqual([])
  })

  it('une erreur d’envoi ne marque rien, pour réessayer au passage suivant', async () => {
    const { deps, log } = fake([sub()], { u1: data() }, 'error')
    const r = await run(deps, SAT_2045)
    expect(r.errors).toBe(1)
    expect(log.marked).toEqual([])
  })

  it('un téléphone avec deux lignes (changement de compte) ne reçoit qu’une notification, pour le compte le plus récent', async () => {
    const old = sub({ user_id: 'old', created_at: '2026-10-01T00:00:00Z' })
    const recent = sub({ user_id: 'new', created_at: '2026-11-10T00:00:00Z' })
    const { deps, log } = fake([old, recent], { old: data(), new: data() })
    await run(deps, SAT_2045)
    expect(log.sent).toEqual(['new:Ta journée est finie ?'])
  })

  it('rien à faire sans abonnés', async () => {
    const { deps } = fake([], {})
    expect(await run(deps, SAT_2045)).toMatchObject({ checked: 0, sent: 0 })
  })
})
