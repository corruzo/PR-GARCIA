# Base de datos (Supabase)

Las migraciones viven en `supabase/migrations/` y se aplican **en orden de nombre**.
El código no las ejecuta: debe hacerlo una persona con acceso al proyecto.

Proyecto actual: `muxxvbcxzqszstiotbwu` (el proyecto anterior quedó sin acceso).

## Instalar en un proyecto nuevo (una sola vez)

El SQL Editor de Supabase limita el tamaño de cada consulta, así que la instalación está dividida en 8 archivos en `supabase/instalar/`:

1. Supabase → **SQL Editor** → *New query* → pega **todo** `parte-1.sql` → **Run**. Debe decir *Success*.
2. Nueva consulta (o borra el contenido) → pega `parte-2.sql` → **Run**.
3. Igual con `parte-3.sql` a `parte-8.sql`, en ese orden.

Ejecútalas **en orden** y **una sola vez**. Cada parte corre en una transacción: si una falla, no deja nada a medias; corrige el problema y repite solo esa parte.

## Actualizar una instalación existente

Cada migración queda anotada en la tabla `app_migraciones`. Para saber qué falta:

```sql
select version, aplicada_en from public.app_migraciones order by version;
```

Ejecuta solo las partes cuyas migraciones no aparezcan. Si pegas por error una parte ya aplicada, se detiene con
«La migración … ya está aplicada» sin tocar nada. Una instalación anterior a esta tabla (partes 1 a 6) solo necesita
`parte-7.sql` y `parte-8.sql`: la parte 7 crea la tabla y registra las migraciones previas.

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
- *Authentication → Providers → Email*: **Minimum password length = 8** y requisitos de letras y números (la app ya lo exige al registrar); activa *Secure password change* y *Confirm email*.
- *Authentication → Sign In / Providers*: si la app es solo para ti, desactiva **Allow new users to sign up** después de crear tu cuenta.
- *Database → Backups*: revisa que haya copias diarias (el plan Pro las incluye; con el plan gratuito exporta tus datos desde **Reportes → Respaldo de datos**).

## Migraciones

| Migración | Contenido |
| --- | --- |
| `20261011000000_base.sql` | `tasa_bcv` con RLS y `user_history` (cotizaciones de la versión anterior; la app actual ya no la usa) |
| `20261011000100_nucleo_cartera.sql` | Clientes, préstamos, cuotas, libro contable, RLS, `emitir_prestamo`, `anular_prestamo`, `previsualizar_cronograma` |
| `20261011000200_pagos_mora.sql` | Pagos, aplicaciones, mora diaria, interés sobre saldo, `registrar_pago`, `anular_pago`, `monto_cancelacion`, vistas `v_cuotas_estado` y `v_prestamos_resumen` |
| `20261011000300_reportes_bimonetarios.sql` | `fin_tasa_actual`, antigüedad de cartera, cobranza mensual, libro mayor, `reporte_diferencial_cambiario` |
| `20261011000400_auditoria.sql` | Bitácora inmutable de clientes, préstamos y pagos |
| `20261012000100_prestamos_abiertos.sql` | Préstamos sin fecha de fin: columnas, generación de períodos de interés, `emitir_prestamo` con `p_tipo_plazo` |
| `20261012000200_prestamos_abiertos_pagos.sql` | Pagos, anulación, resumen y cancelación para préstamos abiertos; `sincronizar_prestamos_abiertos` |
| `20261013000100_cliente_rapido.sql` | Clientes con solo el nombre (documento opcional) |
| `20261014000100_correcciones_auditoria.sql` | `app_migraciones`; `fin_hoy` sin fecha simulada desde la API; tasas `referencial`; confirmación de tasa de cambio (±20 % de la BCV); límite de crédito; mora devengada por pago (`pagos_mora`); recálculo de préstamos abiertos |
| `20261014000200_correcciones_pagos.sql` | `registrar_pago` (confirmación de tasa; préstamo en USD solo recibe intereses y mora en Bs), `anular_pago` (revierte mora y recalcula abiertos), `anular_pagos_desde`; libro contable, pagos y auditoría inmutables; funciones internas cerradas a anónimos |

## Pruebas locales

Las pruebas de base de datos usan un Postgres local con `supabase/tests/bootstrap_local.sql`
(emula `auth.uid()` y los roles `anon`/`authenticated`):

```bash
PGTEST_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

Sin `PGTEST_URL`, `npm test` las omite.
