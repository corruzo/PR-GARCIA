-- PRGARCÍA · Instalación, parte 2 de 3. Generado por npm run db:bundle.
-- Ejecuta las partes en orden (1, 2, 3) en Supabase → SQL Editor, una sola vez.
begin;
-- 20261011000200_pagos_mora.sql
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prestamo_id uuid not null,
  fecha date not null,
  tipo text not null check (tipo in ('cuota', 'abono_capital')),
  modo_abono text check (modo_abono in ('reducir_plazo', 'reducir_cuota')),
  metodo text not null check (metodo in ('efectivo', 'transferencia', 'pago_movil', 'zelle', 'otro')),
  referencia text check (referencia is null or (char_length(referencia) <= 80 and referencia !~ '[<>]')),
  notas text check (notas is null or (char_length(notas) <= 500 and notas !~ '[<>]')),
  moneda_pago text not null check (moneda_pago in ('USD', 'VES')),
  monto_pago_cents bigint not null check (monto_pago_cents > 0),
  tasa_cambio numeric(20, 8) not null check (tasa_cambio > 0),
  monto_prestamo_cents bigint not null check (monto_prestamo_cents > 0),
  estado text not null default 'aplicado' check (estado in ('aplicado', 'anulado')),
  anulado_motivo text,
  anulado_en timestamptz,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (id, user_id),
  foreign key (prestamo_id, user_id) references public.prestamos (id, user_id) on delete cascade
);
create index pagos_prestamo_fecha_idx on public.pagos (prestamo_id, fecha desc);
create index pagos_user_fecha_idx on public.pagos (user_id, fecha desc);
create table public.aplicaciones_pago (
  id bigint generated always as identity primary key,
  pago_id uuid not null,
  user_id uuid not null,
  cuota_id uuid not null references public.cuotas (id) on delete cascade,
  concepto text not null check (concepto in ('mora', 'interes', 'capital', 'descuento_interes')),
  monto_cents bigint not null check (monto_cents > 0),
  foreign key (pago_id, user_id) references public.pagos (id, user_id) on delete cascade
);
create index aplicaciones_pago_pago_idx on public.aplicaciones_pago (pago_id);
create index aplicaciones_pago_cuota_idx on public.aplicaciones_pago (cuota_id);
alter table public.asientos
  add constraint asientos_pago_fk foreign key (pago_id, user_id) references public.pagos (id, user_id) on delete cascade;
alter table public.pagos enable row level security;
alter table public.aplicaciones_pago enable row level security;
create policy pagos_select on public.pagos for select to authenticated using (user_id = auth.uid());
create policy aplicaciones_pago_select on public.aplicaciones_pago for select to authenticated using (user_id = auth.uid());
revoke all on public.pagos, public.aplicaciones_pago from anon;
revoke insert, update, delete, truncate on public.pagos, public.aplicaciones_pago from authenticated;
grant select on public.pagos, public.aplicaciones_pago to authenticated;
create or replace function public.fin_mora_adicional(c public.cuotas, p_tasa_mora numeric, p_gracia integer, p_hasta date)
returns bigint language plpgsql immutable set search_path = '' as $$
declare
  base bigint := (c.capital_cents - c.capital_pagado_cents)
               + (c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents);
  desde date := greatest(coalesce(c.mora_calculada_hasta, c.fecha_vencimiento), c.fecha_vencimiento + p_gracia);
begin
  if base <= 0 or p_tasa_mora <= 0 or c.estado = 'anulada' or p_hasta <= desde then return 0; end if;
  return public.fin_interes_simple(base, p_tasa_mora, p_hasta - desde, 1);
end;
$$;
create or replace function public.fin_devengar_mora(p_prestamo_id uuid, p_hasta date)
returns void language plpgsql set search_path = '' as $$
declare
  p public.prestamos;
  c public.cuotas;
  extra bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  for c in select * from public.cuotas where prestamo_id = p_prestamo_id and estado <> 'anulada' order by numero loop
    extra := public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, p_hasta);
    if extra > 0 then
      update public.cuotas set mora_devengada_cents = mora_devengada_cents + extra, mora_calculada_hasta = p_hasta
      where id = c.id;
    elsif c.fecha_vencimiento < p_hasta and coalesce(c.mora_calculada_hasta, c.fecha_vencimiento) < p_hasta then
      update public.cuotas set mora_calculada_hasta = p_hasta where id = c.id;
    end if;
  end loop;
