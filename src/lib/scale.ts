/**
 * Convierte una medida en px del diseño (a 1920 de ancho) en un valor CSS escalable con --u
 * (ver src/styles/global.css), con un mínimo legible en pantallas pequeñas.
 */
export function fluid(px: number, minRatio = 0.5): string {
  const rem = px / 10;
  return `clamp(${(rem * minRatio).toFixed(2)}rem, calc(${(px / 19.2).toFixed(3)} * var(--u)), ${rem.toFixed(2)}rem)`;
}
