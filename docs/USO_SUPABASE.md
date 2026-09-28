# Uso de Supabase

Este inventario refleja las llamadas presentes en `src/` y `api/`. `server/` no usa Supabase: en desarrollo guarda la tasa en SQLite. Las operaciones no indican por sí solas las políticas RLS necesarias; configúralas en Supabase según el usuario autenticado.

## Datos

| Archivo | Tabla | Operación | Columnas o datos usados | Filtros y orden |
| --- | --- | --- | --- | --- |
| `src/App.jsx` | `user_history` | `select` | `id`, `created_at`, `prestamo_data` | `user_id = user.id`; `created_at` descendente |
| `src/App.jsx` | `user_history` | `insert` | Escribe `user_id`, `prestamo_data`; devuelve `id`, `created_at`, `prestamo_data` | Ninguno |
| `src/App.jsx` | `user_history` | `delete` | Sin columnas de retorno | `id = id` y `user_id = user.id` |
| `src/App.jsx` | `user_history` | `delete` | Sin columnas de retorno | `user_id = user.id` |
| `api/bcv.js` | `tasa_bcv` | `select` | `tasa`, `fuente`, `fecha_hora` | `fecha_hora` descendente; primera fila |
| `api/bcv.js` | `tasa_bcv` | `insert` | Escribe `tasa`, `fuente`, `estado`; devuelve `tasa`, `fuente`, `fecha_hora` | Ninguno; `fecha_hora` usa el valor predeterminado de la tabla |
| `api/bcv/latest.js` | `tasa_bcv` | `select` | `tasa`, `fuente`, `fecha_hora` | `fecha_hora` descendente; primera fila |

`prestamo_data` guarda el borrador y el resultado de la cotización como JSON. El código lee `values` y `resultado` dentro de ese dato.

## Autenticación

| Archivo | Operación | Datos enviados o leídos | Filtros |
| --- | --- | --- | --- |
| `src/context/AuthContext.jsx` | `auth.getSession` | Sesión actual | Ninguno |
| `src/context/AuthContext.jsx` | `auth.onAuthStateChange` | Evento y sesión actual | Ninguno |
| `src/context/AuthContext.jsx` | `auth.signInWithPassword` | Correo y contraseña | Ninguno |
| `src/context/AuthContext.jsx` | `auth.signUp` | Correo, contraseña y metadato `full_name` | Ninguno |
| `src/context/AuthContext.jsx` | `auth.signInWithOtp` | Correo; `shouldCreateUser: false` | Ninguno |
| `src/context/AuthContext.jsx` | `auth.verifyOtp` | Correo y token; intenta tipos `email` y `recovery` | Ninguno |
| `src/context/AuthContext.jsx` | `auth.updateUser` | Contraseña nueva | Usuario de la sesión actual |
| `src/context/AuthContext.jsx` | `auth.updateUser` | Metadato `full_name` | Usuario de la sesión actual |
| `src/context/AuthContext.jsx` | `auth.signInWithOAuth` | Proveedor Google o Apple y URL de retorno permitida | Ninguno |
| `src/context/AuthContext.jsx` | `auth.signOut` | Sesión actual | Ninguno |

`src/utils/supabase/client.js` crea el cliente del navegador con `VITE_SUPABASE_URL` y la clave publicable. `api/_lib/db.js` crea el cliente del servidor con `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_ANON_KEY` como alternativa); no ejecuta consultas por sí mismo. La clave de servicio no debe aparecer en `src/`.

## Notas para RLS

- Las consultas de `user_history` filtran por `user_id`; las políticas deben validar además que ese valor corresponda a `auth.uid()` en lectura, inserción y eliminación.
- Las funciones de `tasa_bcv` necesitan leer la fila más reciente e insertar tasas. La clave de servicio, si está configurada, omite RLS; si se usa la clave anon como alternativa, las políticas deben permitir esas operaciones públicas previstas.
- No se detectaron llamadas Supabase en `server/`; sus lecturas y escrituras de `tasa_bcv` son contra SQLite local y no definen políticas remotas.