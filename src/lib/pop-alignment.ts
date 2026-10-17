import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { getConfig } from './sites';

// Se calcula al generar el HTML, una sola vez por archivo. No modifica los PNG.
const rightInsets = new Map<string, Promise<number>>();

/** Porcentaje de ancho transparente a la derecha del personaje visible. */
export function popRightInset(site: string, file: string): Promise<number> {
  if (!/\.png$/i.test(file)) return Promise.resolve(0);
  const visited = new Set<string>();
  let owner: string | undefined = site;
  while (owner && !visited.has(owner)) {
    visited.add(owner);
    const path = resolve('src/sites', owner, 'img', file);
    if (existsSync(path)) {
      let inset = rightInsets.get(path);
      if (!inset) {
        inset = measure(path);
        rightInsets.set(path, inset);
      }
      return inset;
    }
    owner = getConfig(owner).assetsFrom;
  }
  return Promise.resolve(0);
}

async function measure(path: string): Promise<number> {
  const { data, info } = await sharp(path).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Ignorar píxeles casi invisibles del suavizado del borde (alfa <= 8/255).
  for (let x = info.width - 1; x >= 0; x--) {
    for (let y = 0; y < info.height; y++) {
      if (data[(y * info.width + x) * info.channels + info.channels - 1] > 8) {
        return Number(((info.width - x - 1) / info.width * 100).toFixed(4));
      }
    }
  }
  return 0;
}
