-- PRGARCÍA · Instalación, parte 8 de 8. Generado por npm run db:bundle.
-- Ejecuta en orden solo las partes que aún no aplicaste (1 a 8) en Supabase → SQL Editor, una sola vez cada una.
begin;
-- 20261014000200_correcciones_pagos.sql
create table if not exists public.app_migraciones (version text primary key, aplicada_en timestamptz not null default now());
alter table public.app_migraciones enable row level security;
revoke all on public.app_migraciones from anon, authenticated;
do $guard$ begin if exists (select 1 from public.app_migraciones where version = '20261014000200') then raise exception 'La migración 20261014000200 ya está aplicada: no repitas esta parte.'; end if; end $guard$;
drop function if exists public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid);
create or replace function public.registrar_pago(
  p_prestamo_id uuid,
  p_fecha date,
  p_moneda_pago text,
  p_monto_pago_cents bigint,
  p_tasa_cambio numeric,
  p_tipo text default 'cuota',
  p_modo_abono text default 'reducir_plazo',
  p_metodo text default 'efectivo',
  p_referencia text default null,
  p_notas text default null,
  p_idempotency_key uuid default null,
  p_confirmar_tasa boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  p public.prestamos;
  c public.cuotas;
  pago uuid;
  restante bigint;
  monto bigint;
  aplicar bigint;
  ultima_fecha date;
  pendientes uuid[];
  pesos bigint[];
  partes bigint[];
  saldo bigint;
  nuevo_interes bigint;
  descuento bigint;
  base integer;
  inicio_periodo date;
  asiento uuid;
  t_mora bigint;
  t_interes bigint;
  t_capital bigint;
  solo_interes boolean;
begin
  if p_idempotency_key is not null then
    select id into pago from public.pagos where user_id = uid and idempotency_key = p_idempotency_key;
    if found then return pago; end if;
  end if;
  select * into p from public.prestamos where id = p_prestamo_id and user_id = uid for update;
  if not found then raise exception 'Préstamo no encontrado' using errcode = 'P0002'; end if;
  if p.estado <> 'activo' then raise exception 'El préstamo no está activo' using errcode = '22023'; end if;
  if p_tipo is null or p_tipo not in ('cuota', 'abono_capital') then raise exception 'Tipo de pago inválido' using errcode = '22023'; end if;
  if p_tipo = 'abono_capital' and (p_modo_abono is null or p_modo_abono not in ('reducir_plazo', 'reducir_cuota')) then
    raise exception 'Modo de abono inválido' using errcode = '22023';
  end if;
  if p_metodo is null or p_metodo not in ('efectivo', 'transferencia', 'pago_movil', 'zelle', 'otro') then
    raise exception 'Método de pago inválido' using errcode = '22023';
  end if;
  if p_moneda_pago is null or p_moneda_pago not in ('USD', 'VES') then raise exception 'Moneda inválida' using errcode = '22023'; end if;
  if p_monto_pago_cents is null or p_monto_pago_cents < 1 or p_monto_pago_cents > 9000000000000000 then
    raise exception 'Monto de pago inválido' using errcode = '22023';
  end if;
  if p_tasa_cambio is null or p_tasa_cambio <= 0 or p_tasa_cambio > 1000000000000 or p_tasa_cambio <> round(p_tasa_cambio, 8) then
    raise exception 'Tasa de cambio inválida' using errcode = '22023';
  end if;
  if p_moneda_pago <> p.moneda or p.moneda = 'VES' then
    perform public.fin_validar_tasa_cambio(p_tasa_cambio, p_confirmar_tasa);
  end if;
  if p_fecha is null or p_fecha < p.fecha_inicio then
    raise exception 'La fecha del pago no puede ser anterior al inicio del préstamo' using errcode = '22023';
  end if;
  if p_fecha > public.fin_hoy() then raise exception 'La fecha del pago no puede ser futura' using errcode = '22023'; end if;
  select max(fecha) into ultima_fecha from public.pagos where prestamo_id = p.id and estado = 'aplicado';
  if ultima_fecha is not null and p_fecha < ultima_fecha then
    raise exception 'Los pagos deben registrarse en orden cronológico (último pago: %)', to_char(ultima_fecha, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  solo_interes := p.moneda = 'USD' and p_moneda_pago = 'VES';
  monto := public.fin_convertir(p_monto_pago_cents, p_tasa_cambio, p_moneda_pago, p.moneda);
  if monto < 1 then raise exception 'El monto convertido es menor a un centavo' using errcode = '22023'; end if;
  insert into public.pagos (user_id, prestamo_id, fecha, tipo, modo_abono, metodo, referencia, notas, moneda_pago,
    monto_pago_cents, tasa_cambio, monto_prestamo_cents, idempotency_key)
  values (uid, p.id, p_fecha, p_tipo, case when p_tipo = 'abono_capital' then p_modo_abono end, p_metodo,
    public.fin_texto_seguro(p_referencia, 80), public.fin_texto_seguro(p_notas, 500), p_moneda_pago,
    p_monto_pago_cents, p_tasa_cambio, monto, p_idempotency_key)
  returning id into pago;
  if p.tipo_plazo = 'abierto' then perform public.fin_sincronizar_abierto(p.id, p_fecha); end if;
  perform public.fin_devengar_mora(p.id, p_fecha, pago);
  restante := monto;
  for c in
    select * from public.cuotas
    where prestamo_id = p.id and estado <> 'anulada' and estado <> 'pagada'
      and ((p_tipo = 'cuota' and p.tipo_plazo = 'fijo') or fecha_vencimiento <= p_fecha)
    order by numero
    for update
  loop
    exit when restante = 0;
    aplicar := least(restante, c.mora_devengada_cents - c.mora_pagada_cents);
    if aplicar > 0 then
      update public.cuotas set mora_pagada_cents = mora_pagada_cents + aplicar where id = c.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, c.id, 'mora', aplicar);
      restante := restante - aplicar;
    end if;
    aplicar := least(restante, c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents);
    if aplicar > 0 then
      update public.cuotas set interes_pagado_cents = interes_pagado_cents + aplicar where id = c.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, c.id, 'interes', aplicar);
      restante := restante - aplicar;
    end if;
    continue when solo_interes;
    aplicar := least(restante, c.capital_cents - c.capital_pagado_cents);
    if aplicar > 0 then
      update public.cuotas set capital_pagado_cents = capital_pagado_cents + aplicar where id = c.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, c.id, 'capital', aplicar);
      restante := restante - aplicar;
    end if;
  end loop;
  if not solo_interes and p.tipo_plazo = 'fijo' and p_tipo = 'abono_capital' and restante > 0 then
    select array_agg(id order by numero), array_agg(capital_cents - capital_pagado_cents order by numero)
      into pendientes, pesos
    from public.cuotas
    where prestamo_id = p.id and estado <> 'anulada' and capital_cents > capital_pagado_cents;
    if pendientes is not null then
      if p_modo_abono = 'reducir_cuota' then
        partes := public.fin_repartir(least(restante, (select sum(x) from unnest(pesos) x))::bigint, pesos);
      else
        partes := array_fill(0::bigint, array[array_length(pesos, 1)]);
        for i in reverse array_length(pesos, 1)..1 loop
          partes[i] := least(restante - coalesce((select sum(x) from unnest(partes) x), 0), pesos[i]);
        end loop;
      end if;
      for i in 1..array_length(pendientes, 1) loop
        if partes[i] > 0 then
          update public.cuotas set capital_pagado_cents = capital_pagado_cents + partes[i] where id = pendientes[i];
          insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents)
          values (pago, uid, pendientes[i], 'capital', partes[i]);
          restante := restante - partes[i];
        end if;
      end loop;
    end if;
  end if;
  if not solo_interes and p.tipo_plazo = 'abierto' and restante > 0 then
    select capital_cents - capital_pagado_cents into aplicar from public.prestamos where id = p.id;
    aplicar := least(restante, aplicar);
    if aplicar > 0 then
      update public.prestamos set capital_pagado_cents = capital_pagado_cents + aplicar where id = p.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, null, 'capital', aplicar);
      restante := restante - aplicar;
    end if;
  end if;
  if p.metodo_interes = 'saldo_insoluto' then
    base := public.fin_dias_modalidad(p.modalidad_tasa);
    for c in
      select * from public.cuotas
      where prestamo_id = p.id and estado <> 'anulada' and fecha_vencimiento > p_fecha
      order by numero for update
    loop
      inicio_periodo := c.fecha_vencimiento - c.dias;
      select coalesce(sum(a.monto_cents), 0) into saldo
      from public.aplicaciones_pago a left join public.cuotas cc on cc.id = a.cuota_id
      where a.pago_id = pago and a.concepto = 'capital' and (a.cuota_id is null or cc.numero >= c.numero);
      continue when saldo = 0;
      nuevo_interes := public.fin_interes_simple(saldo, p.tasa_interes,
        c.fecha_vencimiento - greatest(inicio_periodo, p_fecha), base);
      descuento := least(nuevo_interes, c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents);
      if descuento > 0 then
        update public.cuotas set interes_descontado_cents = interes_descontado_cents + descuento where id = c.id;
        insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents)
        values (pago, uid, c.id, 'descuento_interes', descuento);
      end if;
    end loop;
  end if;
  if (p_tipo = 'abono_capital' or p.tipo_plazo = 'abierto') and restante > 0 then
    for c in
      select * from public.cuotas where prestamo_id = p.id and estado <> 'anulada' order by numero for update
    loop
      exit when restante = 0;
      aplicar := least(restante, c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents);
      if aplicar > 0 then
        update public.cuotas set interes_pagado_cents = interes_pagado_cents + aplicar where id = c.id;
        insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, c.id, 'interes', aplicar);
        restante := restante - aplicar;
      end if;
    end loop;
  end if;
  if restante > 0 then
    if solo_interes then
      raise exception 'Préstamo en dólares: en bolívares solo se reciben intereses y mora. Sobran % USD que deben pagarse en dólares.',
        public.fin_formato_monto(restante) using errcode = '22023';
    end if;
    raise exception 'El pago excede el saldo pendiente por % %', public.fin_formato_monto(restante), p.moneda using errcode = '22023';
  end if;
  perform public.fin_actualizar_estados(p.id, p_fecha);
  select coalesce(sum(monto_cents) filter (where concepto = 'mora'), 0),
         coalesce(sum(monto_cents) filter (where concepto = 'interes'), 0),
         coalesce(sum(monto_cents) filter (where concepto = 'capital'), 0)
    into t_mora, t_interes, t_capital
  from public.aplicaciones_pago where pago_id = pago;
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, pago_id, moneda, tasa_cambio, descripcion)
  values (uid, p_fecha, 'cobro', p.id, pago, p.moneda, p_tasa_cambio, 'Cobro préstamo #' || p.numero)
  returning id into asiento;
  perform public.fin_linea(asiento, uid, 'caja', monto, 0, p.moneda, p_tasa_cambio, p_moneda_pago, p_monto_pago_cents);
  perform public.fin_linea(asiento, uid, 'cartera_capital', 0, t_capital, p.moneda, p_tasa_cambio);
  perform public.fin_linea(asiento, uid, 'ingreso_interes', 0, t_interes, p.moneda, p_tasa_cambio);
  perform public.fin_linea(asiento, uid, 'ingreso_mora', 0, t_mora, p.moneda, p_tasa_cambio);
  perform public.fin_validar_asiento(asiento);
  return pago;
