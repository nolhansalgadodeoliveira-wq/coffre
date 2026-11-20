// Ce que l'assistant « Rappels » fait copier à l'utilisateur : le code de la fonction Supabase (en un seul fichier)
// et le script SQL (tables, règles de sécurité, clé publique, planification toutes les 15 minutes).

import indexSrc from '../../supabase/functions/reminders/index.ts?raw'
import logicSrc from '../../supabase/functions/reminders/logic.ts?raw'

/** Code complet de la fonction « reminders », en un seul fichier (à coller dans l'éditeur de Supabase). */
export function singleFileFunction(): string {
  const lines = indexSrc.split('\n')
  const imports = lines.filter((l) => /^import .* from 'npm:/.test(l))
  const body = lines.filter((l) => !/^import /.test(l))
  return `${imports.join('\n')}\n\n${logicSrc.trim()}\n\n${body.join('\n').trim()}\n`
}

export function setupSql(o: { publicKey: string; functionUrl: string; cronSecret: string }): string {
  const q = (s: string) => s.replace(/'/g, "''")
  return `-- Rappels de fin de journée : à coller dans Supabase → SQL Editor → New query → Run.
-- Sans danger si tu le relances.

-- 1. La clé publique d'envoi (lisible par l'app, elle n'a rien de secret)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
drop policy if exists "lecture publique" on public.app_settings;
create policy "lecture publique" on public.app_settings for select using (true);
insert into public.app_settings (key, value) values ('vapid_public', '${q(o.publicKey)}')
  on conflict (key) do update set value = excluded.value;

-- 2. Les téléphones inscrits aux rappels (chacun ne voit que les siens)
create table if not exists public.reminders (
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  remind_at  text not null default '20:30',
  timezone   text not null default 'Europe/Paris',
  last_sent  date,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.reminders enable row level security;
drop policy if exists "lire ses rappels" on public.reminders;
drop policy if exists "créer ses rappels" on public.reminders;
drop policy if exists "modifier ses rappels" on public.reminders;
drop policy if exists "supprimer ses rappels" on public.reminders;
create policy "lire ses rappels"      on public.reminders for select using (auth.uid() = user_id);
create policy "créer ses rappels"     on public.reminders for insert with check (auth.uid() = user_id);
create policy "modifier ses rappels"  on public.reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supprimer ses rappels" on public.reminders for delete using (auth.uid() = user_id);
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.reminders to authenticated;
grant select on public.app_settings to anon, authenticated;
grant all on public.reminders, public.app_settings to service_role;

-- 3. Toutes les 15 minutes, le serveur regarde qui doit être prévenu
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('coffre-rappels') where exists (select 1 from cron.job where jobname = 'coffre-rappels');
select cron.schedule('coffre-rappels', '*/15 * * * *', $job$
  select net.http_post(
    url     := '${q(o.functionUrl)}',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "${q(o.cronSecret)}"}'::jsonb,
    body    := '{}'::jsonb
  );
$job$);
`
}
