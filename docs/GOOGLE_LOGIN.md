# Iniciar sesión con Google

Funciona con el **plan gratuito** de Supabase y no tiene costo en Google. El código de la app ya está listo:
solo falta activar el proveedor. Mientras Google no esté activo, el botón muestra «El inicio de sesión con
Google no está disponible por ahora» en lugar de llevar a una página de error. Apple (iCloud) muestra
«Próximamente».

## 1. Google Cloud (credenciales OAuth)

1. Entra a <https://console.cloud.google.com/> y crea un proyecto (por ejemplo «PRGARCIA»).
2. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform → Branding):
   tipo **Externo**, nombre de la app, tu correo de soporte y de contacto. En **Público** pulsa
   **Publicar app** (en modo «Prueba» solo entran los correos que agregues como usuarios de prueba).
   Los permisos `email`, `profile` y `openid` no requieren verificación de Google.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: el dominio de la app (por ejemplo `https://tu-app.vercel.app`).
   - **URI de redireccionamiento autorizados**: `https://<ref-del-proyecto>.supabase.co/auth/v1/callback`
     (aparece copiado en Supabase, en el paso 2).
4. Copia el **ID de cliente** y el **Secreto del cliente**.

## 2. Supabase

1. **Authentication → Sign In / Providers → Google**: activa **Enable Sign in with Google**, pega el
   ID de cliente y el secreto, y guarda. Ahí mismo está la *Callback URL* para el paso 1.3.
2. **Authentication → URL Configuration**: **Site URL** = dominio de producción; en **Redirect URLs**
   agrega `https://tu-app.vercel.app/**` (y `http://localhost:5173/**` para desarrollo). Si el dominio
   no está en la lista, Supabase devuelve a la *Site URL* en lugar de a la app.

## 3. Comprobar

Abre la app → **Ingresar → Google**. Debe aparecer la pantalla de Google y volver a la app con la
sesión iniciada.

## Notas

- **Cuenta existente**: si ya tienes cuenta con correo y contraseña y entras con Google usando el mismo
  correo, Supabase une ambas formas de entrada en la misma cuenta (mismos datos).
- **Registro cerrado**: si desactivas *Allow new users to sign up*, Google solo funciona para cuentas que
  ya existen (nadie nuevo puede crear cuenta con Google). Es lo recomendado si la app es solo para ti:
  crea primero tu cuenta y luego cierra el registro.
- **Problemas comunes**:
  - `redirect_uri_mismatch` (pantalla de Google): la URI del paso 1.3 no coincide exactamente con la *Callback URL* de Supabase.
  - Vuelve a la página principal sin sesión, o a otro dominio: falta el dominio en **Redirect URLs**.
  - «Acceso bloqueado: la app no completó el proceso de verificación»: la app de Google sigue en modo «Prueba»; publícala o agrega tu correo como usuario de prueba.