end;
$$;
create or replace function public.fin_actualizar_estados(p_prestamo_id uuid, p_fecha date)
returns void language plpgsql set search_path = '' as $$
begin
  update public.cuotas c set
    estado = case
      when c.capital_pagado_cents = c.capital_cents
       and c.interes_pagado_cents + c.interes_descontado_cents = c.interes_cents
       and c.mora_pagada_cents = c.mora_devengada_cents then 'pagada'
      when c.capital_pagado_cents > 0 or c.interes_pagado_cents > 0 or c.mora_pagada_cents > 0 then 'parcial'
      else 'pendiente' end,
    pagada_en = case
      when c.capital_pagado_cents = c.capital_cents
       and c.interes_pagado_cents + c.interes_descontado_cents = c.interes_cents
       and c.mora_pagada_cents = c.mora_devengada_cents then coalesce(c.pagada_en, p_fecha)
      else null end
  where c.prestamo_id = p_prestamo_id and c.estado <> 'anulada';
  update public.prestamos p set estado = case
    when not exists (select 1 from public.cuotas where prestamo_id = p.id and estado <> 'pagada') then 'pagado'
    else 'activo' end
  where p.id = p_prestamo_id and p.estado in ('activo', 'pagado');
end;
$$;
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
  p_idempotency_key uuid default null
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
  if p_fecha is null or p_fecha < p.fecha_inicio then
    raise exception 'La fecha del pago no puede ser anterior al inicio del préstamo' using errcode = '22023';
  end if;
  if p_fecha > public.fin_hoy() then raise exception 'La fecha del pago no puede ser futura' using errcode = '22023'; end if;
  select max(fecha) into ultima_fecha from public.pagos where prestamo_id = p.id and estado = 'aplicado';
  if ultima_fecha is not null and p_fecha < ultima_fecha then
    raise exception 'Los pagos deben registrarse en orden cronológico (último pago: %)', ultima_fecha using errcode = '22023';
  end if;
  monto := public.fin_convertir(p_monto_pago_cents, p_tasa_cambio, p_moneda_pago, p.moneda);
  if monto < 1 then raise exception 'El monto convertido es menor a un centavo' using errcode = '22023'; end if;
  insert into public.pagos (user_id, prestamo_id, fecha, tipo, modo_abono, metodo, referencia, notas, moneda_pago,
    monto_pago_cents, tasa_cambio, monto_prestamo_cents, idempotency_key)
  values (uid, p.id, p_fecha, p_tipo, case when p_tipo = 'abono_capital' then p_modo_abono end, p_metodo,
    public.fin_texto_seguro(p_referencia, 80), public.fin_texto_seguro(p_notas, 500), p_moneda_pago,
    p_monto_pago_cents, p_tasa_cambio, monto, p_idempotency_key)
  returning id into pago;
  perform public.fin_devengar_mora(p.id, p_fecha);
  restante := monto;
  for c in
    select * from public.cuotas
    where prestamo_id = p.id and estado <> 'anulada' and estado <> 'pagada'
      and (p_tipo = 'cuota' or fecha_vencimiento <= p_fecha)
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
    aplicar := least(restante, c.capital_cents - c.capital_pagado_cents);
    if aplicar > 0 then
      update public.cuotas set capital_pagado_cents = capital_pagado_cents + aplicar where id = c.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, c.id, 'capital', aplicar);
      restante := restante - aplicar;
    end if;
  end loop;
  if p_tipo = 'abono_capital' and restante > 0 then
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
  if p.metodo_interes = 'saldo_insoluto' then
    base := public.fin_dias_modalidad(p.modalidad_tasa);
    for c in
      select * from public.cuotas
      where prestamo_id = p.id and estado <> 'anulada' and fecha_vencimiento > p_fecha
      order by numero for update
    loop
      inicio_periodo := c.fecha_vencimiento - c.dias;
      select coalesce(sum(a.monto_cents), 0) into saldo
      from public.aplicaciones_pago a join public.cuotas cc on cc.id = a.cuota_id
      where a.pago_id = pago and a.concepto = 'capital' and cc.numero >= c.numero;
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
  if p_tipo = 'abono_capital' and restante > 0 then
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
    raise exception 'El pago excede el saldo pendiente por % centavos (moneda del préstamo)', restante using errcode = '22023';
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
create or replace function public.monto_cancelacion(p_prestamo_id uuid, p_fecha date default null)
returns bigint language plpgsql stable security invoker set search_path = '' as $$
declare
  f date := coalesce(p_fecha, public.fin_hoy());
  p public.prestamos;
  c public.cuotas;
  total bigint := 0;
  interes_pend bigint;
  capital_desde bigint;
  base integer;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found then raise exception 'Préstamo no encontrado' using errcode = 'P0002'; end if;
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  for c in select * from public.cuotas where prestamo_id = p.id and estado <> 'anulada' order by numero loop
    interes_pend := c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents;
    total := total + (c.capital_cents - c.capital_pagado_cents)
                   + (c.mora_devengada_cents - c.mora_pagada_cents)
                   + public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, f)
                   + interes_pend;
    if p.metodo_interes = 'saldo_insoluto' and c.fecha_vencimiento > f then
      select coalesce(sum(capital_cents - capital_pagado_cents), 0) into capital_desde
      from public.cuotas where prestamo_id = p.id and estado <> 'anulada' and numero >= c.numero;
      total := total - least(interes_pend, public.fin_interes_simple(capital_desde, p.tasa_interes,
        c.fecha_vencimiento - greatest(c.fecha_vencimiento - c.dias, f), base));
    end if;
  end loop;
  return total;
