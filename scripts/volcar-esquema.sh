#!/usr/bin/env sh
# Regenera supabase/esquema/esquema_completo.sql desde una base con todas las
# migraciones aplicadas (por ejemplo, tu proyecto de Supabase).
# Uso: DATABASE_URL="postgresql://postgres:CLAVE@db.TU_PROYECTO.supabase.co:5432/postgres" sh scripts/volcar-esquema.sh
# (Supabase → Project Settings → Database → Connection string; usa pg_dump 15 o superior.)
set -eu
: "${DATABASE_URL:?Define DATABASE_URL con la cadena de conexión de la base}"
salida="$(dirname "$0")/../supabase/esquema/esquema_completo.actual.sql"
pg_dump "$DATABASE_URL" --schema-only --schema=public --no-owner > "$salida"
echo "Estructura volcada en $salida. Compárala con supabase/esquema/esquema_completo.sql (diff)."
