#!/usr/bin/env node
/**
 * Build para GitHub Pages (https://jorge-luis-sg.github.io/mostacho-web/):
 *   npm run build:pages   → carpeta dist-pages/
 * La web se publica en la subcarpeta /mostacho-web/, así que todos los enlaces y archivos llevan ese prefijo.
 * Para otra dirección: SITE_URL=https://dominio.com BASE_PATH=/ npm run build:pages
 */
import { execSync } from 'node:child_process';

const env = {
  ...process.env,
  SITE_URL: process.env.SITE_URL || 'https://jorge-luis-sg.github.io',
  BASE_PATH: process.env.BASE_PATH || '/mostacho-web',
};
execSync('node scripts/validate-content.mjs', { stdio: 'inherit', env });
execSync('npx astro build --outDir dist-pages', { stdio: 'inherit', env });
