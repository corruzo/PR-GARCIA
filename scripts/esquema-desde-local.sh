#!/usr/bin/env sh
# Regenera supabase/esquema/esquema_completo.sql instalando supabase/instalar/
# en una base vacía de la imagen oficial de Supabase (contenedor Docker «sbdb»,
# puerto 54322). Uso: sh scripts/esquema-desde-local.sh
set -eu
cd "$(dirname "$0")/.."
export PGPASSWORD="${PGPASSWORD:-pgpass}"
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h localhost -p 54322 -U postgres -X -q -v ON_ERROR_STOP=1"
$P -c "drop database if exists esquema_tmp with (force)" -c "create database esquema_tmp" >/dev/null
$P -d esquema_tmp -f supabase/tests/bootstrap_local.sql >/dev/null 2>&1
for f in $(ls supabase/instalar/parte-*.sql | sort -V); do $P -d esquema_tmp -f "$f" >/dev/null; done
ultima=$(ls supabase/migrations/*.sql | sort | tail -1 | xargs basename | cut -c1-14)
versiones=$(ls supabase/migrations/*.sql | sort | xargs -n1 basename | cut -c1-14 | sed "s/.*/('&')/" | paste -sd, -)
{
  cat <<HEAD
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
-- Migraciones incluidas: hasta ${ultima}.
-- ════════════════════════════════════════════════════════════════════════════

HEAD
  docker exec -e PGPASSWORD="$PGPASSWORD" sbdb pg_dump -h localhost -U postgres -d esquema_tmp --schema-only --schema=public --no-owner \
    | grep -v '^-- Dumped \(from\|by\)' | sed 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/'
  printf '\n--\n-- Registro de migraciones: una base reconstruida con este archivo queda al día.\n--\n\n'
  printf 'INSERT INTO public.app_migraciones (version) VALUES\n  %s\nON CONFLICT DO NOTHING;\n' "$versiones"
} > supabase/esquema/esquema_completo.sql
$P -c "drop database esquema_tmp" >/dev/null
echo "supabase/esquema/esquema_completo.sql regenerado (hasta $ultima)."
