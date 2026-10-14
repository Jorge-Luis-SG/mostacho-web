/**
 * Bigotes y trofeo que reaccionan al cursor (Nosotros y los bigotes decorativos de las secciones).
 * Va dentro del script principal de la landing (LandingPage) y no en cada componente: así no hay un archivo
 * aparte que el navegador tenga que esperar antes de poner en marcha el resto de la página.
 */
import { bouncePath as path, mustacheHover } from './mustache';

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Trofeo: al pasar el cursor sube un poco (con una leve inclinación) y se asienta con dos rebotes;
// al quitarlo vuelve a su sitio, también con dos rebotes.
const UP = 'translateY(-5%) rotate(2.5deg)';
const lift = (from: string) =>
  path(from, UP, [
    'translateY(-6.1%) rotate(3deg)',
    'translateY(-4.3%) rotate(2.15deg)',
    'translateY(-5.45%) rotate(2.7deg)',
    'translateY(-4.85%) rotate(2.42deg)',
  ]);
const drop = (from: string) =>
  path(from, 'none', [
    'translateY(0.8%) rotate(-0.4deg)',
    'translateY(-0.45%) rotate(0.22deg)',
    'translateY(0.22%) rotate(-0.1deg)',
    'translateY(-0.07%) rotate(0.03deg)',
  ]);
if (!calm) document.querySelectorAll<HTMLElement>('.about__award').forEach((el) => {
  let anim: Animation | null = null;
  const go = (up: boolean) => {
    const from = getComputedStyle(el).transform; // desde donde esté ahora
    anim?.cancel();
    anim = el.animate(up ? lift(from) : drop(from), { duration: up ? 1100 : 1000, fill: 'forwards' });
  };
  el.addEventListener('pointerenter', () => go(true));
  el.addEventListener('pointerleave', () => go(false));
});

// Bigote de «Nosotros»: cae con dos rebotes al pasar el cursor (src/scripts/mustache.ts)
document.querySelectorAll<HTMLElement>('.about__decor').forEach((el) => {
  const zone = el.closest('figure');
  if (zone) mustacheHover(el, { zone, covered: '.about__frame, a, button, header', stayInZone: true });
});

// Bigotes decorativos con «hover»: caen con dos rebotes al pasar el cursor (src/scripts/mustache.ts)
if (matchMedia('(hover: hover) and (pointer: fine)').matches)
  document.querySelectorAll<HTMLElement>('.decor[data-mustache]').forEach((el) => {
    const zone = el.closest('section');
    if (zone) mustacheHover(el, { zone, covered: '.card, .xcard, .carousel__arrow, .carousel__dots, a, button, header, h2' });
  });