end;
$$;
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  motivo text := public.fin_texto_seguro(p_motivo, 300);
  pg public.pagos;
  p public.prestamos;
  a record;
  m record;
  original uuid;
  asiento uuid;
  linea record;
begin
  if motivo is null then raise exception 'Indica el motivo de la anulación' using errcode = '22023'; end if;
  select * into pg from public.pagos where id = p_pago_id and user_id = uid;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  select * into p from public.prestamos where id = pg.prestamo_id for update;
  select * into pg from public.pagos where id = p_pago_id for update;
  if pg.estado <> 'aplicado' then raise exception 'El pago ya está anulado' using errcode = '22023'; end if;
  if exists (select 1 from public.pagos where prestamo_id = pg.prestamo_id and estado = 'aplicado'
             and (fecha, created_at) > (pg.fecha, pg.created_at)) then
    raise exception 'Solo se puede anular el último pago del préstamo' using errcode = '22023';
  end if;
  for a in select * from public.aplicaciones_pago where pago_id = pg.id loop
    if a.cuota_id is null then
      update public.prestamos set capital_pagado_cents = capital_pagado_cents - a.monto_cents where id = pg.prestamo_id;
      continue;
    end if;
    update public.cuotas set
      mora_pagada_cents = mora_pagada_cents - case when a.concepto = 'mora' then a.monto_cents else 0 end,
      interes_pagado_cents = interes_pagado_cents - case when a.concepto = 'interes' then a.monto_cents else 0 end,
      capital_pagado_cents = capital_pagado_cents - case when a.concepto = 'capital' then a.monto_cents else 0 end,
      interes_descontado_cents = interes_descontado_cents - case when a.concepto = 'descuento_interes' then a.monto_cents else 0 end
    where id = a.cuota_id;
  end loop;
  for m in select * from public.pagos_mora where pago_id = pg.id order by id desc loop
    update public.cuotas set mora_devengada_cents = mora_devengada_cents - m.mora_cents,
      mora_calculada_hasta = m.calculada_hasta_anterior
    where id = m.cuota_id;
  end loop;
  update public.pagos set estado = 'anulado', anulado_motivo = motivo, anulado_en = now() where id = pg.id;
  if p.estado = 'pagado' then update public.prestamos set estado = 'activo' where id = p.id; end if;
  perform public.fin_actualizar_estados(p.id, pg.fecha);
  if p.tipo_plazo = 'abierto' then
    perform public.fin_recalcular_abierto_desde(p.id, pg.fecha);
    perform public.fin_sincronizar_abierto(p.id, public.fin_hoy());
    perform public.fin_actualizar_estados(p.id, pg.fecha);
  end if;
  select id into original from public.asientos where pago_id = pg.id and tipo = 'cobro';
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, pago_id, moneda, tasa_cambio, descripcion)
  values (uid, public.fin_hoy(), 'reverso_cobro', p.id, pg.id, p.moneda, pg.tasa_cambio,
    'Anulación de cobro préstamo #' || p.numero || ': ' || motivo)
  returning id into asiento;
  for linea in select * from public.asiento_lineas where asiento_id = original loop
    insert into public.asiento_lineas (asiento_id, user_id, cuenta, debe_cents, haber_cents, equivalente_usd_cents,
      moneda_original, monto_original_cents)
    values (asiento, uid, linea.cuenta, linea.haber_cents, linea.debe_cents, linea.equivalente_usd_cents,
      linea.moneda_original, linea.monto_original_cents);
  end loop;
  perform public.fin_validar_asiento(asiento);
