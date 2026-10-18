-- ════════════════════════════════════════════════════════════════════════════
-- Correcciones de la auditoría (continuación 1 de 3): registrar_pago con
-- confirmación de tasa y regla «préstamo en USD: en Bs solo intereses y mora».
-- ════════════════════════════════════════════════════════════════════════════

-- ─── RPC: registrar pago ────────────────────────────────────────────────────
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
  -- Préstamo en dólares cobrado en bolívares: solo intereses y mora.
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
  -- La tasa solo afecta el monto cuando hay conversión o el préstamo es en bolívares.
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

  -- 1) Cuotas en orden: todas para 'cuota'; solo las vencidas para 'abono_capital'.
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

  -- 2) Abono a capital con lo que sobra.
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

  -- 2b) Préstamo abierto: lo que sobra tras los intereses vencidos va al capital.
  if not solo_interes and p.tipo_plazo = 'abierto' and restante > 0 then
    select capital_cents - capital_pagado_cents into aplicar from public.prestamos where id = p.id;
    aplicar := least(restante, aplicar);
    if aplicar > 0 then
      update public.prestamos set capital_pagado_cents = capital_pagado_cents + aplicar where id = p.id;
      insert into public.aplicaciones_pago (pago_id, user_id, cuota_id, concepto, monto_cents) values (pago, uid, null, 'capital', aplicar);
      restante := restante - aplicar;
    end if;
  end if;

  -- 3) Saldo insoluto: el capital cobrado por adelantado deja de generar interés
  --    desde la fecha del pago (prorrateo diario del período en curso).
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

  -- 4) Lo que sobre de un abono cubre el interés ya ganado.
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

-- Ya nadie usa la versión vieja de 2 parámetros.
drop function if exists public.fin_devengar_mora(uuid, date);

revoke execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean) to authenticated;

insert into public.app_migraciones (version) values ('20261014000200') on conflict do nothing;
