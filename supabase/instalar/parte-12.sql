-- PRGARCÍA · Instalación, parte 12 de 12. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 12) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261018000200_tasa_bcv_solo_oficial.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261018000200') then raise exception 'La migración 20261018000200 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
update public.tasa_bcv set estado = 'referencial'
where estado = 'ok' and fuente ilike '%dolarapi%';
insert into public.app_migraciones (version) values ('20261018000200') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261018000200') on conflict do nothing;
commit;
