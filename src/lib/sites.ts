import type { SiteConfig, Texts, Theme } from './types';

/**
 * Carga automática de todos los sitios que existan en src/sites/<sitio>/.
 * Para crear un sitio nuevo basta con copiar una carpeta: no hay que tocar código.
 */
const configs = import.meta.glob<SiteConfig>('/src/sites/*/site.json', { eager: true, import: 'default' });
const themes = import.meta.glob<Theme>('/src/sites/*/theme.json', { eager: true, import: 'default' });
const texts = import.meta.glob<Texts>('/src/sites/*/i18n/*.json', { eager: true, import: 'default' });

const keyOf = (path: string) => path.split('/')[3];

export const siteKeys: string[] = Object.keys(configs).map(keyOf);

export function getConfig(key: string): SiteConfig {
  const config = configs[`/src/sites/${key}/site.json`];
  if (!config) throw new Error(`No existe src/sites/${key}/site.json`);
  return config;
}

/** Ruta del sitio sin barras: "" para la portada, "ecuador" para /ecuador/ */
export function routeOf(key: string): string {
  const config = getConfig(key);
  return (config.route ?? key).replace(/^\/+|\/+$/g, '');
}

export function getSite(key: string, lang: string) {
  const config = getConfig(key);
  const theme = themes[`/src/sites/${key}/theme.json`];
  const t = texts[`/src/sites/${key}/i18n/${lang}.json`];
  if (!theme) throw new Error(`No existe src/sites/${key}/theme.json`);
  if (!t) throw new Error(`No existe src/sites/${key}/i18n/${lang}.json`);
  return { key, config, theme, t };
}

export type LoadedSite = ReturnType<typeof getSite>;
