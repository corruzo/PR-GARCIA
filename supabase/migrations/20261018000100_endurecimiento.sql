-- ════════════════════════════════════════════════════════════════════════════
-- Endurecimiento (revisión de seguridad del 18/10/2026).
--
--   * user_history es de la versión anterior y la app ya no la usa: deja de
--     aceptar filas nuevas (permitía llenar la base con JSON de 64 KB).
--   * clientes: el navegador solo puede escribir las columnas de la ficha;
--     id, user_id, created_at y updated_at quedan a cargo de la base.
--   * prestamos: la fecha de desembolso no puede ser de hace más de 10 años
--     (un préstamo abierto diario de 1990 generaría miles de períodos).
-- ════════════════════════════════════════════════════════════════════════════

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
