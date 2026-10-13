import type { ImageMetadata } from 'astro';
import { getConfig } from './sites';

/** Si el sitio tiene "assetsFrom" en site.json, lo que le falte se toma de ese otro sitio. */
function fallbackOf(site: string): string | undefined {
  return getConfig(site).assetsFrom;
}

/**
 * Todas las imágenes de src/sites/<sitio>/img/ se registran solas.
 * En site.json se referencian por nombre de archivo relativo a esa carpeta: "hero-fondo.jpg".
 * Las imágenes raster pasan por el optimizador de Astro (AVIF/WebP + tamaños responsive).
 */
const raster = import.meta.glob<{ default: ImageMetadata }>(
  '/src/sites/*/img/**/*.{png,jpg,jpeg,webp,avif,gif,PNG,JPG,JPEG,WEBP,AVIF,GIF}',
  { eager: true },
);
const vector = import.meta.glob<string>('/src/sites/*/img/**/*.{svg,SVG}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type ResolvedImage =
  | { kind: 'raster'; meta: ImageMetadata }
  | { kind: 'svg'; url: string };

/**
 * Foto demasiado pequeña para la caja donde se muestra (a 1920 px de pantalla): devuelve el tamaño máximo al que
 * se puede enseñar sin pixelarse (maxUp veces su tamaño real). Si da la talla, devuelve undefined.
 * Se usa para mostrarla entera sobre un fondo desenfocado de sí misma en vez de ampliarla hasta pixelarla.
 */
export function lowRes(site: string, file: string | undefined, box: [number, number], limit = 1.5, maxUp = 1.8) {
  const img = resolveImage(site, file);
  if (img?.kind !== 'raster') return undefined;
  const { width, height } = img.meta;
  const k = Math.max(box[0] / width, box[1] / height);
  return k > limit ? { width: Math.round(width * maxUp), height: Math.round(height * maxUp) } : undefined;
}

export function resolveImage(site: string, file?: string): ResolvedImage | undefined {
  if (!file) return undefined;
  const key = `/src/sites/${site}/img/${file}`;
  if (raster[key]) return { kind: 'raster', meta: raster[key].default };
  if (vector[key]) return { kind: 'svg', url: vector[key] };
  const from = fallbackOf(site);
  return from && from !== site ? resolveImage(from, file) : undefined;
}

/** Videos de src/sites/<sitio>/video/ (MP4). */
const videos = import.meta.glob<string>('/src/sites/*/video/**/*.{mp4,webm,MP4,WEBM}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function resolveVideo(site: string, file?: string): string | undefined {
  if (!file) return undefined;
  const own = videos[`/src/sites/${site}/video/${file}`];
  if (own) return own;
  const from = fallbackOf(site);
  return from && from !== site ? resolveVideo(from, file) : undefined;
}