end;
$$;
create or replace function public.anular_pagos_desde(p_pago_id uuid, p_motivo text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  objetivo public.pagos;
  siguiente uuid;
  total integer := 0;
begin
  select * into objetivo from public.pagos where id = p_pago_id and user_id = uid;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  if objetivo.estado <> 'aplicado' then raise exception 'El pago ya está anulado' using errcode = '22023'; end if;
  perform 1 from public.prestamos where id = objetivo.prestamo_id for update;
  loop
    select id into siguiente from public.pagos
    where prestamo_id = objetivo.prestamo_id and estado = 'aplicado'
      and (fecha, created_at) >= (objetivo.fecha, objetivo.created_at)
    order by fecha desc, created_at desc limit 1;
    exit when siguiente is null;
    perform public.anular_pago(siguiente, p_motivo);
    total := total + 1;
  end loop;
  return total;
end;
$$;
create or replace function public.fin_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los registros de % no se pueden modificar', tg_table_name using errcode = '42501';
  end if;
  if pg_trigger_depth() <= 1 then
    raise exception 'Los registros de % no se pueden borrar', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;
create or replace function public.fin_pago_inmutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() <= 1 then
      raise exception 'Los pagos no se pueden borrar; anúlalos' using errcode = '42501';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - array['estado', 'anulado_motivo', 'anulado_en'])
     <> (to_jsonb(old) - array['estado', 'anulado_motivo', 'anulado_en'])
     or (old.estado = 'anulado' and new.estado <> 'anulado') then
    raise exception 'Un pago solo admite su anulación' using errcode = '42501';
  end if;
  return new;
