-- ════════════════════════════════════════════════════════════════════════════
-- Fase 6 · Bitácora de auditoría inmutable.
-- Registra cada alta, cambio o baja de clientes, préstamos y pagos con el
-- antes/después. Nadie (ni el dueño) puede modificarla desde la API.
-- ════════════════════════════════════════════════════════════════════════════

create table public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  actor_id uuid,
  tabla text not null,
  registro_id uuid not null,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
create index auditoria_user_fecha_idx on public.auditoria (user_id, creado_en desc);
create index auditoria_registro_idx on public.auditoria (registro_id);

alter table public.auditoria enable row level security;
create policy auditoria_select on public.auditoria for select to authenticated using (user_id = auth.uid());
revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate on public.auditoria from authenticated;
grant select on public.auditoria to authenticated;

create or replace function public.fin_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
begin
  -- Evita ruido: un UPDATE sin cambios reales no se registra.
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;
  insert into public.auditoria (user_id, actor_id, tabla, registro_id, accion, antes, despues)
  values ((fila ->> 'user_id')::uuid, auth.uid(), tg_table_name, (fila ->> 'id')::uuid, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.fin_auditar() from public, anon, authenticated;

create trigger clientes_auditoria after insert or update or delete on public.clientes
  for each row execute function public.fin_auditar();
create trigger prestamos_auditoria after insert or update or delete on public.prestamos
  for each row execute function public.fin_auditar();
create trigger pagos_auditoria after insert or update or delete on public.pagos
  for each row execute function public.fin_auditar();
