// Edge Function « reminders » : envoie les notifications de fin de journée (Web Push).
// Appelée toutes les 15 minutes par pg_cron (en-tête x-cron-secret), et par l'app pour « Vérifier » et « Envoyer un test ».
//
// Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:ton@email), CRON_SECRET
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildTestPayload, run, type Deps, type Sub } from './logic.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const env = (k: string) => Deno.env.get(k) ?? ''
  const VAPID_PUBLIC = env('VAPID_PUBLIC_KEY')
  const VAPID_PRIVATE = env('VAPID_PRIVATE_KEY')
  const VAPID_SUBJECT = env('VAPID_SUBJECT') || 'mailto:contact@example.com'
  const CRON_SECRET = env('CRON_SECRET')
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const body = await req.json().catch(() => ({}))

  const send: Deps['send'] = async (sub, payload) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 })
      return 'ok'
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) return 'gone'
      console.error('envoi refusé', code, (e as Error).message)
      return 'error'
    }
  }

  // Appel planifié (pg_cron)
  if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'clés VAPID manquantes' }, 500)
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    const report = await run({
      listSubs: async () => ((await db.from('reminders').select('*')).data ?? []) as Sub[],
      loadData: async (ids) => {
        const { data } = await db.from('user_data').select('user_id, data').in('user_id', ids)
        return Object.fromEntries((data ?? []).map((r: { user_id: string; data: unknown }) => [r.user_id, r.data]))
      },
      send,
      markSent: async (s, date) => {
        await db.from('reminders').update({ last_sent: date }).eq('user_id', s.user_id).eq('endpoint', s.endpoint)
      },
      removeSub: async (s) => {
        await db.from('reminders').delete().eq('user_id', s.user_id).eq('endpoint', s.endpoint)
      },
    })
    return json(report)
  }

  // Appel de l'app : l'utilisateur doit être connecté.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
  const { data: auth, error } = await db.auth.getUser(token)
  if (error || !auth.user) return json({ error: 'non autorisé' }, 401)

  if (body?.ping) {
    const pub = (await db.from('app_settings').select('value').eq('key', 'vapid_public').maybeSingle()).data?.value
    const table = await db.from('reminders').select('endpoint', { count: 'exact', head: true })
    return json({
      ok: true,
      vapid: Boolean(VAPID_PUBLIC && VAPID_PRIVATE),
      subject: Boolean(env('VAPID_SUBJECT')),
      cron: Boolean(CRON_SECRET),
      keyMatches: Boolean(pub) && pub === VAPID_PUBLIC,
      table: !table.error,
    })
  }

  if (body?.test) {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'clés VAPID manquantes' }, 500)
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    const { data: subs } = await db.from('reminders').select('*').eq('user_id', auth.user.id)
    let sent = 0
    let failed = 0
    for (const s of (subs ?? []) as Sub[]) {
      const r = await send(s, buildTestPayload())
      if (r === 'ok') sent++
      else {
        failed++
        if (r === 'gone') await db.from('reminders').delete().eq('user_id', s.user_id).eq('endpoint', s.endpoint)
      }
    }
    return json({ sent, failed })
  }
  return json({ error: 'requête inconnue' }, 400)
})
