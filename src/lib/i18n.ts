import languages from '../config/languages.json';

export const LANGS: string[] = languages.available;
export const DEFAULT_LANG: string = languages.default;
export const LANG_LABELS: Record<string, string> = languages.labels;
export const SWITCHER_ORDER: string[] = languages.switcherOrder ?? LANGS;

/** Raíz donde se publica la web ("/" o, p. ej., "/mostacho-web/"), siempre con barra final */
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Ruta interna de una página, sin barras: "" · "en" · "ecuador" · "en/ecuador" */
export function routePath(lang: string, route: string): string {
  return [lang === DEFAULT_LANG ? '' : lang, route].filter(Boolean).join('/');
}

/** URL de una página: "/" · "/en/" · "/ecuador/" · "/en/ecuador/" (dentro de la raíz de publicación) */
export function pathFor(lang: string, route: string): string {
  const path = routePath(lang, route);
  return path ? `${BASE}${path}/` : BASE;
}

/** Reemplaza {variables} dentro de un texto: fill('Hola {name}', { name: 'Ana' }) */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

export function langLinks(currentLang: string, route: string) {
  return SWITCHER_ORDER.map((lang) => ({
    lang,
    label: LANG_LABELS[lang] ?? lang.toUpperCase(),
    href: pathFor(lang, route),
    current: lang === currentLang,
  }));
}
