import languages from '../config/languages.json';

export const LANGS: string[] = languages.available;
export const DEFAULT_LANG: string = languages.default;
export const LANG_LABELS: Record<string, string> = languages.labels;
export const SWITCHER_ORDER: string[] = languages.switcherOrder ?? LANGS;

/** "/" · "/en/" · "/ecuador/" · "/en/ecuador/" */
export function pathFor(lang: string, route: string): string {
  const segments = [lang === DEFAULT_LANG ? '' : lang, route].filter(Boolean);
  return segments.length ? `/${segments.join('/')}/` : '/';
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
