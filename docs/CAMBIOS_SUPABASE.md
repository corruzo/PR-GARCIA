# Cambios pendientes en Supabase

Las migraciones viven en `supabase/migrations/` y se aplican **en orden de nombre**.
El código no las ejecuta: debe hacerlo una persona con acceso al proyecto.

## Cómo aplicarlas

Opción A — Supabase CLI (recomendada):

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

Opción B — Panel de Supabase: *SQL Editor* → pegar y ejecutar cada archivo en orden.

## Estado

| Migración | Contenido | Aplicada |
| --- | --- | --- |
| `20261011000100_nucleo_cartera.sql` | Clientes, préstamos, cuotas, libro contable, RLS, `emitir_prestamo`, `anular_prestamo`, `previsualizar_cronograma` | ☐ |

## Pruebas locales

Las pruebas de base de datos usan un Postgres local con `supabase/tests/bootstrap_local.sql`
(emula `auth.uid()` y los roles `anon`/`authenticated`):

```bash
PGTEST_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

Sin `PGTEST_URL`, `npm test` las omite.