end;
$$;
create or replace function public.fin_sin_borrado()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'Los registros de % no se pueden borrar; anúlalos', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger auditoria_inmutable before update or delete on public.auditoria
  for each row execute function public.fin_inmutable();
create trigger asientos_inmutable before update or delete on public.asientos
  for each row execute function public.fin_inmutable();
create trigger asiento_lineas_inmutable before update or delete on public.asiento_lineas
  for each row execute function public.fin_inmutable();
create trigger aplicaciones_pago_inmutable before update or delete on public.aplicaciones_pago
  for each row execute function public.fin_inmutable();
create trigger pagos_mora_inmutable before update or delete on public.pagos_mora
  for each row execute function public.fin_inmutable();
create trigger pagos_inmutable before update or delete on public.pagos
  for each row execute function public.fin_pago_inmutable();
create trigger prestamos_sin_borrado before delete on public.prestamos
  for each row execute function public.fin_sin_borrado();
create trigger cuotas_sin_borrado before delete on public.cuotas
  for each row execute function public.fin_sin_borrado();
create or replace function public.fin_auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
  dueno uuid := (fila ->> 'user_id')::uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return new;
  end if;
  if not exists (select 1 from auth.users where id = dueno) then
    return coalesce(new, old);
  end if;
  insert into public.auditoria (user_id, actor_id, tabla, registro_id, accion, antes, despues)
  values (dueno, auth.uid(), tg_table_name, (fila ->> 'id')::uuid, tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.fin_auditar() from public, anon, authenticated;
delete from public.auditoria a where not exists (select 1 from auth.users u where u.id = a.user_id);
alter table public.auditoria
  add constraint auditoria_user_fk foreign key (user_id) references auth.users (id) on delete cascade;
create or replace view public.v_cuotas_estado with (security_invoker = true) as
select
  c.id, c.prestamo_id, c.user_id, c.numero, c.fecha_vencimiento, c.dias,
  c.capital_cents, c.interes_cents, c.capital_pagado_cents, c.interes_pagado_cents, c.interes_descontado_cents,
  case when c.estado = 'anulada' then 0 else c.capital_cents - c.capital_pagado_cents end as capital_pendiente_cents,
  case when c.estado = 'anulada' then 0 else c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents end as interes_pendiente_cents,
  case when c.estado = 'anulada' then 0 else c.mora_devengada_cents - c.mora_pagada_cents
    + public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, public.fin_hoy()) end as mora_pendiente_cents,
  c.mora_pagada_cents,
  c.estado, c.pagada_en,
  case when c.estado in ('pagada', 'anulada') then 0
       else greatest(public.fin_hoy() - c.fecha_vencimiento, 0) end as dias_atraso,
  case
    when c.estado = 'anulada' then 'anulada'
    when c.estado = 'pagada' then 'pagada'
    when c.fecha_vencimiento < public.fin_hoy() then 'vencida'
    when c.fecha_vencimiento = public.fin_hoy() then 'vence_hoy'
    when c.fecha_vencimiento <= public.fin_hoy() + 7 then 'por_vencer'
    else 'al_dia' end as situacion
