-- PRGARCÍA · Instalación, parte 6 de 12. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 12) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261013000100_cliente_rapido.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261013000100') then raise exception 'La migración 20261013000100 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
alter table public.clientes alter column numero_documento drop not null;
alter table public.clientes alter column tipo_documento set default 'V';
insert into public.app_migraciones (version) values ('20261013000100') on conflict do nothing;
commit;
