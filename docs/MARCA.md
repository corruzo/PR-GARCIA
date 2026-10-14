# Identidad de marca PRGARCÍA

Interfaz **blanca, limpia y espaciosa** (inspirada en el estilo de Airbnb): el contenido manda y el color de marca aparece solo en lo importante —botones principales, pestaña activa, íconos, enlaces y logo—. El modo oscuro usa **gris muy oscuro** (no negro ni azul) con el mismo acento.

## Color de marca: vinotinto

Definido como variables RGB en `src/index.css` (`:root`, `--brand-50` … `--brand-950`); Tailwind lo expone como `brand-*`. **Para cambiar el color de toda la app basta con editar esas variables.**

| Token | Código | Uso |
| --- | --- | --- |
| `brand-700` | `#9F1239` | Botón principal, logo, pestaña activa, íconos |
| `brand-800` | `#84102F` | Botón al pasar el cursor |
| `brand-50` | `#FFF1F3` | Fondos suaves de etiquetas y resaltes |
| `brand-400` | `#FB7185` | Acento en modo oscuro (texto, íconos, pestaña activa) |

## Neutros

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#FFFFFF` | `#1C1C1E` |
| Tarjetas | `#FFFFFF` + borde `#EBEBEB` | `#262628` + borde `#3A3A3C` |
| Fondo atenuado (pie, zonas) | `#F7F7F7` | `#262628` |
| Texto principal | `#222222` | `#F5F5F7` |
| Texto secundario | `#505055` | `#C7C7CC` |

Los grises no tienen tinte azul. Verde (`emerald`) solo para estados positivos (pagado, al día); rojo y ámbar solo para alertas.
Todas las combinaciones cumplen WCAG AA y están verificadas en `tests/accessibilityContrast.test.js`.

## Tipografía y formas

- **Figtree** (400–800) para todo; los montos usan cifras tabulares (`.num`).
- Títulos en minúscula y negrita, sin mayúsculas sostenidas.
- Radios amplios (tarjetas 16 px, botones 8 px, chips redondos), sombras suaves solo al pasar el cursor o en tarjetas destacadas.
- Foco visible en `#222222` (claro) / `#F5F5F7` (oscuro).

## Legibilidad (personas mayores o sin lentes)

- Texto secundario con contraste AAA (≥ 7:1); nada de grises claros para información.
- En listas y cobranza: nombres a 18–20 px, montos a 30 px, resto a 16 px como mínimo.
- Botones y áreas táctiles de 48 px o más; bordes de 2 px para separar tarjetas.
- Estados con color sólido y texto («En mora · 7 días», «Al día»), nunca solo con color.
- Diseño de una columna en teléfonos (probado desde 360 px) y dos columnas en pantallas grandes.

## Navegación

- Escritorio: barra blanca con logo, módulos como íconos con etiqueta y subrayado vinotinto en el activo, chip con la tasa BCV y menú de usuario.
- Teléfono: barra inferior fija con los 5 módulos principales (como una app nativa) y menú lateral para el resto.

## Símbolo

Una «P» blanca cuyo bucle es una moneda, sobre un cuadrado vinotinto redondeado: la P de PRGARCÍA y de préstamo.

## Archivos del kit (`public/`)

- `logo-mark.svg` / `favicon.svg`: símbolo principal; `logo-mark-navy.svg`: variante sobre gris oscuro.
- `logo-horizontal.svg` y `logo-horizontal-white.svg`: símbolo + nombre para fondos claros y oscuros.
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`.
- `icon-192.png`, `icon-512.png` (PWA) e `icon-maskable-512.png` (adaptable, fuente `icon-maskable.svg`).
- `og-image.png`: vista previa al compartir (1200 × 630).

En la aplicación el logo se compone con `src/components/BrandLogo.jsx` (símbolo + texto real).

## Uso

- Deja alrededor del símbolo un espacio libre igual a la mitad de su ancho.
- No estires, recolorees ni agregues sombras al símbolo.
- No uses el vinotinto para bloques grandes de fondo: es un acento.