from public.cuotas c
join public.prestamos p on p.id = c.prestamo_id;
create or replace view public.v_prestamos_resumen with (security_invoker = true) as
select
  p.id, p.user_id, p.numero, p.cliente_id, cl.nombre as cliente_nombre,
  cl.tipo_documento || '-' || cl.numero_documento as cliente_documento, cl.telefono as cliente_telefono,
  p.moneda, p.capital_cents, p.interes_total_cents, p.total_cents, p.tasa_interes, p.modalidad_tasa,
  p.frecuencia_pago, p.metodo_interes, p.fecha_inicio, p.fecha_fin, p.tasa_cambio, p.fuente_tasa_cambio,
  p.tasa_mora_diaria, p.dias_gracia, p.estado, p.notas, p.created_at,
  (case when p.estado = 'anulado' then 0
        when p.tipo_plazo = 'abierto' then p.capital_cents - p.capital_pagado_cents
        else coalesce(sum(v.capital_pendiente_cents), 0) end)::bigint as capital_pendiente_cents,
  coalesce(sum(v.interes_pendiente_cents), 0)::bigint as interes_pendiente_cents,
  coalesce(sum(v.mora_pendiente_cents), 0)::bigint as mora_pendiente_cents,
  (coalesce(sum(v.capital_pagado_cents + v.interes_pagado_cents + v.mora_pagada_cents), 0) + p.capital_pagado_cents)::bigint as cobrado_cents,
  coalesce(sum(v.capital_pendiente_cents + v.interes_pendiente_cents + v.mora_pendiente_cents)
    filter (where v.situacion in ('vencida', 'vence_hoy')), 0)::bigint as exigible_hoy_cents,
  coalesce(max(v.dias_atraso), 0) as dias_atraso,
  min(v.fecha_vencimiento) filter (where v.situacion not in ('pagada', 'anulada')) as proximo_vencimiento,
  count(*) filter (where v.situacion = 'vencida') as cuotas_vencidas,
  count(*) filter (where v.situacion = 'pagada') as cuotas_pagadas,
  count(*) filter (where v.situacion <> 'anulada') as cuotas_total,
  p.tipo_plazo,
  coalesce(sum(v.interes_cents - v.interes_descontado_cents) filter (where v.situacion <> 'anulada'), 0)::bigint as interes_generado_cents
