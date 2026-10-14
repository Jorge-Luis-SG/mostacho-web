/**
 * Bigote que reacciona al cursor: dos posiciones. Al pasar el cursor sobre su parte visible cae a la segunda
 * (más abajo, inclinado hacia la izquierda y algo más grande) con dos rebotes suaves; al quitarlo vuelve a su
 * sitio, también con dos rebotes. Lo usan «Nosotros» y los bigotes decorativos de las secciones (decor[].hover),
 * desde src/scripts/hover-init.ts.
 */

// Recorrido con dos rebotes suaves: pasa un poco de largo, vuelve un poco, pasa de largo menos y se asienta
const path = (from: string, to: string, over: string[]) => [
  { transform: from, easing: 'cubic-bezier(0.45, 0, 0.7, 0.4)' },
  { transform: over[0], offset: 0.42, easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)' },
  { transform: over[1], offset: 0.62, easing: 'cubic-bezier(0.5, 0, 0.7, 0.5)' },
  { transform: over[2], offset: 0.8, easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)' },
  { transform: over[3], offset: 0.91, easing: 'ease-in-out' },
  { transform: to },
];
export { path as bouncePath };

const DOWN = 'translate(-3%, 7%) rotate(-12deg) scale(1.1)';
const fall = (from: string) =>
  path(from, DOWN, [
    'translate(-3%, 8.6%) rotate(-13.3deg) scale(1.106)',
    'translate(-3%, 5.9%) rotate(-11.2deg) scale(1.097)',
    'translate(-3%, 7.6%) rotate(-12.45deg) scale(1.1)',
    'translate(-3%, 6.75%) rotate(-11.8deg) scale(1.1)',
  ]);
const rise = (from: string) =>
  path(from, 'none', [
    'translate(0.25%, -1.5%) rotate(1.25deg) scale(0.994)',
    'translate(-0.17%, 0.72%) rotate(-0.7deg) scale(1)',
    'translate(0.06%, -0.38%) rotate(0.32deg)',
    'translate(0, 0.13%) rotate(-0.1deg)',
  ]);

interface Options {
  /** Elemento que enmarca al bigote: solo se escucha el cursor mientras está cerca de la pantalla. */
  zone: HTMLElement;
  /** Lo que tapa al bigote y no debe activarlo (selector). */
  covered: string;
  /** Abajo, se queda mientras el cursor siga dentro de la zona (si no, mientras siga sobre el bigote). */
  stayInZone?: boolean;
}

export function mustacheHover(el: HTMLElement, { zone, covered: coveredSel, stayInZone = false }: Options) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const img = el.querySelector('img');
  if (!img) return;
  el.style.transformOrigin = '50% 60%';
  el.style.willChange = 'transform';

  let anim: Animation | null = null;
  let down = false;
  const go = (toDown: boolean) => {
    if (toDown === down) return;
    down = toDown;
    // Empieza desde donde esté ahora (aunque la animación anterior no hubiera terminado)
    const from = getComputedStyle(el).transform;
    anim?.cancel();
    anim = el.animate(toDown ? fall(from) : rise(from), { duration: toDown ? 1300 : 1100, fill: 'forwards' });
  };

  // La imagen del bigote es una caja grande con mucha parte transparente: no recibe el cursor
  // (pointer-events: none) y aquí se mira si el cursor está sobre su parte visible, con un mapa de
  // transparencia de la imagen en pequeño
  let mask: Uint8Array | null = null;
  let mw = 0;
  let mh = 0;
  const makeMask = () => {
    try {
      mw = 80;
      mh = Math.max(1, Math.round((mw * img.naturalHeight) / img.naturalWidth));
      const c = document.createElement('canvas');
      c.width = mw;
      c.height = mh;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, mw, mh);
      const px = g.getImageData(0, 0, mw, mh).data;
      // Visible = no transparente; se engorda un píxel para que el borde no sea tan exigente
      const solid = new Uint8Array(mw * mh);
      for (let i = 0; i < solid.length; i++) solid[i] = px[i * 4 + 3] > 40 ? 1 : 0;
      mask = new Uint8Array(mw * mh);
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) if (solid[Math.min(mh - 1, Math.max(0, y + dy)) * mw + Math.min(mw - 1, Math.max(0, x + dx))]) mask[y * mw + x] = 1;
    } catch {
      mask = null; // sin mapa: cuenta toda la caja del bigote
    }
  };
  if (img.complete && img.naturalWidth) makeMask();
  else img.addEventListener('load', makeMask, { once: true });

  // ¿El punto (x, y) de la pantalla cae sobre el bigote visible, tal como está ahora (quieto, cayendo o abajo)?
  const onMustache = (x: number, y: number) => {
    const parent = (el.offsetParent as HTMLElement | null) ?? document.body;
    const f = parent.getBoundingClientRect();
    const dx = f.left + el.offsetLeft;
    const dy = f.top + el.offsetTop;
    const ox = dx + el.offsetWidth * 0.5; // transform-origin: 50% 60%
    const oy = dy + el.offsetHeight * 0.6;
    const t = getComputedStyle(el).transform;
    const p = t && t !== 'none' ? new DOMMatrix(t).inverse().transformPoint(new DOMPoint(x - ox, y - oy)) : { x: x - ox, y: y - oy };
    const u = (p.x + ox - dx - img.offsetLeft) / img.offsetWidth;
    const v = (p.y + oy - dy - img.offsetTop) / img.offsetHeight;
    if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return false;
    return !mask || mask[Math.floor(v * mh) * mw + Math.floor(u * mw)] === 1;
  };
  const covered = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest(coveredSel);
  const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const check = (x: number, y: number) => {
    const over = onMustache(x, y) && !covered(x, y);
    // Abajo se queda mientras el cursor siga cerca (así no parpadea al moverse)
    const stay = over || inside((stayInZone ? zone : img).getBoundingClientRect(), x, y);
    go(down ? stay : over);
  };

  // Solo se escucha el cursor mientras la zona está cerca de la pantalla
  let px = -1;
  let py = -1;
  let mouse = false;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (px >= 0) check(px, py);
    });
  };
  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    mouse = e.pointerType === 'mouse';
    schedule();
  };
  const onScroll = () => mouse && schedule(); // el bigote se mueve bajo el cursor quieto
  const onOut = () => {
    px = -1;
    go(false);
  };
  new IntersectionObserver(
    ([e]) => {
      const on = e.isIntersecting ? addEventListener : removeEventListener;
      on('pointermove', onMove as EventListener, { passive: true });
      on('pointerdown', onMove as EventListener, { passive: true });
      on('scroll', onScroll, { passive: true });
      document.documentElement[e.isIntersecting ? 'addEventListener' : 'removeEventListener']('pointerleave', onOut);
      if (!e.isIntersecting) onOut();
    },
    { rootMargin: '50% 0px' },
  ).observe(zone);
}
