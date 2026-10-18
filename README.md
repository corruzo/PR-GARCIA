# PRGARCÍA

Gestión de préstamos y cartera bimonetaria (USD/VES) con tasa BCV y soporte PWA: calculadora, clientes, préstamos con cronograma, pagos y abonos, mora, cobranza, contabilidad y reportes de diferencial cambiario.

Antes de usar los módulos de cartera hay que aplicar las migraciones de `supabase/migrations/` (ver `docs/CAMBIOS_SUPABASE.md`; para actualizar una instalación existente, consulta la tabla `app_migraciones`).

## Requisitos

- Node.js 22.9+
- npm

## Scripts locales

```bash
npm install
npm run dev
```

`npm run dev` levanta dos procesos: Vite en `http://localhost:5173` y la API local en `http://localhost:8787`.
La API local ejecuta **las mismas funciones de `api/`** que Vercel (no hay una segunda implementación). Con
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` guarda y lee la tasa en Supabase; sin ellas consulta
la tasa en vivo sin guardarla.

Para ejecutar solo la API local:

```bash
npm run dev:api
```

El contrato local es el mismo que en producción:

- `GET /api/bcv`: consulta el BCV oficial y persiste la tasa.
- `GET /api/bcv/latest`: devuelve la última tasa persistida.

## Backend Vercel

En Vercel, las mismas rutas serverless consultan el BCV y guardan la tasa en Supabase. El navegador solo habla con `/api/bcv`: nunca llama directamente al BCV ni a proveedores externos.

### Variables de entorno requeridas

```bash
SUPABASE_URL=tu_url
SUPABASE_SERVICE_ROLE_KEY=tu_clave
```

### Endpoint

- GET /api/bcv -> consulta la tasa oficial del BCV y la guarda en la tabla `tasa_bcv`
- GET /api/bcv/latest -> devuelve la última tasa almacenada

La ruta de actualización solo acepta GET y exige que Supabase esté configurado; nunca guarda una tasa EUR como USD ni confirma éxito si la persistencia falla.

La tabla `tasa_bcv` la crea el instalador de Supabase (ver `docs/CAMBIOS_SUPABASE.md`). Las tasas del BCV se guardan con estado `ok`; las de proveedores referenciales, con estado `referencial`.

## Despliegue en Vercel

1. Conecta este repo a Vercel.
2. Agrega las variables de entorno de Supabase (y `VITE_CONTACT_EMAIL` si quieres el enlace de contacto).
3. Haz deploy.
4. La ruta API queda disponible en tu dominio de Vercel.

El flujo recomendado es probar en local con `npm run dev` y luego desplegar en Vercel conectado a Supabase.

## Calidad

`npm run lint`, `npm test` y `npm run build`. Las pruebas de base de datos necesitan un Postgres local:
`PGTEST_URL=postgres://postgres:clave@localhost:5432/postgres npm test`. El workflow `.github/workflows/ci.yml` ejecuta todo en cada push.
