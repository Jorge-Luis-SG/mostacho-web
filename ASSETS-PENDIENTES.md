# Assets

## Cómo se importan

Los originales están en `capturas/assets/` (fotos, videos y tipografía). Para pasarlos a la web:

```bash
npm run assets
```

El script [scripts/import-assets.mjs](scripts/import-assets.mjs):

- **Fotos:** convierte HEIC/HEIF a JPG, reduce las enormes a un máximo de 2560 px (sin recortar) y las guarda con su nombre web en `src/sites/ecuador/img/`.
- **Videos:** los pasa a MP4 H.264 sin audio, listo para la web, en `src/sites/ecuador/video/`. Además saca un fotograma como imagen de carga.
- **Tipografía:** convierte Neue Montreal (.otf) a .woff2 en `public/fonts/`.

**Para cambiar una foto:** edita la tabla del script (`destino ← origen`) y vuelve a ejecutarlo. Solo procesa lo que cambió; con `npm run assets -- --force` reprocesa todo.
En el build, Astro las optimiza otra vez a AVIF/WebP en varios tamaños.

Mientras falte un archivo, la web muestra un **fondo borroso con el aviso "Faltan assets"** y el nombre del archivo. Para ver la lista en cualquier momento:

```bash
npm run validate
```

## Lo que falta

### Landing Ecuador → `src/sites/ecuador/img/`

| Archivo | Tamaño (2x) | Por qué falta |
|---|---|---|
| `recibe-rosas-blancas.jpg` | 3684 × 1706 | Ya se usa `ROSAS GLAM BLANCAS.png`, pero mide solo 158 × 284 px y se ve borrosa: hace falta una versión grande. |

### España → `src/sites/espana/`

Usa los mismos nombres que Ecuador. Por ahora solo tiene `logo.png`; el resto muestra "Faltan assets".

## Elecciones que hice (cámbialas en el script si prefieres otra foto)

- Cuando había varias fotos del mismo show, elegí la horizontal o la que mejor se ve en formato ancho, porque las diapositivas son panorámicas.
- **Alicia:** usé `ALICIA EN EL PAÍS DE LAS MARAVILLAS.jpg`. Las versiones "USAR SIN FONDO" necesitan el fondo quitado; si me las pasas en PNG transparente, las uso.
- **Robots LED** en la diapositiva: usé la foto cuadrada `SaveClip…webp` (1440 px). Las otras dos (720 × 1280) son verticales y se verían borrosas a lo ancho.
- **Testimonios:** las reseñas de Google e Instagram están escritas en HTML (no como imagen), con las estrellas y el avatar con iniciales. Así se leen bien en móvil y los buscadores las indexan. El chat de WhatsApp sí es imagen.
- **Videos usados:** hero (`VIDEO HERO/IMG_0600.MOV`), tarjeta Hora loca (`SERVICIOS/HORA LOCA.mp4`), Cabina espejada y Música en vivo. En móvil, el video del hero no se carga (se ve la foto) para ahorrar datos.
- **No usados:** los videos 4K de 100–760 MB (`EFECTOS ESPECIALES 3.MOV`, `NEBLINA Y PIROTECNIA (2)`…) y el resto de fotos duplicadas.

## Ya colocados ✔

Logo, fondo y video del hero, trofeo, foto del equipo, 5 bigotes 3D, 5 tarjetas de Servicios, 20 diapositivas de Hora loca, 12 de Recibe a tus invitados (Rosas glam rojas usa `COMBINADOS(2).heif`; Rosas glam blancas, la foto pequeña), 5 efectos especiales, 12 servicios adicionales, 2 diapositivas infantiles, 27 fotos de galería, 6 testimonios y la tipografía Neue Montreal.
