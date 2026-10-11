# Identidad de marca PRGARCÍA

Estilo institucional bancario: sobrio, confiable y legible. Azul marino como color de autoridad, oro como acento de valor y grises fríos para el contenido.

## Paleta

| Color | Código | Uso |
| --- | --- | --- |
| Marino 900 | `#0B2140` | Fondo del emblema, portada, encabezados oscuros |
| Marino 800 | `#112F5C` | Barra de navegación |
| Marino 700 | `#163E78` | Botones principales, texto de marca |
| Marino 600 | `#1F4F93` | Enlaces y contorno de foco |
| Marino 950 | `#06142A` | Franja superior y pie |
| Oro 500 | `#C9A227` | Acentos: pestaña activa, franja dorada, emblema, botón dorado |
| Oro 300 | `#E9CF7A` | Oro sobre fondos marino |
| Oro 700 | `#7F6413` | Oro como texto sobre blanco (lema del logo) |
| Fondo claro | `#F3F5F8` | Fondo de la aplicación |
| Fondo oscuro | `#071426` | Fondo en tema oscuro; tarjetas `#0D1E36` |
| Verde estado | `#1F7A5C` | Solo para estados positivos (pagado) |

El oro nunca se usa como texto pequeño sobre blanco salvo en su tono 700. Las combinaciones están verificadas en `tests/accessibilityContrast.test.js` (WCAG AA).

## Tipografía

IBM Plex Sans (400–700) para toda la interfaz; IBM Plex Mono con cifras tabulares para montos. El nombre se escribe en mayúsculas con espaciado amplio (`tracking 0.12em`) y el lema «Préstamos y cartera» en versalitas doradas.

## Formas

Radios contenidos (6–10 px), bordes finos, sombras discretas. La navegación usa una barra marino con subrayado dorado en la pestaña activa y una franja dorada bajo el encabezado.

## Emblema

Frontón y columnas (edificio institucional) en oro y blanco sobre un cuadrado marino con filete dorado. Representa solidez y custodia del dinero.

## Archivos del kit (`public/`)

- `logo-mark.svg` / `favicon.svg`: emblema principal; `logo-mark-navy.svg`: variante para fondos muy oscuros.
- `logo-horizontal.svg` y `logo-horizontal-white.svg`: emblema + nombre para fondos claros y oscuros.
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`.
- `icon-192.png`, `icon-512.png` (PWA) e `icon-maskable-512.png` (adaptable, fuente `icon-maskable.svg`).
- `og-image.png`: vista previa al compartir (1200 × 630).

En la aplicación el logo se compone con `src/components/BrandLogo.jsx` (emblema + texto real) para que sea nítido y accesible.

## Uso

- Deja alrededor del emblema un espacio libre igual a la altura del frontón.
- No estires, recolorees ni agregues sombras al emblema.
- Sobre fondos marino usa el logo en versión blanca (`inverse`).
