# Dominio prgarcia.lat

La app se publica en **https://prgarcia.lat** (sin `www`). En el código ya está todo apuntando ahí:
`canonical`, Open Graph (vista previa en WhatsApp, Facebook, X), datos estructurados para Google,
`sitemap.xml`, `robots.txt` y el manifiesto de la PWA. Además:

- `www.prgarcia.lat` redirige de forma permanente (301/308) a `prgarcia.lat`, para que Google vea un solo sitio.
- Las copias en `*.vercel.app` (producción y vistas previas) responden `X-Robots-Tag: noindex`, para que
  no compitan con el dominio en los buscadores.
- La sesión abierta marca la app como `noindex` (los datos de la cartera nunca se indexan).

Lo siguiente se hace en los paneles (no desde el código):

## 1. Vercel

**Project → Settings → Domains**: agrega `prgarcia.lat` y `www.prgarcia.lat`. Deja `prgarcia.lat` como
principal; si Vercel ofrece redirigir `www` al dominio principal, acéptalo. Copia los registros DNS que
indica (A `76.76.21.21` para `prgarcia.lat` y CNAME `cname.vercel-dns.com` para `www`, o los que muestre)
en el proveedor donde compraste el dominio. El certificado HTTPS se crea solo.

## 2. Supabase

**Authentication → URL Configuration**:
- **Site URL**: `https://prgarcia.lat`
- **Redirect URLs**: `https://prgarcia.lat/**` y `https://www.prgarcia.lat/**`

Si los correos de la app usan `{{ .SiteURL }}` en las plantillas, ahora mostrarán el dominio nuevo.

## 3. Google Cloud (inicio con Google)

En el cliente OAuth → **Orígenes autorizados de JavaScript**: `https://prgarcia.lat` y
`https://www.prgarcia.lat`. El **URI de redireccionamiento** sigue siendo el de Supabase:
`https://muxxvbcxzqszstiotbwu.supabase.co/auth/v1/callback`. En la pantalla de consentimiento
(Branding) agrega `prgarcia.lat` en **Dominios autorizados** y los enlaces
`https://prgarcia.lat/privacidad` y `https://prgarcia.lat/terminos`.

## 4. Que Google y Bing la encuentren

1. **Google Search Console** (<https://search.google.com/search-console>): **Agregar propiedad → Dominio**
   → `prgarcia.lat`. Google da un registro **TXT**: agrégalo en el DNS del dominio y pulsa *Verificar*.
2. En Search Console → **Sitemaps**: envía `https://prgarcia.lat/sitemap.xml`.
3. **Inspección de URLs** → `https://prgarcia.lat/` → **Solicitar indexación**. Aparecer en las búsquedas
   suele tardar de unos días a dos semanas.
4. **Bing Webmaster Tools** (<https://www.bing.com/webmasters>): **Importar desde Google Search Console**.
   Bing también alimenta a DuckDuckGo y Yahoo.
5. **Google Business Profile** (opcional): si atiendes en una ciudad, crear el perfil ayuda a aparecer en
   Maps y en búsquedas locales.

## 5. Comprobar

- Vista previa al compartir: pega `https://prgarcia.lat` en WhatsApp, o revisa en
  <https://developers.facebook.com/tools/debug/> y pulsa *Volver a extraer* si muestra una imagen vieja.
- Datos estructurados: <https://search.google.com/test/rich-results> con `https://prgarcia.lat/`.
- Redirección: `https://www.prgarcia.lat/terminos` debe terminar en `https://prgarcia.lat/terminos`.
