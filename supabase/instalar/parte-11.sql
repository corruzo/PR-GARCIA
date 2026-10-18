-- PRGARCÍA · Instalación, parte 11 de 11. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 11) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261018000100_endurecimiento.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261018000100') then raise exception 'La migración 20261018000100 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
revoke insert, update on public.user_history from authenticated;
revoke insert, update on public.clientes from authenticated;
grant insert (tipo_documento, numero_documento, nombre, telefono, email, direccion, referencia, notas,
  limite_credito_cents, moneda_limite, estado) on public.clientes to authenticated;
grant update (tipo_documento, numero_documento, nombre, telefono, email, direccion, referencia, notas,
  limite_credito_cents, moneda_limite, estado) on public.clientes to authenticated;
alter table public.prestamos drop constraint if exists prestamos_inicio_reciente;
alter table public.prestamos add constraint prestamos_inicio_reciente
  check (fecha_inicio >= (created_at at time zone 'America/Caracas')::date - 3660) not valid;
insert into public.app_migraciones (version) values ('20261018000100') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261018000100') on conflict do nothing;
commit;
