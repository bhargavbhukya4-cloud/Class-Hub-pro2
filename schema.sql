set check_function_bodies = off;

create table if not exists public.docs (
  path text primary key,
  parent text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists docs_parent_idx on public.docs (parent);

alter table public.docs replica identity full;

alter table public.docs enable row level security;

create or replace function public.is_member(cid text) returns boolean language sql stable security definer set search_path = public as $fn$ select exists (select 1 from public.docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved') $fn$;

create or replace function public.is_admin(cid text) returns boolean language sql stable security definer set search_path = public as $fn$ select exists (select 1 from public.docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved' and data->>'r' in ('owner','admin')) $fn$;

create or replace function public.is_owner(cid text) returns boolean language sql stable security definer set search_path = public as $fn$ select exists (select 1 from public.docs where path = 'classes/' || cid || '/mem/' || auth.uid()::text and data->>'s' = 'approved' and data->>'r' = 'owner') $fn$;

create or replace function public.is_creator(cid text) returns boolean language sql stable security definer set search_path = public as $fn$ select exists (select 1 from public.docs where path = 'classes/' || cid and data->>'own' = auth.uid()::text) $fn$;

create or replace function public.r_ok(p text, d jsonb) returns boolean language sql stable security definer set search_path = public as $fn$ select case when auth.uid() is null then false when split_part(p,'/',1) = 'data' then split_part(p,'/',3) = auth.uid()::text when split_part(p,'/',1) = 'c' then public.is_member(split_part(p,'/',2)) when split_part(p,'/',1) = 'classes' and split_part(p,'/',3) = '' then true when split_part(p,'/',1) = 'classes' and split_part(p,'/',3) = 'mem' then (split_part(p,'/',4) = auth.uid()::text or public.is_member(split_part(p,'/',2))) else false end $fn$;

create or replace function public.w_ok(p text, d jsonb, ins boolean) returns boolean language sql stable security definer set search_path = public as $fn$ select case when auth.uid() is null then false when split_part(p,'/',1) = 'data' then split_part(p,'/',3) = auth.uid()::text when split_part(p,'/',1) = 'c' then (public.is_member(split_part(p,'/',2)) and (split_part(p,'/',3) not in ('cfg','asg','ann') or public.is_admin(split_part(p,'/',2)))) when split_part(p,'/',1) = 'classes' and split_part(p,'/',3) = '' then (case when ins then d->>'own' = auth.uid()::text else public.is_admin(split_part(p,'/',2)) end) when split_part(p,'/',1) = 'classes' and split_part(p,'/',3) = 'mem' then (case when ins then (split_part(p,'/',4) = auth.uid()::text and ((d->>'s' = 'pending' and d->>'r' = 'member') or (d->>'s' = 'approved' and d->>'r' = 'owner' and public.is_creator(split_part(p,'/',2))))) else (public.is_owner(split_part(p,'/',2)) or (public.is_admin(split_part(p,'/',2)) and d->>'r' <> 'owner')) end) else false end $fn$;

create or replace function public.d_ok(p text, d jsonb) returns boolean language sql stable security definer set search_path = public as $fn$ select case when auth.uid() is null then false when split_part(p,'/',1) = 'data' then split_part(p,'/',3) = auth.uid()::text when split_part(p,'/',1) = 'c' then (public.is_member(split_part(p,'/',2)) and (split_part(p,'/',3) not in ('cfg','asg','ann') or public.is_admin(split_part(p,'/',2)))) when split_part(p,'/',1) = 'classes' and split_part(p,'/',3) = 'mem' then ((split_part(p,'/',4) = auth.uid()::text and d->>'s' <> 'blocked' and d->>'r' <> 'owner') or (public.is_admin(split_part(p,'/',2)) and d->>'r' <> 'owner')) else false end $fn$;

drop policy if exists docs_select on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;

create policy docs_select on public.docs for select to authenticated using (public.r_ok(path, data));

create policy docs_insert on public.docs for insert to authenticated with check (public.w_ok(path, data, true));

create policy docs_update on public.docs for update to authenticated using (public.w_ok(path, data, false)) with check (public.w_ok(path, data, false));

create policy docs_delete on public.docs for delete to authenticated using (public.d_ok(path, data));

insert into storage.buckets (id, name, public, file_size_limit) values ('class-files', 'class-files', false, 20971520) on conflict (id) do nothing;

drop policy if exists cf_select on storage.objects;
drop policy if exists cf_insert on storage.objects;
drop policy if exists cf_delete on storage.objects;

create policy cf_select on storage.objects for select to authenticated using (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));

create policy cf_insert on storage.objects for insert to authenticated with check (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));

create policy cf_delete on storage.objects for delete to authenticated using (bucket_id = 'class-files' and public.is_member(split_part(name, '/', 1)));

alter publication supabase_realtime add table public.docs;