end;
$$;
revoke execute on function public.monto_cancelacion(uuid, date) from public, anon;
grant execute on function public.monto_cancelacion(uuid, date) to authenticated;
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.fin_usuario_actual();
  motivo text := public.fin_texto_seguro(p_motivo, 300);
  pg public.pagos;
  p public.prestamos;
  a record;
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
    update public.cuotas set
      mora_pagada_cents = mora_pagada_cents - case when a.concepto = 'mora' then a.monto_cents else 0 end,
      interes_pagado_cents = interes_pagado_cents - case when a.concepto = 'interes' then a.monto_cents else 0 end,
      capital_pagado_cents = capital_pagado_cents - case when a.concepto = 'capital' then a.monto_cents else 0 end,
      interes_descontado_cents = interes_descontado_cents - case when a.concepto = 'descuento_interes' then a.monto_cents else 0 end
    where id = a.cuota_id;
  end loop;
  update public.pagos set estado = 'anulado', anulado_motivo = motivo, anulado_en = now() where id = pg.id;
  if p.estado = 'pagado' then update public.prestamos set estado = 'activo' where id = p.id; end if;
  perform public.fin_actualizar_estados(p.id, pg.fecha);
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
create or replace view public.v_cuotas_estado with (security_invoker = true) as
select
  c.id, c.prestamo_id, c.user_id, c.numero, c.fecha_vencimiento, c.dias,
  c.capital_cents, c.interes_cents, c.capital_pagado_cents, c.interes_pagado_cents, c.interes_descontado_cents,
  c.capital_cents - c.capital_pagado_cents as capital_pendiente_cents,
  c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents as interes_pendiente_cents,
  c.mora_devengada_cents - c.mora_pagada_cents
    + public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, public.fin_hoy()) as mora_pendiente_cents,
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
  coalesce(sum(v.capital_pendiente_cents), 0)::bigint as capital_pendiente_cents,
  coalesce(sum(v.interes_pendiente_cents), 0)::bigint as interes_pendiente_cents,
  coalesce(sum(v.mora_pendiente_cents), 0)::bigint as mora_pendiente_cents,
  coalesce(sum(v.capital_pagado_cents + v.interes_pagado_cents + v.mora_pagada_cents), 0)::bigint as cobrado_cents,
  coalesce(sum(v.capital_pendiente_cents + v.interes_pendiente_cents + v.mora_pendiente_cents)
    filter (where v.situacion in ('vencida', 'vence_hoy')), 0)::bigint as exigible_hoy_cents,
  coalesce(max(v.dias_atraso), 0) as dias_atraso,
  min(v.fecha_vencimiento) filter (where v.situacion not in ('pagada', 'anulada')) as proximo_vencimiento,
  count(*) filter (where v.situacion = 'vencida') as cuotas_vencidas,
  count(*) filter (where v.situacion = 'pagada') as cuotas_pagadas,
  count(*) filter (where v.situacion <> 'anulada') as cuotas_total
from public.prestamos p
join public.clientes cl on cl.id = p.cliente_id
left join public.v_cuotas_estado v on v.prestamo_id = p.id
group by p.id, cl.id;
grant select on public.v_cuotas_estado, public.v_prestamos_resumen to authenticated;
revoke all on public.v_cuotas_estado, public.v_prestamos_resumen from anon;
revoke execute on function
  public.fin_devengar_mora(uuid, date),
  public.fin_actualizar_estados(uuid, date)
from public, anon, authenticated;
revoke execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid) to authenticated;
revoke execute on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;
commit;
