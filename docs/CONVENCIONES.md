# Convenciones de código

Reglas para que el proyecto siga ordenado a medida que crece. `npm run lint` hace cumplir las que se pueden
comprobar automáticamente (ver `.oxlintrc.json`) y la CI no deja pasar errores.

## Dónde va cada cosa

| Carpeta | Contiene | No contiene |
| --- | --- | --- |
| `shared/` | Lógica pura y compartida: dinero en centavos, fechas, cronogramas, validación, catálogos (`shared/catalogos.js`). Sin React, sin red, sin `window`. | Componentes, llamadas a Supabase |
| `src/features/<módulo>/` | Pantallas de cada módulo (`clientes`, `prestamos`, `cobranza`, `reportes`, `calculadora`). Un archivo por pantalla o pieza (`PrestamosLista`, `PrestamoDetalle`, `PagosRecibidos`…). | Lógica de negocio que deba coincidir con la base |
| `src/features/cartera/` | Piezas comunes de la cartera: `api.js` (único acceso a datos), `ui.jsx`, `useRemote`, `useAccion`, `useMotivoDialog`, enrutador por hash. | |
| `src/components/` | Componentes generales (encabezado, modales de cuenta, calculadora). Subcarpetas por tema (`auth/`). | Acceso directo a Supabase |
| `src/services/` | Comunicación con la API propia y almacenamiento local (`bcvService`, `tasaPersonalizada`). | |
| `src/context/` | Proveedores de React; el contexto y su hook van en `useX.js` aparte. | |
| `api/` | Funciones del servidor (Vercel). `server/index.js` las sirve en desarrollo: **no** duplicar su lógica. | |
| `supabase/migrations/` | Cambios de base de datos, uno por archivo, con fecha. Nunca editar una migración ya aplicada en producción: crear una nueva. | |

## Reglas

1. **Datos**: ningún componente llama a `supabase.from()` o `supabase.rpc()`; todo pasa por
   `src/features/cartera/api.js`, que traduce los errores. Préstamos, cuotas, pagos y asientos solo se
   escriben con funciones RPC del servidor.
2. **Una sola fuente**: textos de catálogos en `shared/catalogos.js`; fechas en `shared/finance/dates.js`
   (`toDisplayDate`, `toDisplayDateCaracas`, `toDisplayDateTimeCaracas`); dinero en centavos con
   `shared/finance/money.js`. Si te ves copiando un mapa o una función, muévela a `shared/`.
3. **La base manda**: toda regla que proteja el dinero (montos, tasas, límites, orden de pagos) se valida en
   SQL; la interfaz solo la anticipa para dar mejores mensajes. `tests/catalogos.test.js` comprueba que los
   catálogos coincidan con los `CHECK` de la base.
4. **Acciones**: escrituras con `useAccion()` (estado ocupado y error en un solo lugar) y confirmaciones con
   `useMotivoDialog()`. Nada de `window.prompt`, `window.confirm` ni `alert`.
5. **Tamaño**: un archivo no pasa de 400 líneas, ni una función de 6 parámetros, ni 4 niveles de anidación
   (avisos de lint). Si un componente crece, se divide por responsabilidad.
6. **Seguridad**: nada de `dangerouslySetInnerHTML`, `eval` ni enlaces `target="_blank"` sin `rel`. El
   navegador solo se conecta a su propio dominio y a Supabase (CSP en `vercel.json`, comprobada en
   `tests/securityHeaders.test.js`). La clave de servicio solo vive en el servidor.
7. **Almacenamiento local**: siempre dentro de `try/catch` (ventanas privadas). Solo preferencias y cachés,
   nunca datos que deban ser la fuente de verdad.
8. **Base de datos**: funciones `SECURITY DEFINER` con `set search_path = ''`, permisos explícitos (revocar a
   `public` y `anon`), RLS en toda tabla con `user_id`. Tras cada migración: `npm run db:bundle` y
   `sh scripts/esquema-desde-local.sh` para actualizar el instalador y el respaldo de la estructura.

## Antes de subir cambios

```bash
npm run lint
PGTEST_URL=postgres://postgres:clave@localhost:5432/postgres npm test
npm run build
```
