import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { getConfig } from './sites';

// Se calcula al generar el HTML, una sola vez por archivo. No modifica los PNG.
interface PopAlignment { right: number; top: number; bottom: number; ratio: number }
const empty: PopAlignment = { right: 0, top: 0, bottom: 0, ratio: 1 };
const insets = new Map<string, { version: string; value: Promise<PopAlignment> }>();

/** Márgenes transparentes: derecha en porcentaje de ancho, abajo como fracción del alto. */
export function popAlignment(site: string, file: string): Promise<PopAlignment> {
  if (!/\.png$/i.test(file)) return Promise.resolve(empty);
  const visited = new Set<string>();
  let owner: string | undefined = site;
  while (owner && !visited.has(owner)) {
    visited.add(owner);
    const path = resolve('src/sites', owner, 'img', file);
    if (existsSync(path)) {
      // El servidor local sigue abierto al reemplazar assets: no conservar medidas del PNG anterior.
      const { mtimeMs, size } = statSync(path);
      const version = `${mtimeMs}:${size}`;
      let inset = insets.get(path);
      if (!inset || inset.version !== version) {
        inset = { version, value: measure(path) };
        insets.set(path, inset);
      }
      return inset.value;
    }
    owner = getConfig(owner).assetsFrom;
  }
  return Promise.resolve(empty);
}

async function measure(path: string): Promise<PopAlignment> {
  const { data, info } = await sharp(path).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const opaque = (x: number, y: number) => data[(y * info.width + x) * info.channels + info.channels - 1] > 8;
  let right = 0, top = 0, bottom = 0;
  // Ignorar píxeles casi invisibles del suavizado del borde (alfa <= 8/255).
  rightEdge: for (let x = info.width - 1; x >= 0; x--) {
    for (let y = 0; y < info.height; y++) {
      if (opaque(x, y)) {
        right = Number(((info.width - x - 1) / info.width * 100).toFixed(4));
        break rightEdge;
      }
    }
  }
  topEdge: for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (opaque(x, y)) {
        top = Number((y / info.height).toFixed(8));
        break topEdge;
      }
    }
  }
  bottomEdge: for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      if (opaque(x, y)) {
        bottom = Number(((info.height - y - 1) / info.height).toFixed(8));
        break bottomEdge;
      }
    }
  }
  return { right, top, bottom, ratio: Number((info.width / info.height).toFixed(8)) };
}
