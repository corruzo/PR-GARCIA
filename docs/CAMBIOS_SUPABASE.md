# Base de datos (Supabase)

Las migraciones viven en `supabase/migrations/` y se aplican **en orden de nombre**.
El código no las ejecuta: debe hacerlo una persona con acceso al proyecto.

Proyecto actual: `muxxvbcxzqszstiotbwu` (el proyecto anterior quedó sin acceso).

## Instalar en un proyecto nuevo (una sola vez)

El SQL Editor de Supabase limita el tamaño de cada consulta, así que la instalación está dividida en 6 archivos en `supabase/instalar/`:

1. Supabase → **SQL Editor** → *New query* → pega **todo** `parte-1.sql` → **Run**. Debe decir *Success*.
2. Nueva consulta (o borra el contenido) → pega `parte-2.sql` → **Run**.
3. Igual con `parte-3.sql` a `parte-6.sql`, en ese orden.

**Si ya instalaste algunas partes**, ejecuta solo las siguientes (por ejemplo, si llegaste a la 5, ejecuta la `parte-6.sql`).

Ejecútalas **en orden** y **una sola vez**. Cada parte corre en una transacción: si una falla, no deja nada a medias; corrige el problema y repite solo esa parte.

Las partes se generan con `npm run db:bundle` a partir de `supabase/migrations/` (sin comentarios ni líneas vacías).
`tests/migrationsBundle.test.js` avisa si quedaron desactualizadas, y `PGTEST_FROM=instalar npm run test:db` prueba la base instalada desde ellas.

Alternativa con la CLI: `npx supabase link --project-ref muxxvbcxzqszstiotbwu` y `npx supabase db push`.

## Variables de entorno

| Variable | Dónde | Valor |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel + `.env.local` | `https://muxxvbcxzqszstiotbwu.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Clave publicable (`sb_publishable_…`) |
| `SUPABASE_URL` | Solo Vercel (funciones `api/`) | La misma URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Vercel, como secreto | *Settings → API Keys → secret / service_role*. Nunca en el navegador, en el chat ni en Git |

`.env.local` está ignorado por Git (`.env*` en `.gitignore`).

## Autenticación (panel de Supabase)

- *Authentication → URL Configuration*: **Site URL** = dominio de producción; en **Redirect URLs** agrega ese dominio y `http://localhost:5173`.
- *Authentication → Providers*: activa Google y/o Apple si usarás esos botones (requieren sus credenciales OAuth).
- *Authentication → Email Templates*: la recuperación de contraseña usa código de un solo uso; la plantilla debe incluir `{{ .Token }}`.

## Migraciones

| Migración | Contenido |
| --- | --- |
| `20261011000000_base.sql` | `user_history` (cotizaciones) y `tasa_bcv` con RLS |
| `20261011000100_nucleo_cartera.sql` | Clientes, préstamos, cuotas, libro contable, RLS, `emitir_prestamo`, `anular_prestamo`, `previsualizar_cronograma` |
| `20261011000200_pagos_mora.sql` | Pagos, aplicaciones, mora diaria, interés sobre saldo, `registrar_pago`, `anular_pago`, `monto_cancelacion`, vistas `v_cuotas_estado` y `v_prestamos_resumen` |
| `20261011000300_reportes_bimonetarios.sql` | `fin_tasa_actual`, antigüedad de cartera, cobranza mensual, libro mayor, `reporte_diferencial_cambiario` |
| `20261011000400_auditoria.sql` | Bitácora inmutable de clientes, préstamos y pagos |
| `20261012000100_prestamos_abiertos.sql` | Préstamos sin fecha de fin: columnas, generación de períodos de interés, `emitir_prestamo` con `p_tipo_plazo` |
| `20261012000200_prestamos_abiertos_pagos.sql` | Pagos, anulación, resumen y cancelación para préstamos abiertos; `sincronizar_prestamos_abiertos` |
| `20261013000100_cliente_rapido.sql` | Clientes con solo el nombre (documento opcional) |

## Pruebas locales

Las pruebas de base de datos usan un Postgres local con `supabase/tests/bootstrap_local.sql`
(emula `auth.uid()` y los roles `anon`/`authenticated`):

```bash
PGTEST_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

Sin `PGTEST_URL`, `npm test` las omite.
