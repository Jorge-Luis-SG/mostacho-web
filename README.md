# Mostacho Producciones · Web

Sitio estático hecho con **[Astro](https://astro.build)**. Todo lo que cambia entre países
(textos, colores, fuentes, imágenes, contacto) está en archivos JSON, así que **para editar
el sitio no hace falta tocar los componentes**.

| Página | Español | Inglés |
|---|---|---|
| Portada (elegir país) | `/` | `/en/` |
| Landing Ecuador | `/ecuador/` | `/en/ecuador/` |
| Landing España | `/espana/` | `/en/espana/` |

---

> Los originales (fotos y videos sin optimizar, capturas del diseño) viven en `capturas/`, que **no** se sube al
> repositorio por su peso. Las versiones optimizadas que usa la web están en `src/sites/*/img` y `src/sites/*/video`.

## Comandos

```bash
npm install          # solo la primera vez
npm run dev          # servidor local → http://localhost:4321
npm run assets       # importa fotos, videos y fuentes desde capturas/assets/ (ver ASSETS-PENDIENTES.md)
npm run validate     # revisa textos, idiomas, temas e imágenes que faltan
npm run build        # valida y genera el sitio final en dist/
npm run preview      # sirve dist/ para comprobar el build
npm run build:pages  # build para GitHub Pages (subcarpeta /mostacho-web/) en dist-pages/
```

> **OneDrive:** el servidor de desarrollo vigila los archivos en modo *polling* (`astro.config.mjs`); si alguna vez no ves
> un cambio, reinicia `npm run dev`. OneDrive también sincroniza `node_modules/` y `dist/` (cientos de MB) y a veces
> bloquea `dist/` durante el build. Si pasa, espera unos segundos y repite, o excluye esas carpetas de la sincronización.

`dist/` es HTML/CSS estático: se sube tal cual a cualquier hosting (Netlify, Vercel,
Cloudflare Pages, cPanel…). Antes de publicar, pon el dominio real en `astro.config.mjs` → `site`.

---

## Estructura

```
src/
├─ sites/                       ← TODO el contenido. Una carpeta = un sitio
│  ├─ portal/                   ← página 1: portada con las banderas
│  ├─ ecuador/                  ← página 2: landing de Ecuador
│  │  ├─ site.json              ← estructura: secciones, orden, imágenes, WhatsApp, redes
│  │  ├─ theme.json             ← aspecto: colores, fuentes, tamaños, degradados
│  │  ├─ i18n/es.json           ← TODOS los textos en español
│  │  ├─ i18n/en.json           ← TODOS los textos en inglés
│  │  ├─ img/                   ← imágenes de este sitio
│  │  └─ video/                 ← videos de fondo (hero y tarjetas)
│  └─ espana/                   ← misma estructura, otro aspecto
├─ components/
│  ├─ ui/                       ← piezas pequeñas: Button, Img, Icon, Carousel, SocialLinks…
│  ├─ layout/                   ← Header, Footer, SectionShell
│  ├─ sections/                 ← Hero, About, CardCarousel, Showcase, Gallery, Testimonials, Contact
│  ├─ pages/                    ← LandingPage (página 2) y PortalPage (página 1)
│  └─ SectionRenderer.astro     ← traduce el "type" de cada sección a su componente
├─ config/languages.json        ← idiomas disponibles y el idioma por defecto
├─ lib/                         ← carga de sitios, imágenes, idiomas y tema
├─ layouts/BaseLayout.astro     ← <head>, SEO y variables CSS del tema
├─ pages/[...path].astro        ← genera todas las rutas automáticamente
└─ styles/global.css            ← reset y estilos base (solo usan variables del tema)
scripts/validate-content.mjs    ← validador que se ejecuta antes de cada build
scripts/import-assets.mjs       ← importa los originales de capturas/assets/
public/fonts/                   ← Neue Montreal (.woff2)
```

### Las 3 reglas del proyecto

1. **Ningún texto visible en los componentes.** Todo va en `i18n/<idioma>.json`, incluidos botones,
   menú, `alt` de imágenes, etiquetas accesibles, SEO y mensajes de WhatsApp.
2. **Ningún color o fuente fijo en los componentes.** Solo `var(--color-…)`, `var(--font-…)`, etc.,
   que salen de `theme.json`.
3. **Las landings no se duplican copiando código.** Cada país es una carpeta en `src/sites/`.

---

## Tareas frecuentes

### Cambiar un texto
Abre `src/sites/<sitio>/i18n/es.json` (y `en.json`) y edítalo. Los saltos de línea de los
títulos se escriben con `\n`, por ejemplo `"Hagamos\ntu evento\nlegendario"`.
Las mayúsculas las pone el tema (`heading.transform`), así que escribe los textos normalmente.

### Cambiar el tamaño general de la web
En `src/styles/global.css` → `--scale` (ahora `0.85`). Todas las medidas salen del diseño a 1920 px multiplicadas por ese número,
así que con un solo valor la web entera se hace más grande o más pequeña manteniendo las proporciones.
El inicio (hero) además se ajusta al alto de la pantalla para que en portátiles quepa completo.

### Cambiar colores, fuentes o tamaños
Edita `src/sites/<sitio>/theme.json`. Cada valor se convierte en una variable CSS:
`"color": { "primary": "#F5333F" }` → `var(--color-primary)`.
La tipografía de la marca es **Neue Montreal** (`src/styles/fonts.css`). Para usar otra fuente de Google Fonts en una variante,
añade `fontsUrl` y cambia `font.heading` / `font.body` (así está hecha la demo de España).

### Poner las imágenes
Copia los archivos en `src/sites/<sitio>/img/` **con el nombre exacto** que aparece en `site.json`.
Mientras falte una imagen, la web muestra un **fondo borroso con el aviso "Faltan assets"** y el nombre del archivo,
y `npm run validate` lista todas las que faltan. La lista completa, con los tamaños de exportación, está en
**[ASSETS-PENDIENTES.md](ASSETS-PENDIENTES.md)**. Astro las optimiza solas (AVIF/WebP y varios tamaños).

Exporta **solo la imagen**: los textos, botones, degradados y puntos de los carruseles ya están hechos en HTML/CSS.

### Videos de fondo
En `site.json`, el hero y cualquier tarjeta aceptan `"video": "archivo.mp4"` (en `src/sites/<sitio>/video/`).
La imagen sigue haciendo de póster: se ve mientras carga, en móvil (hero) y si el visitante prefiere menos movimiento.

### Decorados (bigotes 3D)
Se definen en `site.json`, en la sección correspondiente, con la posición y el ancho **en píxeles del diseño a 1920 px**,
relativos a la esquina superior izquierda de la sección. Se escalan solos con el ancho de la pantalla:
```json
"decor": [{ "image": "bigote-1.png", "x": 888, "y": -23, "w": 1229 }]
```

### Espaciado y medidas
Las secciones admiten `"space": { "top": 342, "bottom": 114, "inner": 97 }`, también en px del diseño a 1920.
Las tarjetas admiten `"titleSize": 52` para el tamaño del título. Todo se escala proporcionalmente en pantallas más pequeñas.

### Añadir una tarjeta, diapositiva o foto de galería
1. En `site.json`, dentro de la sección, añade un elemento con un `id` nuevo y su imagen:
   `{ "id": "confeti", "image": "efecto-confeti.jpg" }`
2. En **cada** `i18n/*.json`, añade los textos con el mismo `id`, en
   `sections.<sección>.items.confeti` (o `slides.<id>` en las secciones de diapositivas).
3. `npm run validate` te avisa si te olvidaste de algún idioma.

En las diapositivas puedes cambiar el color del degradado con `"accent": "#4600BB"`.

### Añadir, quitar o reordenar secciones
El orden de `sections` en `site.json` es el orden en la página. Tipos disponibles:
`hero`, `about`, `cards`, `showcase`, `gallery`, `testimonials`, `contact`.
El menú superior se define en `nav` (lista de ids de sección).

### Crear otra variante (otro país o marca)
1. Copia `src/sites/ecuador/` como `src/sites/<nuevo>/` (sin la carpeta `img/` si quieres reutilizar las fotos:
   con `"assetsFrom": "ecuador"` en `site.json`, toda imagen o video que falte se toma de Ecuador; así está España).
2. Cambia `route` en `site.json` (será la URL `/<nuevo>/`), el WhatsApp y las redes.
3. Cambia el aspecto en `theme.json` y los textos en `i18n/`.
4. Para que salga en la portada, añádelo a `countries` en `src/sites/portal/site.json`,
   con su bandera, y el nombre del país en `src/sites/portal/i18n/*.json` → `countries`.

### Añadir un idioma
1. Añádelo a `src/config/languages.json` (`available` y `labels`).
2. Crea `i18n/<idioma>.json` en cada sitio, copiando uno existente y traduciéndolo.

### Animaciones con el scroll
Cada sección elige su animación en `site.json` → `"anim"` (lista y explicación en `src/lib/anim.ts`):
`mask` (inicio), `guide` (bigote de Nosotros), `slide`, `ring`, `doors`, `deal`, `spotlight`, `pop`, `tunnel` y `sides`.
Sin `"anim"`, la sección se ve normal. Las cartas de Efectos lanzan un efecto a pantalla completa según `items[].fx`
(`smoke`, `fog`, `fireworks`, `confetti`, `fog-sparks`).

Solo se activan en ordenadores (≥ 900 px, con ratón o trackpad) y si el usuario no pidió reducir el movimiento:
en móviles y tablets la página se ve exactamente como el diseño. El código está en `src/scripts/animations.ts`
y los estilos en `src/styles/animations.css`.

### Publicar en GitHub Pages
`npm run build:pages` genera `dist-pages/` con todas las rutas bajo `/mostacho-web/`. Su contenido se sube a la rama
`gh-pages` y en GitHub → Settings → Pages se elige *Deploy from a branch* → `gh-pages` / `(root)`.
Para un dominio propio: `SITE_URL=https://midominio.com BASE_PATH=/ npm run build:pages`.

### Formulario de contacto
Al enviar, abre WhatsApp con los datos ya escritos (no necesita servidor). El número está en
`site.json` → `contact.whatsapp`, con código de país y sin `+` ni espacios: `593991234567`.

---

## Pendiente antes de publicar

- [ ] Imágenes de cada sitio (ver [ASSETS-PENDIENTES.md](ASSETS-PENDIENTES.md) y `npm run validate`).
- [ ] Número de WhatsApp real en `ecuador/site.json` y `espana/site.json`.
- [ ] Enlaces reales de YouTube, Facebook e Instagram en los tres `site.json`.
- [ ] Textos de **España**: ahora son una copia de los de Ecuador (por ejemplo, "La hora loca #1 de Quito").
- [ ] Revisar el final del texto de "Nosotros": en el diseño estaba cortado ("…un momento que merece ser")
      y se completó con "recordado".
- [ ] Tarjetas extra de Servicios, Efectos y Adicionales: el diseño muestra puntos de 2–4 páginas, pero solo hay 3 tarjetas de cada una.
- [ ] Dominio real en `astro.config.mjs`.
