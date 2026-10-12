import type { Theme } from './types';

/**
 * Convierte theme.json en variables CSS.
 *   { "color": { "primary": "#f00" } }  →  --color-primary: #f00;
 * Los componentes solo usan estas variables: nunca colores ni fuentes fijos.
 */
export function themeToCss(theme: Theme): string {
  const vars: string[] = [];
  for (const [group, values] of Object.entries(theme)) {
    if (!values || typeof values !== 'object') continue;
    for (const [name, value] of Object.entries(values)) {
      vars.push(`--${group}-${name}:${value};`);
    }
  }
  // [data-u]: secciones que redefinen --u (p. ej. el hero, que también se adapta al alto de la pantalla)
  return `:root,[data-u]{${vars.join('')}}`;
}
