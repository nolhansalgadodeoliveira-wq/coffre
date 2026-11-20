-- ============================================================
--  Coffre : préparation de la base de données (à faire UNE fois)
--  Supabase → SQL Editor → New query → coller tout → Run.
--  Sans danger si tu le relances.
-- ============================================================

-- 1. Les données de chaque utilisateur : une seule ligne par compte
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  version    integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;

drop policy if exists "lire ses données"      on public.user_data;
drop policy if exists "créer ses données"     on public.user_data;
drop policy if exists "modifier ses données"  on public.user_data;
drop policy if exists "supprimer ses données" on public.user_data;
create policy "lire ses données"      on public.user_data for select using (auth.uid() = user_id);
create policy "créer ses données"     on public.user_data for insert with check (auth.uid() = user_id);
create policy "modifier ses données"  on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supprimer ses données" on public.user_data for delete using (auth.uid() = user_id);

-- 2. Réglages publics de l'app (clé publique des notifications)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
drop policy if exists "lecture publique" on public.app_settings;
create policy "lecture publique" on public.app_settings for select using (true);

-- 3. Les téléphones inscrits aux rappels de fin de journée (chacun ne voit que les siens)
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
drop policy if exists "lire ses rappels"      on public.reminders;
drop policy if exists "créer ses rappels"     on public.reminders;
drop policy if exists "modifier ses rappels"  on public.reminders;
drop policy if exists "supprimer ses rappels" on public.reminders;
create policy "lire ses rappels"      on public.reminders for select using (auth.uid() = user_id);
create policy "créer ses rappels"     on public.reminders for insert with check (auth.uid() = user_id);
create policy "modifier ses rappels"  on public.reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supprimer ses rappels" on public.reminders for delete using (auth.uid() = user_id);

-- 4. Droits d'accès. Les projets récents ne les donnent plus automatiquement : sans cette partie,
--    l'app reçoit « permission denied for table user_data ». La sécurité reste assurée par les règles ci-dessus
--    (chacun ne voit que sa propre ligne).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.user_data   to authenticated;
grant select, insert, update, delete on public.reminders   to authenticated;
grant select                         on public.app_settings to anon, authenticated;
grant all on public.user_data, public.reminders, public.app_settings to service_role;