from public.prestamos p
join public.clientes cl on cl.id = p.cliente_id
left join public.v_cuotas_estado v on v.prestamo_id = p.id
group by p.id, cl.id;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
revoke execute on function
  public.fin_hoy(),
  public.fin_div_half_even(numeric, numeric),
  public.fin_interes_simple(bigint, numeric, integer, integer),
  public.fin_convertir(bigint, numeric, text, text),
  public.fin_repartir(bigint, bigint[]),
  public.fin_dias_modalidad(text),
  public.fin_dias_frecuencia(text),
  public.fin_validar_terminos(text, bigint, numeric, text, date, date, text, text),
  public.fin_cronograma(bigint, numeric, text, date, date, text, text),
  public.fin_texto_seguro(text, integer),
  public.fin_mora_adicional(public.cuotas, numeric, integer, date),
  public.fin_touch_updated_at(),
  public.previsualizar_cronograma(bigint, numeric, text, date, date, text, text),
  public.fin_validar_tasa_cambio(numeric, boolean),
  public.fin_formato_monto(bigint),
  public.fin_devengar_mora(uuid, date, uuid),
  public.fin_recalcular_abierto_desde(uuid, date),
  public.fin_inmutable(),
  public.fin_pago_inmutable(),
  public.fin_sin_borrado()
from public, anon;
revoke execute on function
  public.fin_devengar_mora(uuid, date, uuid),
  public.fin_recalcular_abierto_desde(uuid, date),
  public.fin_validar_tasa_cambio(numeric, boolean),
  public.fin_texto_seguro(text, integer),
  public.fin_touch_updated_at(),
  public.fin_inmutable(),
  public.fin_pago_inmutable(),
  public.fin_sin_borrado()
from authenticated;
grant execute on function
  public.fin_hoy(),
  public.fin_div_half_even(numeric, numeric),
  public.fin_interes_simple(bigint, numeric, integer, integer),
  public.fin_convertir(bigint, numeric, text, text),
  public.fin_dias_modalidad(text),
  public.fin_dias_frecuencia(text),
  public.fin_mora_adicional(public.cuotas, numeric, integer, date),
  public.fin_repartir(bigint, bigint[]),
  public.fin_validar_terminos(text, bigint, numeric, text, date, date, text, text),
  public.fin_cronograma(bigint, numeric, text, date, date, text, text),
  public.previsualizar_cronograma(bigint, numeric, text, date, date, text, text)
to authenticated;
revoke execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) to authenticated;
revoke execute on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;
revoke execute on function public.anular_pagos_desde(uuid, text) from public, anon;
grant execute on function public.anular_pagos_desde(uuid, text) to authenticated;
insert into public.app_migraciones (version) values ('20261014000200') on conflict do nothing;
insert into public.app_migraciones (version) values ('20261014000200') on conflict do nothing;
commit;
