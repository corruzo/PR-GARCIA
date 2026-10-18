-- ════════════════════════════════════════════════════════════════════════════
-- PRGARCÍA · Estructura completa de la base de datos (esquema public).
--
-- RESPALDO DE REFERENCIA: resultado exacto de aplicar supabase/migrations/
-- (o supabase/instalar/) sobre un proyecto Supabase vacío (imagen
-- supabase/postgres 15.8), volcado con pg_dump --schema-only --schema=public
-- --no-owner. Incluye tablas, restricciones, índices, funciones, vistas,
-- triggers, RLS, políticas y permisos. No incluye datos.
--
--   * Para instalar o actualizar usa supabase/instalar/ (docs/CAMBIOS_SUPABASE.md).
--   * Sirve para revisar la estructura, compararla con producción
--     (scripts/volcar-esquema.sh) o reconstruirla en un proyecto Supabase
--     NUEVO y VACÍO. Requiere el esquema auth de Supabase.
--   * Se regenera con scripts/esquema-desde-local.sh.
-- Migraciones incluidas: hasta 20261018000100.
-- ════════════════════════════════════════════════════════════════════════════

--
-- PostgreSQL database dump
--


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: anular_pago(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: anular_pagos_desde(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_pagos_desde(p_pago_id uuid, p_motivo text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: anular_prestamo(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_prestamo(p_prestamo_id uuid, p_motivo text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  uid uuid := public.fin_usuario_actual();
  p public.prestamos;
  asiento uuid;
  motivo text := public.fin_texto_seguro(p_motivo, 300);
begin
  if motivo is null then raise exception 'Indica el motivo de la anulación' using errcode = '22023'; end if;
  select * into p from public.prestamos where id = p_prestamo_id and user_id = uid for update;
  if not found then raise exception 'Préstamo no encontrado' using errcode = 'P0002'; end if;
  if p.estado <> 'activo' then raise exception 'Solo se pueden anular préstamos activos' using errcode = '22023'; end if;
  if p.capital_pagado_cents > 0 or exists (select 1 from public.cuotas where prestamo_id = p.id
             and (capital_pagado_cents > 0 or interes_pagado_cents > 0 or mora_pagada_cents > 0)) then
    raise exception 'El préstamo tiene pagos aplicados; anula primero los pagos' using errcode = '22023';
  end if;
  update public.prestamos set estado = 'anulado', anulado_motivo = motivo where id = p.id;
  update public.cuotas set estado = 'anulada' where prestamo_id = p.id;
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, moneda, tasa_cambio, descripcion)
  values (uid, public.fin_hoy(), 'anulacion_prestamo', p.id, p.moneda, p.tasa_cambio,
    'Anulación préstamo #' || p.numero || ': ' || motivo)
  returning id into asiento;
  perform public.fin_linea(asiento, uid, 'caja', p.capital_cents, 0, p.moneda, p.tasa_cambio, p.moneda, p.capital_cents);
  perform public.fin_linea(asiento, uid, 'cartera_capital', 0, p.capital_cents, p.moneda, p.tasa_cambio);
  perform public.fin_validar_asiento(asiento);
end;
$$;


--
-- Name: emitir_prestamo(uuid, text, bigint, numeric, text, text, text, date, date, numeric, text, numeric, integer, text, text, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emitir_prestamo(p_cliente_id uuid, p_moneda text, p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_frecuencia_pago text, p_metodo_interes text, p_fecha_inicio date, p_fecha_fin date, p_tasa_cambio numeric, p_fuente_tasa_cambio text, p_tasa_mora_diaria numeric DEFAULT 0, p_dias_gracia integer DEFAULT 0, p_notas text DEFAULT NULL::text, p_cotizacion_origen text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid, p_tipo_plazo text DEFAULT 'fijo'::text, p_confirmar_tasa boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  uid uuid := public.fin_usuario_actual();
  existente uuid;
  cl public.clientes;
  nuevo_id uuid;
  nuevo_numero integer;
  interes_total bigint;
  asiento uuid;
  usado bigint;
  solicitado bigint;
begin
  if p_idempotency_key is not null then
    select id into existente from public.prestamos where user_id = uid and idempotency_key = p_idempotency_key;
    if found then return existente; end if;
  end if;
  if p_tipo_plazo is null or p_tipo_plazo not in ('fijo', 'abierto') then
    raise exception 'Tipo de plazo inválido' using errcode = '22023';
  end if;
  if p_tipo_plazo = 'abierto' then
    if p_fecha_fin is not null then raise exception 'Un préstamo abierto no lleva fecha de fin' using errcode = '22023'; end if;
    perform public.fin_validar_terminos(p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_inicio + coalesce(public.fin_dias_frecuencia(p_frecuencia_pago), 1), p_frecuencia_pago, 'saldo_insoluto');
  else
    perform public.fin_validar_terminos(p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes);
  end if;
  if p_tasa_interes <> round(p_tasa_interes, 8) then raise exception 'La tasa admite hasta 8 decimales' using errcode = '22023'; end if;
  if p_tasa_cambio is null or p_tasa_cambio <= 0 or p_tasa_cambio > 1000000000000 or p_tasa_cambio <> round(p_tasa_cambio, 8) then
    raise exception 'Tasa de cambio inválida' using errcode = '22023';
  end if;
  perform public.fin_validar_tasa_cambio(p_tasa_cambio, p_confirmar_tasa);
  if p_tasa_mora_diaria is null or p_tasa_mora_diaria < 0 or p_tasa_mora_diaria > 5 then
    raise exception 'La mora diaria debe estar entre 0 y 5 %%' using errcode = '22023';
  end if;
  if p_dias_gracia is null or p_dias_gracia not between 0 and 60 then
    raise exception 'Los días de gracia deben estar entre 0 y 60' using errcode = '22023';
  end if;
  if p_fecha_inicio > public.fin_hoy() + 30 then
    raise exception 'La fecha de inicio no puede ser más de 30 días en el futuro' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prestamos:' || uid::text, 0));
  select * into cl from public.clientes where id = p_cliente_id and user_id = uid;
  if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  if cl.estado <> 'activo' then raise exception 'El cliente no está activo' using errcode = '22023'; end if;
  if cl.limite_credito_cents is not null then
    select coalesce(sum(public.fin_convertir(
      case when pr.tipo_plazo = 'abierto' then pr.capital_cents - pr.capital_pagado_cents
           else (select coalesce(sum(c.capital_cents - c.capital_pagado_cents), 0)
                 from public.cuotas c where c.prestamo_id = pr.id and c.estado <> 'anulada')::bigint end,
      p_tasa_cambio, pr.moneda, cl.moneda_limite)), 0)
      into usado
    from public.prestamos pr
    where pr.cliente_id = cl.id and pr.user_id = uid and pr.estado = 'activo';
    solicitado := public.fin_convertir(p_capital_cents, p_tasa_cambio, p_moneda, cl.moneda_limite);
    if usado + solicitado > cl.limite_credito_cents then
      raise exception 'El préstamo supera el límite de crédito del cliente: disponible % %.',
        public.fin_formato_monto(greatest(cl.limite_credito_cents - usado, 0)), cl.moneda_limite
        using errcode = '22023';
    end if;
  end if;
  select coalesce(max(numero), 0) + 1 into nuevo_numero from public.prestamos where user_id = uid;
  if p_tipo_plazo = 'abierto' then
    interes_total := 0;
  else
    select coalesce(sum(c.interes_cents), 0) into interes_total
    from public.fin_cronograma(p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes) c;
  end if;
  insert into public.prestamos (user_id, numero, cliente_id, moneda, capital_cents, tasa_interes, modalidad_tasa,
    frecuencia_pago, metodo_interes, fecha_inicio, fecha_fin, interes_total_cents, total_cents, tasa_cambio,
    fuente_tasa_cambio, tasa_mora_diaria, dias_gracia, notas, cotizacion_origen, idempotency_key, tipo_plazo)
  values (uid, nuevo_numero, cl.id, p_moneda, p_capital_cents, p_tasa_interes, p_modalidad_tasa,
    p_frecuencia_pago, case when p_tipo_plazo = 'abierto' then 'saldo_insoluto' else p_metodo_interes end, p_fecha_inicio, p_fecha_fin, interes_total, p_capital_cents + interes_total,
    p_tasa_cambio, coalesce(public.fin_texto_seguro(p_fuente_tasa_cambio, 80), 'manual'), p_tasa_mora_diaria,
    p_dias_gracia, public.fin_texto_seguro(p_notas, 1000), public.fin_texto_seguro(p_cotizacion_origen, 64),
    p_idempotency_key, p_tipo_plazo)
  returning id into nuevo_id;
  if p_tipo_plazo = 'fijo' then
    insert into public.cuotas (prestamo_id, user_id, numero, fecha_vencimiento, dias, capital_cents, interes_cents)
    select nuevo_id, uid, c.numero, c.fecha_vencimiento, c.dias, c.capital_cents, c.interes_cents
    from public.fin_cronograma(p_capital_cents, p_tasa_interes, p_modalidad_tasa,
      p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes) c;
  end if;
  insert into public.asientos (user_id, fecha, tipo, prestamo_id, moneda, tasa_cambio, descripcion)
  values (uid, p_fecha_inicio, 'desembolso', nuevo_id, p_moneda, p_tasa_cambio, 'Desembolso préstamo #' || nuevo_numero)
  returning id into asiento;
  perform public.fin_linea(asiento, uid, 'cartera_capital', p_capital_cents, 0, p_moneda, p_tasa_cambio);
  perform public.fin_linea(asiento, uid, 'caja', 0, p_capital_cents, p_moneda, p_tasa_cambio, p_moneda, p_capital_cents);
  perform public.fin_validar_asiento(asiento);
  if p_tipo_plazo = 'abierto' then
    perform public.fin_sincronizar_abierto(nuevo_id, public.fin_hoy());
  end if;
  return nuevo_id;
end;
$$;


--
-- Name: fin_actualizar_estados(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_actualizar_estados(p_prestamo_id uuid, p_fecha date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
    when not exists (select 1 from public.cuotas where prestamo_id = p.id and estado <> 'pagada')
     and (p.tipo_plazo = 'fijo' or p.capital_pagado_cents >= p.capital_cents) then 'pagado'
    else 'activo' end
  where p.id = p_prestamo_id and p.estado in ('activo', 'pagado');
end;
$$;


--
-- Name: fin_auditar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_auditar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: fin_capital_abierto_al(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_capital_abierto_al(p_prestamo_id uuid, p_fecha date) RETURNS bigint
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select p.capital_cents - coalesce((
    select sum(a.monto_cents)
    from public.aplicaciones_pago a join public.pagos pg on pg.id = a.pago_id
    where pg.prestamo_id = p.id and pg.estado = 'aplicado' and pg.fecha <= p_fecha
      and a.concepto = 'capital' and a.cuota_id is null), 0)
  from public.prestamos p where p.id = p_prestamo_id;
$$;


--
-- Name: fin_convertir(bigint, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_convertir(cents bigint, tasa numeric, de text, a text) RETURNS bigint
    LANGUAGE plpgsql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
begin
  if de not in ('USD', 'VES') or a not in ('USD', 'VES') then raise exception 'Moneda inválida'; end if;
  if de = a then return cents; end if;
  if tasa <= 0 then raise exception 'La tasa de cambio debe ser mayor a cero'; end if;
  if de = 'USD' then
    return public.fin_div_half_even(cents::numeric * round(tasa * 100000000), 100000000);
  end if;
  return public.fin_div_half_even(cents::numeric * 100000000, round(tasa * 100000000));
end;
$$;


--
-- Name: fin_cronograma(bigint, numeric, text, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_cronograma(p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) RETURNS TABLE(numero integer, fecha_vencimiento date, dias integer, capital_cents bigint, interes_cents bigint, total_cents bigint, saldo_cents bigint)
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  dias_total integer := p_fin - p_inicio;
  intervalo integer := public.fin_dias_frecuencia(p_frecuencia);
  base integer := public.fin_dias_modalidad(p_modalidad);
  n integer;
  fechas date[] := '{}';
  periodos bigint[] := '{}';
  capitales bigint[];
  intereses bigint[] := '{}';
  unos bigint[];
  saldo bigint;
begin
  perform public.fin_validar_terminos('USD', p_capital_cents, p_tasa, p_modalidad, p_inicio, p_fin, p_frecuencia, p_metodo);
  n := ceil(dias_total::numeric / intervalo)::integer;
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


--
-- Name: fin_devengar_mora(uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_devengar_mora(p_prestamo_id uuid, p_hasta date, p_pago_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  p public.prestamos;
  c public.cuotas;
  extra bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  for c in select * from public.cuotas where prestamo_id = p_prestamo_id and estado <> 'anulada' order by numero loop
    extra := public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, p_hasta);
    if extra > 0 or (c.fecha_vencimiento < p_hasta and coalesce(c.mora_calculada_hasta, c.fecha_vencimiento) < p_hasta) then
      insert into public.pagos_mora (pago_id, user_id, cuota_id, mora_cents, calculada_hasta_anterior)
      values (p_pago_id, p.user_id, c.id, extra, c.mora_calculada_hasta);
      update public.cuotas set mora_devengada_cents = mora_devengada_cents + extra, mora_calculada_hasta = p_hasta
      where id = c.id;
    end if;
  end loop;
end;
$$;


--
-- Name: fin_dias_frecuencia(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_dias_frecuencia(frecuencia text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
  select case frecuencia when 'diario' then 1 when 'semanal' then 7 when 'quincenal' then 15 when 'mensual' then 30 end;
$$;


--
-- Name: fin_dias_modalidad(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_dias_modalidad(modalidad text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
  select case modalidad when 'diaria' then 1 when 'semanal' then 7 when 'quincenal' then 15 when 'mensual' then 30 end;
$$;


--
-- Name: fin_div_half_even(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_div_half_even(n numeric, d numeric) RETURNS bigint
    LANGUAGE plpgsql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
declare
  q numeric;
  r numeric;
  neg boolean;
begin
  if d = 0 then raise exception 'División entre cero'; end if;
  if d < 0 then n := -n; d := -d; end if;
  neg := n < 0;
  if neg then n := -n; end if;
  q := div(n, d);
  r := n - q * d;
  if 2 * r > d or (2 * r = d and mod(q, 2) = 1) then q := q + 1; end if;
  return (case when neg then -q else q end)::bigint;
end;
$$;


--
-- Name: fin_formato_monto(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_formato_monto(p_cents bigint) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
  select translate(to_char(p_cents / 100.0, 'FM999,999,999,999,990.00'), ',.', '.,');
$$;


--
-- Name: fin_hoy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_hoy() RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(
    case when session_user::text not in ('authenticator', 'anon', 'authenticated')
         then nullif(current_setting('app.fecha_hoy', true), '')::date end,
    (now() at time zone 'America/Caracas')::date
  );
$$;


--
-- Name: fin_inmutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_inmutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: fin_interes_simple(bigint, numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_interes_simple(capital bigint, tasa numeric, dias integer, base integer) RETURNS bigint
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
  select public.fin_div_half_even(
    capital::numeric * round(tasa * 100000000) * dias,
    100::numeric * 100000000 * base
  );
$$;


--
-- Name: fin_linea(uuid, uuid, text, bigint, bigint, text, numeric, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_linea(p_asiento uuid, p_user uuid, p_cuenta text, p_debe bigint, p_haber bigint, p_moneda text, p_tasa numeric, p_moneda_original text DEFAULT NULL::text, p_monto_original bigint DEFAULT NULL::bigint) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if coalesce(p_debe, 0) = 0 and coalesce(p_haber, 0) = 0 then return; end if;
  insert into public.asiento_lineas (asiento_id, user_id, cuenta, debe_cents, haber_cents,
    equivalente_usd_cents, moneda_original, monto_original_cents)
  values (p_asiento, p_user, p_cuenta, coalesce(p_debe, 0), coalesce(p_haber, 0),
    public.fin_convertir(coalesce(p_debe, 0) + coalesce(p_haber, 0), p_tasa, p_moneda, 'USD'),
    p_moneda_original, p_monto_original);
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cuotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prestamo_id uuid NOT NULL,
    user_id uuid NOT NULL,
    numero integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    dias integer NOT NULL,
    capital_cents bigint NOT NULL,
    interes_cents bigint NOT NULL,
    capital_pagado_cents bigint DEFAULT 0 NOT NULL,
    interes_pagado_cents bigint DEFAULT 0 NOT NULL,
    interes_descontado_cents bigint DEFAULT 0 NOT NULL,
    mora_devengada_cents bigint DEFAULT 0 NOT NULL,
    mora_pagada_cents bigint DEFAULT 0 NOT NULL,
    mora_calculada_hasta date,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    pagada_en date,
    CONSTRAINT cuotas_capital_cents_check CHECK ((capital_cents >= 0)),
    CONSTRAINT cuotas_check CHECK (((capital_pagado_cents >= 0) AND (capital_pagado_cents <= capital_cents))),
    CONSTRAINT cuotas_check1 CHECK (((interes_pagado_cents >= 0) AND (interes_descontado_cents >= 0) AND ((interes_pagado_cents + interes_descontado_cents) <= interes_cents))),
    CONSTRAINT cuotas_check2 CHECK (((mora_pagada_cents >= 0) AND (mora_pagada_cents <= mora_devengada_cents))),
    CONSTRAINT cuotas_dias_check CHECK ((dias > 0)),
    CONSTRAINT cuotas_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'parcial'::text, 'pagada'::text, 'anulada'::text]))),
    CONSTRAINT cuotas_interes_cents_check CHECK ((interes_cents >= 0)),
    CONSTRAINT cuotas_mora_devengada_cents_check CHECK ((mora_devengada_cents >= 0)),
    CONSTRAINT cuotas_numero_check CHECK ((numero > 0))
);


--
-- Name: fin_mora_adicional(public.cuotas, numeric, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_mora_adicional(c public.cuotas, p_tasa_mora numeric, p_gracia integer, p_hasta date) RETURNS bigint
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  base bigint := (c.capital_cents - c.capital_pagado_cents)
               + (c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents);
  desde date := greatest(coalesce(c.mora_calculada_hasta, c.fecha_vencimiento), c.fecha_vencimiento + p_gracia);
begin
  if base <= 0 or p_tasa_mora <= 0 or c.estado = 'anulada' or p_hasta <= desde then return 0; end if;
  return public.fin_interes_simple(base, p_tasa_mora, p_hasta - desde, 1);
end;
$$;


--
-- Name: fin_pago_inmutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_pago_inmutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: fin_recalcular_abierto_desde(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_recalcular_abierto_desde(p_prestamo_id uuid, p_desde date) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  p public.prestamos;
  c public.cuotas;
  base integer;
  nuevo bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found or p.tipo_plazo <> 'abierto' then return; end if;
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  for c in
    select * from public.cuotas
    where prestamo_id = p.id and estado <> 'anulada' and fecha_vencimiento - dias > p_desde
    order by numero for update
  loop
    nuevo := public.fin_interes_simple(public.fin_capital_abierto_al(p.id, c.fecha_vencimiento - c.dias), p.tasa_interes, c.dias, base);
    if nuevo < c.interes_pagado_cents + c.interes_descontado_cents then
      raise exception 'No se puede recalcular el período #%: tiene pagos aplicados', c.numero using errcode = '22023';
    end if;
    if nuevo <> c.interes_cents then
      update public.cuotas set interes_cents = nuevo where id = c.id;
    end if;
  end loop;
end;
$$;


--
-- Name: fin_repartir(bigint, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_repartir(total bigint, pesos bigint[]) RETURNS bigint[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
declare
  n integer := coalesce(array_length(pesos, 1), 0);
  suma numeric;
  partes bigint[] := '{}';
  sobrante bigint;
  idx integer;
begin
  if n = 0 then return partes; end if;
  if total < 0 then raise exception 'El total a repartir no puede ser negativo'; end if;
  select sum(p) into suma from unnest(pesos) p;
  if suma is null or suma <= 0 then raise exception 'La suma de pesos debe ser mayor a cero'; end if;
  for i in 1..n loop
    partes[i] := div(total::numeric * pesos[i], suma)::bigint;
  end loop;
  sobrante := total - (select sum(p) from unnest(partes) p);
  for idx in
    select o from unnest(pesos) with ordinality as t(p, o)
    order by mod(total::numeric * p, suma) desc, o asc
    limit sobrante
  loop
    partes[idx] := partes[idx] + 1;
  end loop;
  return partes;
end;
$$;


--
-- Name: fin_sin_borrado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_sin_borrado() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if pg_trigger_depth() <= 1 then
    raise exception 'Los registros de % no se pueden borrar; anúlalos', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;


--
-- Name: fin_sincronizar_abierto(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_sincronizar_abierto(p_prestamo_id uuid, p_hasta date) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  p public.prestamos;
  intervalo integer;
  base integer;
  inicio date;
  ultimo integer;
  saldo bigint;
  creadas integer := 0;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found or p.tipo_plazo <> 'abierto' or p.estado <> 'activo' then return 0; end if;
  intervalo := public.fin_dias_frecuencia(p.frecuencia_pago);
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  select coalesce(max(numero), 0), max(fecha_vencimiento) into ultimo, inicio
  from public.cuotas where prestamo_id = p.id;
  inicio := coalesce(inicio, p.fecha_inicio);
  while inicio <= p_hasta loop
    saldo := public.fin_capital_abierto_al(p.id, inicio);
    exit when saldo <= 0;
    creadas := creadas + 1;
    if creadas > 4000 then raise exception 'Demasiados períodos pendientes de generar'; end if;
    ultimo := ultimo + 1;
    insert into public.cuotas (prestamo_id, user_id, numero, fecha_vencimiento, dias, capital_cents, interes_cents)
    values (p.id, p.user_id, ultimo, inicio + intervalo, intervalo, 0,
      public.fin_interes_simple(saldo, p.tasa_interes, intervalo, base));
    inicio := inicio + intervalo;
  end loop;
  return creadas;
end;
$$;


--
-- Name: fin_tasa_actual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_tasa_actual() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select tasa from public.tasa_bcv where estado = 'ok' order by fecha_hora desc limit 1;
$$;


--
-- Name: fin_texto_seguro(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_texto_seguro(valor text, max_len integer) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
begin
  if valor is null or btrim(valor) = '' then return null; end if;
  if char_length(valor) > max_len or valor ~ '[<>]' then
    raise exception 'Texto inválido o demasiado largo' using errcode = '22023';
  end if;
  return btrim(valor);
end;
$$;


--
-- Name: fin_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: fin_usuario_actual(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_usuario_actual() RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
  return uid;
end;
$$;


--
-- Name: fin_validar_asiento(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_validar_asiento(p_asiento uuid) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  debe bigint;
  haber bigint;
begin
  select coalesce(sum(debe_cents), 0), coalesce(sum(haber_cents), 0) into debe, haber
  from public.asiento_lineas where asiento_id = p_asiento;
  if debe = 0 or debe <> haber then
    raise exception 'Asiento descuadrado (debe %, haber %)', debe, haber;
  end if;
end;
$$;


--
-- Name: fin_validar_tasa_cambio(numeric, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_validar_tasa_cambio(p_tasa numeric, p_confirmada boolean) RETURNS void
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  ref numeric;
  ref_fecha timestamptz;
begin
  select t.tasa, t.fecha_hora into ref, ref_fecha
  from public.tasa_bcv t where t.estado = 'ok' order by t.fecha_hora desc limit 1;
  if ref is null or ref <= 0 or ref_fecha < now() - interval '15 days' then return; end if;
  if abs(p_tasa - ref) / ref > 0.20 and not coalesce(p_confirmada, false) then
    raise exception 'La tasa de cambio % se aleja más del 20 %% de la tasa BCV registrada (%). Revísala o confirma que es correcta.',
      replace(trim_scale(p_tasa)::text, '.', ','), replace(trim_scale(round(ref, 4))::text, '.', ',')
      using errcode = '22023', hint = 'confirmar_tasa';
  end if;
end;
$$;


--
-- Name: fin_validar_terminos(text, bigint, numeric, text, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fin_validar_terminos(p_moneda text, p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) RETURNS void
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  dias integer;
begin
  if p_moneda is null or p_moneda not in ('USD', 'VES') then raise exception 'Moneda inválida' using errcode = '22023'; end if;
  if p_capital_cents is null or p_capital_cents < 1 or p_capital_cents > 9000000000000000 then
    raise exception 'Monto fuera del rango permitido' using errcode = '22023';
  end if;
  if p_tasa is null or round(p_tasa * 100000000) <= 0 or p_tasa > 1000 then
    raise exception 'La tasa debe ser mayor a 0 y de hasta 1000 %%' using errcode = '22023';
  end if;
  if public.fin_dias_modalidad(p_modalidad) is null then raise exception 'Modalidad de tasa inválida' using errcode = '22023'; end if;
  if public.fin_dias_frecuencia(p_frecuencia) is null then raise exception 'Frecuencia de pago inválida' using errcode = '22023'; end if;
  if p_metodo is null or p_metodo not in ('interes_fijo', 'saldo_insoluto') then raise exception 'Método de interés inválido' using errcode = '22023'; end if;
  if p_inicio is null or p_fin is null then raise exception 'Fechas requeridas' using errcode = '22023'; end if;
  dias := p_fin - p_inicio;
  if dias <= 0 then raise exception 'La fecha de fin debe ser posterior a la fecha de inicio' using errcode = '22023'; end if;
  if dias > 3660 then raise exception 'El plazo no puede superar 10 años' using errcode = '22023'; end if;
  if ceil(dias::numeric / public.fin_dias_frecuencia(p_frecuencia)) > 600 then
    raise exception 'El préstamo no puede tener más de 600 cuotas' using errcode = '22023';
  end if;
end;
$$;


--
-- Name: monto_cancelacion(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.monto_cancelacion(p_prestamo_id uuid, p_fecha date DEFAULT NULL::date) RETURNS bigint
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  f date := coalesce(p_fecha, public.fin_hoy());
  p public.prestamos;
  c public.cuotas;
  total bigint := 0;
  interes_pend bigint;
  capital_desde bigint;
  base integer;
  intervalo integer;
  inicio date;
  venc date;
  interes bigint;
begin
  select * into p from public.prestamos where id = p_prestamo_id;
  if not found then raise exception 'Préstamo no encontrado' using errcode = 'P0002'; end if;
  base := public.fin_dias_modalidad(p.modalidad_tasa);
  if p.tipo_plazo = 'abierto' then
    capital_desde := p.capital_cents - p.capital_pagado_cents;
    total := capital_desde;
    for c in select * from public.cuotas where prestamo_id = p.id and estado <> 'anulada' order by numero loop
      interes_pend := c.interes_cents - c.interes_pagado_cents - c.interes_descontado_cents;
      total := total + (c.mora_devengada_cents - c.mora_pagada_cents)
                     + public.fin_mora_adicional(c, p.tasa_mora_diaria, p.dias_gracia, f) + interes_pend;
      if c.fecha_vencimiento > f then
        total := total - least(interes_pend, public.fin_interes_simple(capital_desde, p.tasa_interes,
          c.fecha_vencimiento - greatest(c.fecha_vencimiento - c.dias, f), base));
      end if;
    end loop;
    if capital_desde > 0 and p.estado = 'activo' then
      intervalo := public.fin_dias_frecuencia(p.frecuencia_pago);
      select max(fecha_vencimiento) into inicio from public.cuotas where prestamo_id = p.id;
      inicio := coalesce(inicio, p.fecha_inicio);
      while inicio <= f loop
        venc := inicio + intervalo;
        interes := public.fin_interes_simple(capital_desde, p.tasa_interes, intervalo, base);
        if venc > f then
          total := total + interes - least(interes, public.fin_interes_simple(capital_desde, p.tasa_interes, venc - greatest(inicio, f), base));
        else
          total := total + interes;
          if p.tasa_mora_diaria > 0 and f > venc + p.dias_gracia then
            total := total + public.fin_interes_simple(interes, p.tasa_mora_diaria, f - (venc + p.dias_gracia), 1);
          end if;
        end if;
        inicio := venc;
      end loop;
    end if;
    return total;
  end if;
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


--
-- Name: previsualizar_cronograma(bigint, numeric, text, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.previsualizar_cronograma(p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_fecha_inicio date, p_fecha_fin date, p_frecuencia_pago text, p_metodo_interes text) RETURNS TABLE(numero integer, fecha_vencimiento date, dias integer, capital_cents bigint, interes_cents bigint, total_cents bigint, saldo_cents bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select * from public.fin_cronograma(p_capital_cents, p_tasa_interes, p_modalidad_tasa,
    p_fecha_inicio, p_fecha_fin, p_frecuencia_pago, p_metodo_interes);
$$;


--
-- Name: registrar_pago(uuid, date, text, bigint, numeric, text, text, text, text, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_pago(p_prestamo_id uuid, p_fecha date, p_moneda_pago text, p_monto_pago_cents bigint, p_tasa_cambio numeric, p_tipo text DEFAULT 'cuota'::text, p_modo_abono text DEFAULT 'reducir_plazo'::text, p_metodo text DEFAULT 'efectivo'::text, p_referencia text DEFAULT NULL::text, p_notas text DEFAULT NULL::text, p_idempotency_key uuid DEFAULT NULL::uuid, p_confirmar_tasa boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: reporte_diferencial_cambiario(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reporte_diferencial_cambiario(p_tasa_actual numeric DEFAULT NULL::numeric) RETURNS TABLE(prestamo_id uuid, numero integer, cliente_nombre text, tasa_desembolso numeric, tasa_actual numeric, capital_pendiente_ves_cents bigint, pendiente_usd_desembolso_cents bigint, pendiente_usd_actual_cents bigint, diferencial_no_realizado_usd_cents bigint, capital_cobrado_ves_cents bigint, cobrado_usd_desembolso_cents bigint, cobrado_usd_real_cents bigint, diferencial_realizado_usd_cents bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  tasa numeric := coalesce(p_tasa_actual, public.fin_tasa_actual());
begin
  if tasa is null or tasa <= 0 then raise exception 'No hay una tasa de cambio disponible' using errcode = '22023'; end if;
  return query
  with cobros as (
    select pg.prestamo_id, sum(a.monto_cents)::bigint as capital_ves,
           sum(public.fin_convertir(a.monto_cents, pg.tasa_cambio, 'VES', 'USD'))::bigint as capital_usd_real
    from public.aplicaciones_pago a join public.pagos pg on pg.id = a.pago_id
    where a.concepto = 'capital' and pg.estado = 'aplicado'
    group by pg.prestamo_id
  )
  select r.id, r.numero, r.cliente_nombre, r.tasa_cambio::numeric, tasa,
         r.capital_pendiente_cents,
         public.fin_convertir(r.capital_pendiente_cents, r.tasa_cambio, 'VES', 'USD'),
         public.fin_convertir(r.capital_pendiente_cents, tasa, 'VES', 'USD'),
         public.fin_convertir(r.capital_pendiente_cents, tasa, 'VES', 'USD')
           - public.fin_convertir(r.capital_pendiente_cents, r.tasa_cambio, 'VES', 'USD'),
         coalesce(cb.capital_ves, 0),
         public.fin_convertir(coalesce(cb.capital_ves, 0), r.tasa_cambio, 'VES', 'USD'),
         coalesce(cb.capital_usd_real, 0),
         coalesce(cb.capital_usd_real, 0) - public.fin_convertir(coalesce(cb.capital_ves, 0), r.tasa_cambio, 'VES', 'USD')
  from public.v_prestamos_resumen r
  left join cobros cb on cb.prestamo_id = r.id
  where r.moneda = 'VES' and r.estado <> 'anulado'
  order by r.numero;
end;
$$;


--
-- Name: sincronizar_prestamos_abiertos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sincronizar_prestamos_abiertos() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  uid uuid := public.fin_usuario_actual();
  r record;
  total integer := 0;
begin
  for r in
    select id from public.prestamos
    where user_id = uid and tipo_plazo = 'abierto' and estado = 'activo'
    order by id for update
  loop
    total := total + public.fin_sincronizar_abierto(r.id, public.fin_hoy());
  end loop;
  return total;
end;
$$;


--
-- Name: aplicaciones_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aplicaciones_pago (
    id bigint NOT NULL,
    pago_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cuota_id uuid,
    concepto text NOT NULL,
    monto_cents bigint NOT NULL,
    CONSTRAINT aplicaciones_cuota_requerida CHECK (((cuota_id IS NOT NULL) OR (concepto = 'capital'::text))),
    CONSTRAINT aplicaciones_pago_concepto_check CHECK ((concepto = ANY (ARRAY['mora'::text, 'interes'::text, 'capital'::text, 'descuento_interes'::text]))),
    CONSTRAINT aplicaciones_pago_monto_cents_check CHECK ((monto_cents > 0))
);


--
-- Name: aplicaciones_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.aplicaciones_pago ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.aplicaciones_pago_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_migraciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_migraciones (
    version text NOT NULL,
    aplicada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asiento_lineas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asiento_lineas (
    id bigint NOT NULL,
    asiento_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cuenta text NOT NULL,
    debe_cents bigint DEFAULT 0 NOT NULL,
    haber_cents bigint DEFAULT 0 NOT NULL,
    equivalente_usd_cents bigint NOT NULL,
    moneda_original text,
    monto_original_cents bigint,
    CONSTRAINT asiento_lineas_check CHECK (((debe_cents = 0) <> (haber_cents = 0))),
    CONSTRAINT asiento_lineas_cuenta_check CHECK ((cuenta = ANY (ARRAY['caja'::text, 'cartera_capital'::text, 'ingreso_interes'::text, 'ingreso_mora'::text]))),
    CONSTRAINT asiento_lineas_debe_cents_check CHECK ((debe_cents >= 0)),
    CONSTRAINT asiento_lineas_haber_cents_check CHECK ((haber_cents >= 0)),
    CONSTRAINT asiento_lineas_moneda_original_check CHECK ((moneda_original = ANY (ARRAY['USD'::text, 'VES'::text])))
);


--
-- Name: asiento_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.asiento_lineas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.asiento_lineas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: asientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asientos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fecha date NOT NULL,
    tipo text NOT NULL,
    prestamo_id uuid NOT NULL,
    pago_id uuid,
    moneda text NOT NULL,
    tasa_cambio numeric(20,8) NOT NULL,
    descripcion text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asientos_moneda_check CHECK ((moneda = ANY (ARRAY['USD'::text, 'VES'::text]))),
    CONSTRAINT asientos_tasa_cambio_check CHECK ((tasa_cambio > (0)::numeric)),
    CONSTRAINT asientos_tipo_check CHECK ((tipo = ANY (ARRAY['desembolso'::text, 'cobro'::text, 'reverso_cobro'::text, 'anulacion_prestamo'::text])))
);


--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    tabla text NOT NULL,
    registro_id uuid NOT NULL,
    accion text NOT NULL,
    antes jsonb,
    despues jsonb,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auditoria_accion_check CHECK ((accion = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    tipo_documento text DEFAULT 'V'::text NOT NULL,
    numero_documento text,
    nombre text NOT NULL,
    telefono text,
    email text,
    direccion text,
    referencia text,
    notas text,
    limite_credito_cents bigint,
    moneda_limite text DEFAULT 'USD'::text NOT NULL,
    estado text DEFAULT 'activo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clientes_direccion_check CHECK (((direccion IS NULL) OR ((char_length(direccion) <= 300) AND (direccion !~ '[<>]'::text)))),
    CONSTRAINT clientes_email_check CHECK (((email IS NULL) OR ((char_length(email) <= 254) AND (email ~* '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$'::text)))),
    CONSTRAINT clientes_estado_check CHECK ((estado = ANY (ARRAY['activo'::text, 'bloqueado'::text, 'inactivo'::text]))),
    CONSTRAINT clientes_limite_credito_cents_check CHECK (((limite_credito_cents IS NULL) OR (limite_credito_cents >= 0))),
    CONSTRAINT clientes_moneda_limite_check CHECK ((moneda_limite = ANY (ARRAY['USD'::text, 'VES'::text]))),
    CONSTRAINT clientes_nombre_check CHECK ((((char_length(btrim(nombre)) >= 2) AND (char_length(btrim(nombre)) <= 120)) AND (nombre !~ '[<>]'::text))),
    CONSTRAINT clientes_notas_check CHECK (((notas IS NULL) OR ((char_length(notas) <= 1000) AND (notas !~ '[<>]'::text)))),
    CONSTRAINT clientes_numero_documento_check CHECK ((numero_documento ~ '^[0-9A-Z]{4,20}$'::text)),
    CONSTRAINT clientes_referencia_check CHECK (((referencia IS NULL) OR ((char_length(referencia) <= 300) AND (referencia !~ '[<>]'::text)))),
    CONSTRAINT clientes_telefono_check CHECK (((telefono IS NULL) OR (telefono ~ '^\+?[0-9 ()-]{7,20}$'::text))),
    CONSTRAINT clientes_tipo_documento_check CHECK ((tipo_documento = ANY (ARRAY['V'::text, 'E'::text, 'J'::text, 'G'::text, 'P'::text])))
);


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    prestamo_id uuid NOT NULL,
    fecha date NOT NULL,
    tipo text NOT NULL,
    modo_abono text,
    metodo text NOT NULL,
    referencia text,
    notas text,
    moneda_pago text NOT NULL,
    monto_pago_cents bigint NOT NULL,
    tasa_cambio numeric(20,8) NOT NULL,
    monto_prestamo_cents bigint NOT NULL,
    estado text DEFAULT 'aplicado'::text NOT NULL,
    anulado_motivo text,
    anulado_en timestamp with time zone,
    idempotency_key uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pagos_estado_check CHECK ((estado = ANY (ARRAY['aplicado'::text, 'anulado'::text]))),
    CONSTRAINT pagos_metodo_check CHECK ((metodo = ANY (ARRAY['efectivo'::text, 'transferencia'::text, 'pago_movil'::text, 'zelle'::text, 'otro'::text]))),
    CONSTRAINT pagos_modo_abono_check CHECK ((modo_abono = ANY (ARRAY['reducir_plazo'::text, 'reducir_cuota'::text]))),
    CONSTRAINT pagos_moneda_pago_check CHECK ((moneda_pago = ANY (ARRAY['USD'::text, 'VES'::text]))),
    CONSTRAINT pagos_monto_pago_cents_check CHECK ((monto_pago_cents > 0)),
    CONSTRAINT pagos_monto_prestamo_cents_check CHECK ((monto_prestamo_cents > 0)),
    CONSTRAINT pagos_notas_check CHECK (((notas IS NULL) OR ((char_length(notas) <= 500) AND (notas !~ '[<>]'::text)))),
    CONSTRAINT pagos_referencia_check CHECK (((referencia IS NULL) OR ((char_length(referencia) <= 80) AND (referencia !~ '[<>]'::text)))),
    CONSTRAINT pagos_tasa_cambio_check CHECK ((tasa_cambio > (0)::numeric)),
    CONSTRAINT pagos_tipo_check CHECK ((tipo = ANY (ARRAY['cuota'::text, 'abono_capital'::text])))
);


--
-- Name: pagos_mora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_mora (
    id bigint NOT NULL,
    pago_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cuota_id uuid NOT NULL,
    mora_cents bigint NOT NULL,
    calculada_hasta_anterior date,
    CONSTRAINT pagos_mora_mora_cents_check CHECK ((mora_cents >= 0))
);


--
-- Name: pagos_mora_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pagos_mora ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pagos_mora_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prestamos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestamos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    numero integer NOT NULL,
    cliente_id uuid NOT NULL,
    moneda text NOT NULL,
    capital_cents bigint NOT NULL,
    tasa_interes numeric(20,8) NOT NULL,
    modalidad_tasa text NOT NULL,
    frecuencia_pago text NOT NULL,
    metodo_interes text NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    interes_total_cents bigint NOT NULL,
    total_cents bigint NOT NULL,
    tasa_cambio numeric(20,8) NOT NULL,
    fuente_tasa_cambio text NOT NULL,
    tasa_mora_diaria numeric(20,8) DEFAULT 0 NOT NULL,
    dias_gracia integer DEFAULT 0 NOT NULL,
    estado text DEFAULT 'activo'::text NOT NULL,
    notas text,
    cotizacion_origen text,
    idempotency_key uuid,
    anulado_motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_plazo text DEFAULT 'fijo'::text NOT NULL,
    capital_pagado_cents bigint DEFAULT 0 NOT NULL,
    CONSTRAINT prestamos_capital_cents_check CHECK ((capital_cents > 0)),
    CONSTRAINT prestamos_capital_pagado_check CHECK (((capital_pagado_cents >= 0) AND (capital_pagado_cents <= capital_cents))),
    CONSTRAINT prestamos_check CHECK ((fecha_fin > fecha_inicio)),
    CONSTRAINT prestamos_check1 CHECK ((total_cents = (capital_cents + interes_total_cents))),
    CONSTRAINT prestamos_cotizacion_origen_check CHECK (((cotizacion_origen IS NULL) OR (char_length(cotizacion_origen) <= 64))),
    CONSTRAINT prestamos_dias_gracia_check CHECK (((dias_gracia >= 0) AND (dias_gracia <= 60))),
    CONSTRAINT prestamos_estado_check CHECK ((estado = ANY (ARRAY['activo'::text, 'pagado'::text, 'anulado'::text]))),
    CONSTRAINT prestamos_frecuencia_pago_check CHECK ((frecuencia_pago = ANY (ARRAY['diario'::text, 'semanal'::text, 'quincenal'::text, 'mensual'::text]))),
    CONSTRAINT prestamos_fuente_tasa_cambio_check CHECK (((char_length(fuente_tasa_cambio) >= 1) AND (char_length(fuente_tasa_cambio) <= 80))),
    CONSTRAINT prestamos_interes_total_cents_check CHECK ((interes_total_cents >= 0)),
    CONSTRAINT prestamos_metodo_interes_check CHECK ((metodo_interes = ANY (ARRAY['interes_fijo'::text, 'saldo_insoluto'::text]))),
    CONSTRAINT prestamos_modalidad_tasa_check CHECK ((modalidad_tasa = ANY (ARRAY['diaria'::text, 'semanal'::text, 'quincenal'::text, 'mensual'::text]))),
    CONSTRAINT prestamos_moneda_check CHECK ((moneda = ANY (ARRAY['USD'::text, 'VES'::text]))),
    CONSTRAINT prestamos_notas_check CHECK (((notas IS NULL) OR ((char_length(notas) <= 1000) AND (notas !~ '[<>]'::text)))),
    CONSTRAINT prestamos_plazo_coherente CHECK ((((tipo_plazo = 'fijo'::text) AND (fecha_fin IS NOT NULL) AND (capital_pagado_cents = 0)) OR ((tipo_plazo = 'abierto'::text) AND (fecha_fin IS NULL) AND (metodo_interes = 'saldo_insoluto'::text)))),
    CONSTRAINT prestamos_tasa_cambio_check CHECK ((tasa_cambio > (0)::numeric)),
    CONSTRAINT prestamos_tasa_interes_check CHECK (((tasa_interes > (0)::numeric) AND (tasa_interes <= (1000)::numeric))),
    CONSTRAINT prestamos_tasa_mora_diaria_check CHECK (((tasa_mora_diaria >= (0)::numeric) AND (tasa_mora_diaria <= (5)::numeric))),
    CONSTRAINT prestamos_tipo_plazo_check CHECK ((tipo_plazo = ANY (ARRAY['fijo'::text, 'abierto'::text])))
);


--
-- Name: tasa_bcv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasa_bcv (
    id bigint NOT NULL,
    tasa numeric NOT NULL,
    fuente text NOT NULL,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    estado text DEFAULT 'ok'::text NOT NULL,
    CONSTRAINT tasa_bcv_estado_check CHECK ((estado = ANY (ARRAY['ok'::text, 'referencial'::text]))),
    CONSTRAINT tasa_bcv_tasa_check CHECK ((tasa > (0)::numeric))
);


--
-- Name: tasa_bcv_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tasa_bcv ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tasa_bcv_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    prestamo_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_history_prestamo_data_check CHECK (((jsonb_typeof(prestamo_data) = 'object'::text) AND (pg_column_size(prestamo_data) <= 65536)))
);


--
-- Name: v_prestamos_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_prestamos_resumen AS
SELECT
    NULL::uuid AS id,
    NULL::uuid AS user_id,
    NULL::integer AS numero,
    NULL::uuid AS cliente_id,
    NULL::text AS cliente_nombre,
    NULL::text AS cliente_documento,
    NULL::text AS cliente_telefono,
    NULL::text AS moneda,
    NULL::bigint AS capital_cents,
    NULL::bigint AS interes_total_cents,
    NULL::bigint AS total_cents,
    NULL::numeric(20,8) AS tasa_interes,
    NULL::text AS modalidad_tasa,
    NULL::text AS frecuencia_pago,
    NULL::text AS metodo_interes,
    NULL::date AS fecha_inicio,
    NULL::date AS fecha_fin,
    NULL::numeric(20,8) AS tasa_cambio,
    NULL::text AS fuente_tasa_cambio,
    NULL::numeric(20,8) AS tasa_mora_diaria,
    NULL::integer AS dias_gracia,
    NULL::text AS estado,
    NULL::text AS notas,
    NULL::timestamp with time zone AS created_at,
    NULL::bigint AS capital_pendiente_cents,
    NULL::bigint AS interes_pendiente_cents,
    NULL::bigint AS mora_pendiente_cents,
    NULL::bigint AS cobrado_cents,
    NULL::bigint AS exigible_hoy_cents,
    NULL::integer AS dias_atraso,
    NULL::date AS proximo_vencimiento,
    NULL::bigint AS cuotas_vencidas,
    NULL::bigint AS cuotas_pagadas,
    NULL::bigint AS cuotas_total,
    NULL::text AS tipo_plazo,
    NULL::bigint AS interes_generado_cents;


--
-- Name: v_cartera_antiguedad; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cartera_antiguedad WITH (security_invoker='true') AS
 SELECT r.user_id,
    r.moneda,
        CASE
            WHEN (r.dias_atraso = 0) THEN '0_al_dia'::text
            WHEN (r.dias_atraso <= 30) THEN '1_1_30'::text
            WHEN (r.dias_atraso <= 60) THEN '2_31_60'::text
            WHEN (r.dias_atraso <= 90) THEN '3_61_90'::text
            ELSE '4_mas_90'::text
        END AS tramo,
    count(*) AS prestamos,
    (sum(r.capital_pendiente_cents))::bigint AS capital_pendiente_cents,
    (sum(r.interes_pendiente_cents))::bigint AS interes_pendiente_cents,
    (sum(r.mora_pendiente_cents))::bigint AS mora_pendiente_cents,
    (sum(r.exigible_hoy_cents))::bigint AS exigible_hoy_cents
   FROM public.v_prestamos_resumen r
  WHERE (r.estado = 'activo'::text)
  GROUP BY r.user_id, r.moneda,
        CASE
            WHEN (r.dias_atraso = 0) THEN '0_al_dia'::text
            WHEN (r.dias_atraso <= 30) THEN '1_1_30'::text
            WHEN (r.dias_atraso <= 60) THEN '2_31_60'::text
            WHEN (r.dias_atraso <= 90) THEN '3_61_90'::text
            ELSE '4_mas_90'::text
        END;


--
-- Name: v_cobranza_mensual; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cobranza_mensual WITH (security_invoker='true') AS
 WITH esperado AS (
         SELECT c_1.user_id,
            p.moneda,
            (date_trunc('month'::text, (c_1.fecha_vencimiento)::timestamp with time zone))::date AS mes,
            (sum(((c_1.capital_cents + c_1.interes_cents) - c_1.interes_descontado_cents)))::bigint AS esperado_cents
           FROM (public.cuotas c_1
             JOIN public.prestamos p ON ((p.id = c_1.prestamo_id)))
          WHERE (c_1.estado <> 'anulada'::text)
          GROUP BY c_1.user_id, p.moneda, ((date_trunc('month'::text, (c_1.fecha_vencimiento)::timestamp with time zone))::date)
        ), cobrado AS (
         SELECT pg.user_id,
            p.moneda,
            (date_trunc('month'::text, (pg.fecha)::timestamp with time zone))::date AS mes,
            (sum(pg.monto_prestamo_cents))::bigint AS cobrado_cents,
            (sum(public.fin_convertir(pg.monto_prestamo_cents, pg.tasa_cambio, p.moneda, 'USD'::text)))::bigint AS cobrado_usd_cents
           FROM (public.pagos pg
             JOIN public.prestamos p ON ((p.id = pg.prestamo_id)))
          WHERE (pg.estado = 'aplicado'::text)
          GROUP BY pg.user_id, p.moneda, ((date_trunc('month'::text, (pg.fecha)::timestamp with time zone))::date)
        )
 SELECT COALESCE(e.user_id, c.user_id) AS user_id,
    COALESCE(e.moneda, c.moneda) AS moneda,
    COALESCE(e.mes, c.mes) AS mes,
    COALESCE(e.esperado_cents, (0)::bigint) AS esperado_cents,
    COALESCE(c.cobrado_cents, (0)::bigint) AS cobrado_cents,
    COALESCE(c.cobrado_usd_cents, (0)::bigint) AS cobrado_usd_cents
   FROM (esperado e
     FULL JOIN cobrado c ON (((c.user_id = e.user_id) AND (c.moneda = e.moneda) AND (c.mes = e.mes))));


--
-- Name: v_cuotas_estado; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cuotas_estado WITH (security_invoker='true') AS
 SELECT c.id,
    c.prestamo_id,
    c.user_id,
    c.numero,
    c.fecha_vencimiento,
    c.dias,
    c.capital_cents,
    c.interes_cents,
    c.capital_pagado_cents,
    c.interes_pagado_cents,
    c.interes_descontado_cents,
        CASE
            WHEN (c.estado = 'anulada'::text) THEN (0)::bigint
            ELSE (c.capital_cents - c.capital_pagado_cents)
        END AS capital_pendiente_cents,
        CASE
            WHEN (c.estado = 'anulada'::text) THEN (0)::bigint
            ELSE ((c.interes_cents - c.interes_pagado_cents) - c.interes_descontado_cents)
        END AS interes_pendiente_cents,
        CASE
            WHEN (c.estado = 'anulada'::text) THEN (0)::bigint
            ELSE ((c.mora_devengada_cents - c.mora_pagada_cents) + public.fin_mora_adicional(c.*, p.tasa_mora_diaria, p.dias_gracia, public.fin_hoy()))
        END AS mora_pendiente_cents,
    c.mora_pagada_cents,
    c.estado,
    c.pagada_en,
        CASE
            WHEN (c.estado = ANY (ARRAY['pagada'::text, 'anulada'::text])) THEN 0
            ELSE GREATEST((public.fin_hoy() - c.fecha_vencimiento), 0)
        END AS dias_atraso,
        CASE
            WHEN (c.estado = 'anulada'::text) THEN 'anulada'::text
            WHEN (c.estado = 'pagada'::text) THEN 'pagada'::text
            WHEN (c.fecha_vencimiento < public.fin_hoy()) THEN 'vencida'::text
            WHEN (c.fecha_vencimiento = public.fin_hoy()) THEN 'vence_hoy'::text
            WHEN (c.fecha_vencimiento <= (public.fin_hoy() + 7)) THEN 'por_vencer'::text
            ELSE 'al_dia'::text
        END AS situacion
   FROM (public.cuotas c
     JOIN public.prestamos p ON ((p.id = c.prestamo_id)));


--
-- Name: v_libro_mayor; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_libro_mayor WITH (security_invoker='true') AS
 SELECT l.user_id,
    a.moneda,
    l.cuenta,
    (sum(l.debe_cents))::bigint AS debe_cents,
    (sum(l.haber_cents))::bigint AS haber_cents,
    (sum((l.debe_cents - l.haber_cents)))::bigint AS saldo_cents,
    (sum(
        CASE
            WHEN (l.debe_cents > 0) THEN l.equivalente_usd_cents
            ELSE (- l.equivalente_usd_cents)
        END))::bigint AS saldo_usd_historico_cents
   FROM (public.asiento_lineas l
     JOIN public.asientos a ON ((a.id = l.asiento_id)))
  GROUP BY l.user_id, a.moneda, l.cuenta;


--
-- Name: aplicaciones_pago aplicaciones_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_pkey PRIMARY KEY (id);


--
-- Name: app_migraciones app_migraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_migraciones
    ADD CONSTRAINT app_migraciones_pkey PRIMARY KEY (version);


--
-- Name: asiento_lineas asiento_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento_lineas
    ADD CONSTRAINT asiento_lineas_pkey PRIMARY KEY (id);


--
-- Name: asientos asientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asientos
    ADD CONSTRAINT asientos_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_id_user_id_key UNIQUE (id, user_id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_user_id_tipo_documento_numero_documento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_user_id_tipo_documento_numero_documento_key UNIQUE (user_id, tipo_documento, numero_documento);


--
-- Name: cuotas cuotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas
    ADD CONSTRAINT cuotas_pkey PRIMARY KEY (id);


--
-- Name: cuotas cuotas_prestamo_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas
    ADD CONSTRAINT cuotas_prestamo_id_numero_key UNIQUE (prestamo_id, numero);


--
-- Name: pagos pagos_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_user_id_key UNIQUE (id, user_id);


--
-- Name: pagos_mora pagos_mora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mora
    ADD CONSTRAINT pagos_mora_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id);


--
-- Name: pagos pagos_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: prestamos prestamos_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_id_user_id_key UNIQUE (id, user_id);


--
-- Name: prestamos prestamos_inicio_reciente; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.prestamos
    ADD CONSTRAINT prestamos_inicio_reciente CHECK ((fecha_inicio >= (((created_at AT TIME ZONE 'America/Caracas'::text))::date - 3660))) NOT VALID;


--
-- Name: prestamos prestamos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_pkey PRIMARY KEY (id);


--
-- Name: prestamos prestamos_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: prestamos prestamos_user_id_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_user_id_numero_key UNIQUE (user_id, numero);


--
-- Name: tasa_bcv tasa_bcv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasa_bcv
    ADD CONSTRAINT tasa_bcv_pkey PRIMARY KEY (id);


--
-- Name: user_history user_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_history
    ADD CONSTRAINT user_history_pkey PRIMARY KEY (id);


--
-- Name: aplicaciones_pago_cuota_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aplicaciones_pago_cuota_idx ON public.aplicaciones_pago USING btree (cuota_id);


--
-- Name: aplicaciones_pago_pago_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aplicaciones_pago_pago_idx ON public.aplicaciones_pago USING btree (pago_id);


--
-- Name: asiento_lineas_asiento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asiento_lineas_asiento_idx ON public.asiento_lineas USING btree (asiento_id);


--
-- Name: asiento_lineas_user_cuenta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asiento_lineas_user_cuenta_idx ON public.asiento_lineas USING btree (user_id, cuenta);


--
-- Name: asientos_user_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asientos_user_fecha_idx ON public.asientos USING btree (user_id, fecha);


--
-- Name: auditoria_registro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_registro_idx ON public.auditoria USING btree (registro_id);


--
-- Name: auditoria_user_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_user_fecha_idx ON public.auditoria USING btree (user_id, creado_en DESC);


--
-- Name: clientes_user_nombre_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX clientes_user_nombre_idx ON public.clientes USING btree (user_id, lower(nombre));


--
-- Name: cuotas_user_vencimiento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cuotas_user_vencimiento_idx ON public.cuotas USING btree (user_id, fecha_vencimiento) WHERE (estado = ANY (ARRAY['pendiente'::text, 'parcial'::text]));


--
-- Name: pagos_mora_pago_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_mora_pago_idx ON public.pagos_mora USING btree (pago_id);


--
-- Name: pagos_prestamo_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_prestamo_fecha_idx ON public.pagos USING btree (prestamo_id, fecha DESC);


--
-- Name: pagos_user_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pagos_user_fecha_idx ON public.pagos USING btree (user_id, fecha DESC);


--
-- Name: prestamos_cliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestamos_cliente_idx ON public.prestamos USING btree (cliente_id);


--
-- Name: prestamos_user_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestamos_user_estado_idx ON public.prestamos USING btree (user_id, estado);


--
-- Name: tasa_bcv_fecha_hora_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasa_bcv_fecha_hora_idx ON public.tasa_bcv USING btree (fecha_hora DESC);


--
-- Name: user_history_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_history_user_created_idx ON public.user_history USING btree (user_id, created_at DESC);


--
-- Name: v_prestamos_resumen _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_prestamos_resumen WITH (security_invoker='true') AS
 SELECT p.id,
    p.user_id,
    p.numero,
    p.cliente_id,
    cl.nombre AS cliente_nombre,
    ((cl.tipo_documento || '-'::text) || cl.numero_documento) AS cliente_documento,
    cl.telefono AS cliente_telefono,
    p.moneda,
    p.capital_cents,
    p.interes_total_cents,
    p.total_cents,
    p.tasa_interes,
    p.modalidad_tasa,
    p.frecuencia_pago,
    p.metodo_interes,
    p.fecha_inicio,
    p.fecha_fin,
    p.tasa_cambio,
    p.fuente_tasa_cambio,
    p.tasa_mora_diaria,
    p.dias_gracia,
    p.estado,
    p.notas,
    p.created_at,
    (
        CASE
            WHEN (p.estado = 'anulado'::text) THEN (0)::numeric
            WHEN (p.tipo_plazo = 'abierto'::text) THEN ((p.capital_cents - p.capital_pagado_cents))::numeric
            ELSE COALESCE(sum(v.capital_pendiente_cents), (0)::numeric)
        END)::bigint AS capital_pendiente_cents,
    (COALESCE(sum(v.interes_pendiente_cents), (0)::numeric))::bigint AS interes_pendiente_cents,
    (COALESCE(sum(v.mora_pendiente_cents), (0)::numeric))::bigint AS mora_pendiente_cents,
    ((COALESCE(sum(((v.capital_pagado_cents + v.interes_pagado_cents) + v.mora_pagada_cents)), (0)::numeric) + (p.capital_pagado_cents)::numeric))::bigint AS cobrado_cents,
    (COALESCE(sum(((v.capital_pendiente_cents + v.interes_pendiente_cents) + v.mora_pendiente_cents)) FILTER (WHERE (v.situacion = ANY (ARRAY['vencida'::text, 'vence_hoy'::text]))), (0)::numeric))::bigint AS exigible_hoy_cents,
    COALESCE(max(v.dias_atraso), 0) AS dias_atraso,
    min(v.fecha_vencimiento) FILTER (WHERE (v.situacion <> ALL (ARRAY['pagada'::text, 'anulada'::text]))) AS proximo_vencimiento,
    count(*) FILTER (WHERE (v.situacion = 'vencida'::text)) AS cuotas_vencidas,
    count(*) FILTER (WHERE (v.situacion = 'pagada'::text)) AS cuotas_pagadas,
    count(*) FILTER (WHERE (v.situacion <> 'anulada'::text)) AS cuotas_total,
    p.tipo_plazo,
    (COALESCE(sum((v.interes_cents - v.interes_descontado_cents)) FILTER (WHERE (v.situacion <> 'anulada'::text)), (0)::numeric))::bigint AS interes_generado_cents
   FROM ((public.prestamos p
     JOIN public.clientes cl ON ((cl.id = p.cliente_id)))
     LEFT JOIN public.v_cuotas_estado v ON ((v.prestamo_id = p.id)))
  GROUP BY p.id, cl.id;


--
-- Name: aplicaciones_pago aplicaciones_pago_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aplicaciones_pago_inmutable BEFORE DELETE OR UPDATE ON public.aplicaciones_pago FOR EACH ROW EXECUTE FUNCTION public.fin_inmutable();


--
-- Name: asiento_lineas asiento_lineas_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER asiento_lineas_inmutable BEFORE DELETE OR UPDATE ON public.asiento_lineas FOR EACH ROW EXECUTE FUNCTION public.fin_inmutable();


--
-- Name: asientos asientos_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER asientos_inmutable BEFORE DELETE OR UPDATE ON public.asientos FOR EACH ROW EXECUTE FUNCTION public.fin_inmutable();


--
-- Name: auditoria auditoria_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_inmutable BEFORE DELETE OR UPDATE ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public.fin_inmutable();


--
-- Name: clientes clientes_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clientes_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fin_auditar();


--
-- Name: clientes clientes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();


--
-- Name: cuotas cuotas_sin_borrado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cuotas_sin_borrado BEFORE DELETE ON public.cuotas FOR EACH ROW EXECUTE FUNCTION public.fin_sin_borrado();


--
-- Name: pagos pagos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pagos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.fin_auditar();


--
-- Name: pagos pagos_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pagos_inmutable BEFORE DELETE OR UPDATE ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.fin_pago_inmutable();


--
-- Name: pagos_mora pagos_mora_inmutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pagos_mora_inmutable BEFORE DELETE OR UPDATE ON public.pagos_mora FOR EACH ROW EXECUTE FUNCTION public.fin_inmutable();


--
-- Name: prestamos prestamos_auditoria; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prestamos_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.prestamos FOR EACH ROW EXECUTE FUNCTION public.fin_auditar();


--
-- Name: prestamos prestamos_sin_borrado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prestamos_sin_borrado BEFORE DELETE ON public.prestamos FOR EACH ROW EXECUTE FUNCTION public.fin_sin_borrado();


--
-- Name: prestamos prestamos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prestamos_updated_at BEFORE UPDATE ON public.prestamos FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();


--
-- Name: aplicaciones_pago aplicaciones_pago_cuota_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_cuota_id_fkey FOREIGN KEY (cuota_id) REFERENCES public.cuotas(id) ON DELETE CASCADE;


--
-- Name: aplicaciones_pago aplicaciones_pago_pago_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aplicaciones_pago
    ADD CONSTRAINT aplicaciones_pago_pago_id_user_id_fkey FOREIGN KEY (pago_id, user_id) REFERENCES public.pagos(id, user_id) ON DELETE CASCADE;


--
-- Name: asiento_lineas asiento_lineas_asiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asiento_lineas
    ADD CONSTRAINT asiento_lineas_asiento_id_fkey FOREIGN KEY (asiento_id) REFERENCES public.asientos(id) ON DELETE CASCADE;


--
-- Name: asientos asientos_pago_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asientos
    ADD CONSTRAINT asientos_pago_fk FOREIGN KEY (pago_id, user_id) REFERENCES public.pagos(id, user_id) ON DELETE CASCADE;


--
-- Name: asientos asientos_prestamo_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asientos
    ADD CONSTRAINT asientos_prestamo_id_user_id_fkey FOREIGN KEY (prestamo_id, user_id) REFERENCES public.prestamos(id, user_id) ON DELETE CASCADE;


--
-- Name: asientos asientos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asientos
    ADD CONSTRAINT asientos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: auditoria auditoria_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clientes clientes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cuotas cuotas_prestamo_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuotas
    ADD CONSTRAINT cuotas_prestamo_id_user_id_fkey FOREIGN KEY (prestamo_id, user_id) REFERENCES public.prestamos(id, user_id) ON DELETE CASCADE;


--
-- Name: pagos_mora pagos_mora_cuota_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mora
    ADD CONSTRAINT pagos_mora_cuota_id_fkey FOREIGN KEY (cuota_id) REFERENCES public.cuotas(id) ON DELETE CASCADE;


--
-- Name: pagos_mora pagos_mora_pago_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mora
    ADD CONSTRAINT pagos_mora_pago_id_user_id_fkey FOREIGN KEY (pago_id, user_id) REFERENCES public.pagos(id, user_id) ON DELETE CASCADE;


--
-- Name: pagos pagos_prestamo_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_prestamo_id_user_id_fkey FOREIGN KEY (prestamo_id, user_id) REFERENCES public.prestamos(id, user_id) ON DELETE CASCADE;


--
-- Name: prestamos prestamos_cliente_id_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_cliente_id_user_id_fkey FOREIGN KEY (cliente_id, user_id) REFERENCES public.clientes(id, user_id) ON DELETE RESTRICT;


--
-- Name: prestamos prestamos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestamos
    ADD CONSTRAINT prestamos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_history user_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_history
    ADD CONSTRAINT user_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: aplicaciones_pago; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aplicaciones_pago ENABLE ROW LEVEL SECURITY;

--
-- Name: aplicaciones_pago aplicaciones_pago_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aplicaciones_pago_select ON public.aplicaciones_pago FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: app_migraciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_migraciones ENABLE ROW LEVEL SECURITY;

--
-- Name: asiento_lineas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asiento_lineas ENABLE ROW LEVEL SECURITY;

--
-- Name: asiento_lineas asiento_lineas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asiento_lineas_select ON public.asiento_lineas FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: asientos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asientos ENABLE ROW LEVEL SECURITY;

--
-- Name: asientos asientos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asientos_select ON public.asientos FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria auditoria_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_select ON public.auditoria FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes clientes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: clientes clientes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: clientes clientes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: clientes clientes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: cuotas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cuotas ENABLE ROW LEVEL SECURITY;

--
-- Name: cuotas cuotas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cuotas_select ON public.cuotas FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: pagos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_mora; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos_mora ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_mora pagos_mora_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagos_mora_select ON public.pagos_mora FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: pagos pagos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pagos_select ON public.pagos FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: prestamos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;

--
-- Name: prestamos prestamos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prestamos_select ON public.prestamos FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: tasa_bcv; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasa_bcv ENABLE ROW LEVEL SECURITY;

--
-- Name: tasa_bcv tasa_bcv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasa_bcv_select ON public.tasa_bcv FOR SELECT TO authenticated, anon USING (true);


--
-- Name: user_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;

--
-- Name: user_history user_history_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_history_delete ON public.user_history FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_history user_history_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_history_insert ON public.user_history FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_history user_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_history_select ON public.user_history FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: FUNCTION anular_pago(p_pago_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anular_pago(p_pago_id uuid, p_motivo text) TO authenticated;


--
-- Name: FUNCTION anular_pagos_desde(p_pago_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anular_pagos_desde(p_pago_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anular_pagos_desde(p_pago_id uuid, p_motivo text) TO authenticated;


--
-- Name: FUNCTION anular_prestamo(p_prestamo_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.anular_prestamo(p_prestamo_id uuid, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.anular_prestamo(p_prestamo_id uuid, p_motivo text) TO authenticated;


--
-- Name: FUNCTION emitir_prestamo(p_cliente_id uuid, p_moneda text, p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_frecuencia_pago text, p_metodo_interes text, p_fecha_inicio date, p_fecha_fin date, p_tasa_cambio numeric, p_fuente_tasa_cambio text, p_tasa_mora_diaria numeric, p_dias_gracia integer, p_notas text, p_cotizacion_origen text, p_idempotency_key uuid, p_tipo_plazo text, p_confirmar_tasa boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.emitir_prestamo(p_cliente_id uuid, p_moneda text, p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_frecuencia_pago text, p_metodo_interes text, p_fecha_inicio date, p_fecha_fin date, p_tasa_cambio numeric, p_fuente_tasa_cambio text, p_tasa_mora_diaria numeric, p_dias_gracia integer, p_notas text, p_cotizacion_origen text, p_idempotency_key uuid, p_tipo_plazo text, p_confirmar_tasa boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.emitir_prestamo(p_cliente_id uuid, p_moneda text, p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_frecuencia_pago text, p_metodo_interes text, p_fecha_inicio date, p_fecha_fin date, p_tasa_cambio numeric, p_fuente_tasa_cambio text, p_tasa_mora_diaria numeric, p_dias_gracia integer, p_notas text, p_cotizacion_origen text, p_idempotency_key uuid, p_tipo_plazo text, p_confirmar_tasa boolean) TO authenticated;


--
-- Name: FUNCTION fin_actualizar_estados(p_prestamo_id uuid, p_fecha date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_actualizar_estados(p_prestamo_id uuid, p_fecha date) FROM PUBLIC;


--
-- Name: FUNCTION fin_auditar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_auditar() FROM PUBLIC;


--
-- Name: FUNCTION fin_capital_abierto_al(p_prestamo_id uuid, p_fecha date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_capital_abierto_al(p_prestamo_id uuid, p_fecha date) FROM PUBLIC;


--
-- Name: FUNCTION fin_convertir(cents bigint, tasa numeric, de text, a text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_convertir(cents bigint, tasa numeric, de text, a text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_convertir(cents bigint, tasa numeric, de text, a text) TO authenticated;


--
-- Name: FUNCTION fin_cronograma(p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_cronograma(p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_cronograma(p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) TO authenticated;


--
-- Name: FUNCTION fin_devengar_mora(p_prestamo_id uuid, p_hasta date, p_pago_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_devengar_mora(p_prestamo_id uuid, p_hasta date, p_pago_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION fin_dias_frecuencia(frecuencia text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_dias_frecuencia(frecuencia text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_dias_frecuencia(frecuencia text) TO authenticated;


--
-- Name: FUNCTION fin_dias_modalidad(modalidad text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_dias_modalidad(modalidad text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_dias_modalidad(modalidad text) TO authenticated;


--
-- Name: FUNCTION fin_div_half_even(n numeric, d numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_div_half_even(n numeric, d numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_div_half_even(n numeric, d numeric) TO authenticated;


--
-- Name: FUNCTION fin_formato_monto(p_cents bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_formato_monto(p_cents bigint) FROM PUBLIC;


--
-- Name: FUNCTION fin_hoy(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_hoy() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_hoy() TO authenticated;


--
-- Name: FUNCTION fin_inmutable(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_inmutable() FROM PUBLIC;


--
-- Name: FUNCTION fin_interes_simple(capital bigint, tasa numeric, dias integer, base integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_interes_simple(capital bigint, tasa numeric, dias integer, base integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_interes_simple(capital bigint, tasa numeric, dias integer, base integer) TO authenticated;


--
-- Name: FUNCTION fin_linea(p_asiento uuid, p_user uuid, p_cuenta text, p_debe bigint, p_haber bigint, p_moneda text, p_tasa numeric, p_moneda_original text, p_monto_original bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_linea(p_asiento uuid, p_user uuid, p_cuenta text, p_debe bigint, p_haber bigint, p_moneda text, p_tasa numeric, p_moneda_original text, p_monto_original bigint) FROM PUBLIC;


--
-- Name: TABLE cuotas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cuotas TO authenticated;


--
-- Name: FUNCTION fin_mora_adicional(c public.cuotas, p_tasa_mora numeric, p_gracia integer, p_hasta date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_mora_adicional(c public.cuotas, p_tasa_mora numeric, p_gracia integer, p_hasta date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_mora_adicional(c public.cuotas, p_tasa_mora numeric, p_gracia integer, p_hasta date) TO authenticated;


--
-- Name: FUNCTION fin_pago_inmutable(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_pago_inmutable() FROM PUBLIC;


--
-- Name: FUNCTION fin_recalcular_abierto_desde(p_prestamo_id uuid, p_desde date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_recalcular_abierto_desde(p_prestamo_id uuid, p_desde date) FROM PUBLIC;


--
-- Name: FUNCTION fin_repartir(total bigint, pesos bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_repartir(total bigint, pesos bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_repartir(total bigint, pesos bigint[]) TO authenticated;


--
-- Name: FUNCTION fin_sin_borrado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_sin_borrado() FROM PUBLIC;


--
-- Name: FUNCTION fin_sincronizar_abierto(p_prestamo_id uuid, p_hasta date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_sincronizar_abierto(p_prestamo_id uuid, p_hasta date) FROM PUBLIC;


--
-- Name: FUNCTION fin_tasa_actual(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_tasa_actual() FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_tasa_actual() TO authenticated;


--
-- Name: FUNCTION fin_texto_seguro(valor text, max_len integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_texto_seguro(valor text, max_len integer) FROM PUBLIC;


--
-- Name: FUNCTION fin_touch_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_touch_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION fin_usuario_actual(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_usuario_actual() FROM PUBLIC;


--
-- Name: FUNCTION fin_validar_asiento(p_asiento uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_validar_asiento(p_asiento uuid) FROM PUBLIC;


--
-- Name: FUNCTION fin_validar_tasa_cambio(p_tasa numeric, p_confirmada boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_validar_tasa_cambio(p_tasa numeric, p_confirmada boolean) FROM PUBLIC;


--
-- Name: FUNCTION fin_validar_terminos(p_moneda text, p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fin_validar_terminos(p_moneda text, p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fin_validar_terminos(p_moneda text, p_capital_cents bigint, p_tasa numeric, p_modalidad text, p_inicio date, p_fin date, p_frecuencia text, p_metodo text) TO authenticated;


--
-- Name: FUNCTION monto_cancelacion(p_prestamo_id uuid, p_fecha date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.monto_cancelacion(p_prestamo_id uuid, p_fecha date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.monto_cancelacion(p_prestamo_id uuid, p_fecha date) TO authenticated;


--
-- Name: FUNCTION previsualizar_cronograma(p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_fecha_inicio date, p_fecha_fin date, p_frecuencia_pago text, p_metodo_interes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.previsualizar_cronograma(p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_fecha_inicio date, p_fecha_fin date, p_frecuencia_pago text, p_metodo_interes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.previsualizar_cronograma(p_capital_cents bigint, p_tasa_interes numeric, p_modalidad_tasa text, p_fecha_inicio date, p_fecha_fin date, p_frecuencia_pago text, p_metodo_interes text) TO authenticated;


--
-- Name: FUNCTION registrar_pago(p_prestamo_id uuid, p_fecha date, p_moneda_pago text, p_monto_pago_cents bigint, p_tasa_cambio numeric, p_tipo text, p_modo_abono text, p_metodo text, p_referencia text, p_notas text, p_idempotency_key uuid, p_confirmar_tasa boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.registrar_pago(p_prestamo_id uuid, p_fecha date, p_moneda_pago text, p_monto_pago_cents bigint, p_tasa_cambio numeric, p_tipo text, p_modo_abono text, p_metodo text, p_referencia text, p_notas text, p_idempotency_key uuid, p_confirmar_tasa boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_pago(p_prestamo_id uuid, p_fecha date, p_moneda_pago text, p_monto_pago_cents bigint, p_tasa_cambio numeric, p_tipo text, p_modo_abono text, p_metodo text, p_referencia text, p_notas text, p_idempotency_key uuid, p_confirmar_tasa boolean) TO authenticated;


--
-- Name: FUNCTION reporte_diferencial_cambiario(p_tasa_actual numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reporte_diferencial_cambiario(p_tasa_actual numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reporte_diferencial_cambiario(p_tasa_actual numeric) TO authenticated;


--
-- Name: FUNCTION sincronizar_prestamos_abiertos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sincronizar_prestamos_abiertos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sincronizar_prestamos_abiertos() TO authenticated;


--
-- Name: TABLE aplicaciones_pago; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.aplicaciones_pago TO authenticated;


--
-- Name: TABLE asiento_lineas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.asiento_lineas TO authenticated;


--
-- Name: TABLE asientos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.asientos TO authenticated;


--
-- Name: TABLE auditoria; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.auditoria TO authenticated;


--
-- Name: TABLE clientes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.tipo_documento; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tipo_documento),UPDATE(tipo_documento) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.numero_documento; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(numero_documento),UPDATE(numero_documento) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.nombre; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(nombre),UPDATE(nombre) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.telefono; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(telefono),UPDATE(telefono) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.email; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(email),UPDATE(email) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.direccion; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(direccion),UPDATE(direccion) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.referencia; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(referencia),UPDATE(referencia) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.notas; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(notas),UPDATE(notas) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.limite_credito_cents; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(limite_credito_cents),UPDATE(limite_credito_cents) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.moneda_limite; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(moneda_limite),UPDATE(moneda_limite) ON TABLE public.clientes TO authenticated;


--
-- Name: COLUMN clientes.estado; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(estado),UPDATE(estado) ON TABLE public.clientes TO authenticated;


--
-- Name: TABLE pagos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.pagos TO authenticated;


--
-- Name: TABLE pagos_mora; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.pagos_mora TO authenticated;


--
-- Name: TABLE prestamos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.prestamos TO authenticated;


--
-- Name: TABLE tasa_bcv; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tasa_bcv TO anon;
GRANT SELECT ON TABLE public.tasa_bcv TO authenticated;


--
-- Name: TABLE user_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.user_history TO authenticated;


--
-- Name: TABLE v_prestamos_resumen; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_prestamos_resumen TO authenticated;


--
-- Name: TABLE v_cartera_antiguedad; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_cartera_antiguedad TO authenticated;


--
-- Name: TABLE v_cobranza_mensual; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_cobranza_mensual TO authenticated;


--
-- Name: TABLE v_cuotas_estado; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_cuotas_estado TO authenticated;


--
-- Name: TABLE v_libro_mayor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.v_libro_mayor TO authenticated;


--
-- PostgreSQL database dump complete
--


--
-- Registro de migraciones: una base reconstruida con este archivo queda al día.
--

INSERT INTO public.app_migraciones (version) VALUES
  ('20261011000000'),('20261011000100'),('20261011000200'),('20261011000300'),('20261011000400'),('20261012000100'),('20261012000200'),('20261013000100'),('20261014000100'),('20261014000200'),('20261014000300'),('20261014000400'),('20261018000100')
ON CONFLICT DO NOTHING;
