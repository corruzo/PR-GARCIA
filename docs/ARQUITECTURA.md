# Arquitectura de PRGARCÍA

## Estructura actual

- `src/App.jsx`: estado principal, acceso autenticado, pestañas internas e historial de cotizaciones.
- `src/components/`: formularios y vistas React; `src/context/` contiene autenticación y tema.
- `shared/finance/`: núcleo financiero puro en centavos enteros (`money.js`, `dates.js`, `schedule.js`, `input.js`, `report.js`), compartido por cliente, servidor y pruebas.
- `src/features/`: módulos de cartera — `clientes/`, `prestamos/`, `cobranza/`, `reportes/` y `cartera/` (API Supabase, enrutador por hash, navegación y componentes comunes).
- `supabase/migrations/`: esquema, RLS, RPC y vistas; `supabase/tests/bootstrap_local.sql` emula Supabase para pruebas locales.
- `src/utils/calculator.js`: adaptador de la calculadora sobre `shared/finance/`, sin acceso a red o base de datos.
- `src/services/`: clientes HTTP y caché local de tasa.
- `src/hooks/`: estado compartido de tasa BCV y preferencias.
- `api/`: funciones serverless de Vercel; `api/_lib/` contiene clientes de servidor.
- `server/`: API de desarrollo de la tasa BCV con SQLite local (`npm run dev:api`, puerto 8787); no se usa en Vercel.
- `tests/`: pruebas de Node `node:test`; `docs/`: decisiones y SQL pendiente de ejecución.

## Navegación y módulos

La app es una SPA en la ruta pública `/`. Sin sesión muestra la bienvenida; con sesión, la vista activa se toma del hash (`#/clientes`, `#/prestamos/<id>`, `#/prestamos/nuevo?cliente=<id>`…) mediante `src/features/cartera/router.js`, que valida vista e identificadores. Los módulos se registran en `src/features/cartera/navigation.js`, que alimenta `Header.jsx` y `SidebarMobile.jsx`. Cada módulo se carga de forma diferida (`lazy`).

Flujo principal: Calculadora (solo estima y comparte) → «Convertir en préstamo» → elegir o crear el cliente (basta el nombre) → Nuevo préstamo → Detalle con cronograma → Registrar pago / abono → Cobranza (vencidas, hoy, próximos 7 días, recordatorio por WhatsApp) → Reportes.

## Acceso a datos

- La calculadora importa funciones puras de `src/utils/calculator.js`.
- Cartera: el navegador lee tablas y vistas (`v_prestamos_resumen`, `v_cuotas_estado`, …) con RLS. Préstamos, cuotas, pagos y asientos **solo** se escriben mediante RPC `SECURITY DEFINER` (`emitir_prestamo`, `registrar_pago`, `anular_pago`, `anular_prestamo`), que validan, recalculan en el servidor y son idempotentes. Todas las llamadas están en `src/features/cartera/api.js`.
- Reglas de dinero: centavos `bigint` + moneda; tasas `numeric(20,8)`; redondeo mitad al par idéntico en JS y SQL (verificado por `tests/dbCartera.test.js`). La tasa de cambio se fija en cada préstamo y en cada pago.
- Nada se borra: pagos y préstamos se anulan con motivo y asiento de reverso; `auditoria` guarda el antes/después.
- El navegador usa Supabase Auth con la clave publicable. La tabla `user_history` es de la versión anterior (cotizaciones guardadas) y ya no se usa.
- La tasa de cambio de préstamos y pagos se valida en el servidor contra la última tasa BCV oficial guardada (estado `ok`): si se aleja más del 20 %, la RPC exige `p_confirmar_tasa`. Las tasas de proveedores referenciales se guardan con estado `referencial` y no cuentan como oficiales.
- Préstamo en USD: en bolívares solo se reciben intereses y mora (regla aplicada en `registrar_pago`).
- `asientos`, `asiento_lineas`, `aplicaciones_pago`, `pagos_mora` y `auditoria` no admiten cambios ni borrados; los pagos solo admiten su anulación. Solo se borran en cascada al eliminar la cuenta.
- Para corregir un pago antiguo, `anular_pagos_desde` anula ese pago y todos los posteriores (los pagos se aplican en orden).
- Sin conexión, el service worker muestra las últimas lecturas de la cartera (`cartera-cache`), que se borran al cerrar sesión. Registrar pagos requiere conexión.
- Las funciones de `api/` acceden a Supabase desde servidor. La clave `SUPABASE_SERVICE_ROLE_KEY` nunca debe pasar a `src/`.
- El servidor local usa SQLite en `server/` para la tasa BCV. No es un reemplazo de Supabase en producción.
- Cada tabla nueva con datos de cuenta debe tener `user_id` vinculado a `auth.uid()`, RLS para cada operación y pruebas de acceso entre usuarios. Registrar el SQL en `docs/CAMBIOS_SUPABASE.md`; no aplicarlo desde el cliente de código.

## Calidad

Antes de confirmar cambios: `npm test`, `npm run lint` y `npm run build`. Mantener las fórmulas puras y cubrir fechas, conversiones, redondeo y errores en pruebas. Los montos se suman y guardan siempre como enteros de centavos; el redondeo es mitad al par y se aplica una sola vez por operación. Los formularios deben asociar etiquetas, conservar foco visible y anunciar estados de carga/error. Las funciones destructivas y cualquier secreto permanecen en el servidor.