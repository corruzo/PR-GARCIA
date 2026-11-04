-- PRGARCÍA · Instalación, parte 13 de 13. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 13) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261104000100_cuota_final_corta.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261104000100') then raise exception 'La migración 20261104000100 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
create or replace function public.fin_cronograma(
  p_capital_cents bigint, p_tasa numeric, p_modalidad text,
  p_inicio date, p_fin date, p_frecuencia text, p_metodo text
) returns table (
  numero integer, fecha_vencimiento date, dias integer,
  capital_cents bigint, interes_cents bigint, total_cents bigint, saldo_cents bigint
) language plpgsql immutable set search_path = '' as $$
declare
  dias_total integer := p_fin - p_inicio;
  intervalo integer := public.fin_dias_frecuencia(p_frecuencia);
  base integer := public.fin_dias_modalidad(p_modalidad);
  n integer;
  resto integer;
  fechas date[] := '{}';
  periodos bigint[] := '{}';
  capitales bigint[];
  intereses bigint[] := '{}';
  unos bigint[];
  saldo bigint;
begin
  perform public.fin_validar_terminos('USD', p_capital_cents, p_tasa, p_modalidad, p_inicio, p_fin, p_frecuencia, p_metodo);
  n := dias_total / intervalo;
  resto := dias_total % intervalo;
  if n = 0 or (resto > 0 and 3 * resto >= intervalo) then n := n + 1; end if;
  for i in 1..n loop
    fechas[i] := case when i = n then p_fin else p_inicio + i * intervalo end;
    periodos[i] := fechas[i] - (case when i = 1 then p_inicio else fechas[i - 1] end);
  end loop;
  unos := array_fill(1::bigint, array[n]);
  capitales := public.fin_repartir(p_capital_cents, unos);
  if p_metodo = 'saldo_insoluto' then
    saldo := p_capital_cents;
    for i in 1..n loop
      intereses[i] := public.fin_interes_simple(saldo, p_tasa, periodos[i]::integer, base);
      saldo := saldo - capitales[i];
    end loop;
  else
    intereses := public.fin_repartir(public.fin_interes_simple(p_capital_cents, p_tasa, dias_total, base), periodos);
  end if;
  saldo := p_capital_cents;
  for i in 1..n loop
    saldo := saldo - capitales[i];
    numero := i;
    fecha_vencimiento := fechas[i];
    dias := periodos[i]::integer;
    capital_cents := capitales[i];
    interes_cents := intereses[i];
    total_cents := capitales[i] + intereses[i];
    saldo_cents := saldo;
    return next;
  end loop;
end;
$$;
insert into public.app_migraciones (version) values ('20261104000100') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261104000100') on conflict do nothing;
commit;
