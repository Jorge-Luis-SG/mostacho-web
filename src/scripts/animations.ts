/**
 * Animaciones con el scroll de las landings.
 * Cada sección elige la suya en site.json → "anim" (lista en src/lib/anim.ts). Las que se quedan fijas
 * mientras se animan van envueltas en un tramo alto (.pin) y aquí se dibujan según cuánto se ha recorrido.
 *
 * - Solo corre si <html> tiene la clase "anim" (escritorio y sin "reducir movimiento"); si no, la web queda tal cual.
 * - No añade textos: solo mueve, recorta o duplica (de forma decorativa) lo que ya está en la página.
 * - Todo depende solo de la posición del scroll (sin muelles ni imanes): nunca se mueve sola ni va y vuelve.
 *   En las que van de un elemento a otro, cada uno se queda quieto un tramo y la transición ocupa el resto.
 * - Cada fotograma solo cambia transform y opacity de capas ya pintadas: la tarjeta gráfica lo resuelve sin
 *   volver a pintar (nada de cambiar tamaños, máscaras, recortes o filtros mientras se hace scroll).
 * - Un único bucle por fotograma: primero se leen todas las medidas y después se escribe, para no forzar
 *   recálculos de layout. Lo que no cambia con el scroll se mide al cargar y al cambiar el tamaño de la ventana.
 * - Las secciones fuera de pantalla no se calculan y sus animaciones CSS se pausan (clase .live).
 */
import type { AnimMode } from '../lib/anim';

type Box = { x: number; y: number; w: number; h: number };
type Anim = {
  mode: AnimMode;
  /** Tramo alto en el que la sección se queda fija */
  pin: HTMLElement;
  /** Recorrido del tramo en px (alto del tramo − alto de la pantalla) */
  len: number;
  /** Dibuja el estado para un progreso 0…1 (top: posición del tramo respecto a la pantalla) */
  run: (p: number, len: number, top: number) => void;
  /** Guarda las medidas que no cambian con el scroll */
  measure?: () => void;
  /** Progreso en el que queda a la vista el elemento i (para los puntos y las flechas del carrusel) */
  at?: (i: number) => number;
  /** Se llama en cada fotograma aunque la sección no esté en pantalla */
  each?: (r: DOMRect, len: number) => void;
  /** Si devuelve un número, no se deja bajar el scroll más allá de esa posición (la sección aún no terminó) */
  hold?: () => number | null;
  /** Al acercarse la sección (una vez): adelanta la carga de sus fotos. urgent: ya está en pantalla */
  warm?: (urgent?: boolean) => void;
  live?: boolean;
  near?: boolean;
  warmed?: boolean;
};
type Part = Omit<Anim, 'mode' | 'pin' | 'len'>;
/** Animación que no fija la sección: lee en la fase de lectura y escribe después */
type Extra = { read: () => unknown; write: (v: never) => void; measure?: () => void };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (x: number) => x * x * (3 - 2 * x);
const unease = (e: number) => (e < 0.5 ? Math.sqrt(e / 2) : 1 - Math.sqrt((1 - e) / 2));
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const box = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const kids = (el: Element) => Array.from(el.children) as HTMLElement[];
const make = (tag: string, cls: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
};
const decorative = (src = '') => {
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  if (src) img.src = src;
  return img;
};
const srcOf = (root: Element | null | undefined) => {
  const img = root?.querySelector('img');
  return img ? img.currentSrc || img.src : '';
};

const html = document.documentElement;
if (html.classList.contains('anim')) {
  try {
    start();
  } catch (err) {
    // Si algo falla, la página vuelve a verse sin animaciones
    html.classList.remove('anim');
    console.error(err);
  }
}

function start() {
  // Al pasar a móvil (o al revés) se recarga: así la página queda exactamente como debe en cada caso
  matchMedia('(min-width: 900px) and (min-height: 500px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').addEventListener('change', () => location.reload());

  let vh = innerHeight;
  let vw = html.clientWidth;
  const mouse = { x: 0, y: 0 };
  let ticking = false;
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };

  // ---------- Utilidades compartidas ----------

  /** Carrusel de la sección (src/components/ui/Carousel.astro) */
  const carousel = (sec: HTMLElement) => {
    const root = sec.querySelector<HTMLElement>('[data-carousel]');
    const track = root?.querySelector<HTMLElement>('[data-track]');
    return root && track ? { root, track, view: track.parentElement as HTMLElement, items: kids(track) } : null;
  };

  /** El carrusel pasa a modo "dirigido": sus puntos y flechas mueven el scroll de la página */
  const driver = (root: HTMLElement) => {
    let count = -1;
    let cur = -1;
    return {
      count(n: number) {
        if (n === count) return;
        count = n;
        cur = -1;
        root.dataset.driven = String(n);
        root.dispatchEvent(new CustomEvent('driven:on', { detail: { count: n } }));
      },
      active(i: number) {
        if (i === cur) return;
        cur = i;
        root.dispatchEvent(new CustomEvent('driven:active', { detail: { index: i } }));
      },
    };
  };

  /** Posición continua → cada elemento se queda quieto un tramo (a) y la transición ocupa el resto, suavizada */
  const plateau = (U: number, a = 0.2) => {
    const s = Math.floor(U);
    return s + smooth(clamp((U - s - a) / (1 - 2 * a)));
  };

  /** Adelanta la descarga de las fotos (así no aparecen en negro al llegar): la propia foto pasa a cargar ya,
   *  en orden y de 4 en 4 (las primeras de cada sección llegan antes en vez de competir todas a la vez).
   *  Si una tarda más de 6 s, la cola sigue igualmente: nunca se queda atascada. */
  const todo: HTMLImageElement[] = [];
  let busy = 0;
  const pump = () => {
    while (busy < 4 && todo.length) {
      const img = todo.shift()!;
      if (img.complete && img.naturalWidth) continue;
      busy++;
      let done = false;
      const next = () => {
        if (done) return;
        done = true;
        busy--;
        pump();
      };
      img.addEventListener('load', next, { once: true });
      img.addEventListener('error', next, { once: true });
      setTimeout(next, 6000);
      img.loading = 'eager';
    }
  };
  /** urgent: la sección ya está en pantalla → sus fotos pendientes pasan delante en la cola */
  const preload = (els: HTMLElement[], urgent = false) => {
    const mine: HTMLImageElement[] = [];
    els.forEach((el) =>
      el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (!img.src || (img.complete && img.naturalWidth)) return;
        if (img.dataset.warm) {
          if (!urgent) return;
          const k = todo.indexOf(img);
          if (k < 0) return; // ya se está descargando
          todo.splice(k, 1);
        }
        img.dataset.warm = '1';
        mine.push(img);
      }),
    );
    if (urgent) todo.unshift(...mine);
    else todo.push(...mine);
    pump();
  };
  /** A medida que se avanza, el elemento actual y los n siguientes pasan al frente de la cola de descargas */
  const ahead = (items: HTMLElement[], n = 3) => {
    let last = -1;
    return (i: number) => {
      if (i === last) return;
      last = i;
      preload(items.slice(i, i + n + 1), true);
    };
  };

  /** Elementos lejos del que se ve: fuera del layout (y sus imágenes aún sin cargar) */
  const farSet = (items: HTMLElement[]) => {
    const state = items.map(() => false);
    return (i: number, far: boolean) => {
      if (state[i] === far) return;
      state[i] = far;
      items[i].classList.toggle('far', far);
    };
  };

  /** Franja derecha de las diapositivas apiladas: la siguiente asoma desenfocada (como en el diseño) */
  const peek = (view: HTMLElement, items: HTMLElement[]) => {
    const box = make('div', 'anim-peek');
    box.setAttribute('aria-hidden', 'true');
    // Dos imágenes: la nueva se prepara oculta y solo se muestra cuando ya está decodificada (sin parpadeo)
    const pair = [decorative(), decorative()];
    pair[0].hidden = pair[1].hidden = true; // hasta tener su primera foto
    box.append(...pair);
    view.prepend(box);
    let front = 0;
    // La versión más pequeña de la foto basta para una franja desenfocada
    const small = (el: HTMLElement) => {
      const src = el.querySelector<HTMLImageElement>('.slide__img');
      if (!src) return '';
      const first = src.srcset?.split(',')[0]?.trim().split(/\s+/)[0];
      return first || src.currentSrc || src.src;
    };
    // Todas las versiones pequeñas se descargan al principio (pesan poco) y la franja solo cambia a una ya cargada
    const ready = new Map<string, Promise<void>>();
    const load = (url: string) => {
      let pr = ready.get(url);
      if (!pr) {
        const im = new Image();
        im.src = url;
        pr = im.decode().catch(() => {});
        ready.set(url, pr);
      }
      return pr;
    };
    items.forEach((el) => {
      const url = small(el);
      if (url) load(url);
    });
    let cur = -2;
    return (i: number) => {
      const n = (i + 1) % items.length;
      if (n === cur) return;
      cur = n;
      const url = small(items[n]);
      if (!url || pair[front].getAttribute('src') === url) return;
      load(url).then(() => {
        if (cur !== n) return;
        const back = pair[1 - front];
        back.src = url;
        back.decode().catch(() => {}).then(() => {
          if (cur !== n) return;
          back.hidden = false;
          pair[front].hidden = true;
          front = 1 - front;
        });
      });
    };
  };

  const cardsMetrics = (track: HTMLElement, view: HTMLElement, items: HTMLElement[]) => {
    const cw = items[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const visible = Math.max(1, Math.floor((view.clientWidth + gap + 2) / (cw + gap)));
    return { cw, gap, step: cw + gap, visible, max: Math.max(0, (items.length - visible) * (cw + gap)), pages: Math.max(1, Math.ceil(items.length / visible)) };
  };

  // ---------- Partículas: confeti, chispas y los efectos de pantalla completa de Efectos especiales ----------
  // Dos lienzos fijos sobre toda la pantalla: uno nítido (confeti, chispas, fuegos) y otro a media resolución para
  // humo y neblina (son difuminados: así cuestan una cuarta parte). Solo existen mientras hay algo que dibujar.
  const layer = (cls: string, scale: () => number) => {
    const c = make('canvas', cls) as HTMLCanvasElement;
    c.hidden = true;
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    const g = c.getContext('2d')!;
    return {
      c,
      g,
      open() {
        if (!c.hidden) return;
        const k = scale();
        c.hidden = false;
        c.width = Math.round(innerWidth * k);
        c.height = Math.round(innerHeight * k);
        g.setTransform(k, 0, 0, k, 0, 0);
      },
    };
  };
  const crisp = layer('anim-confetti', () => Math.min(2, devicePixelRatio || 1));
  const soft = layer('anim-confetti anim-fx', () => 0.5);
  type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number; g: number; decay: number; spark?: boolean; drag?: number; rocket?: string[]; fuse?: number };
  type Puff = { x: number; y: number; vx: number; vy: number; s: number; grow: number; drag: number; g: number; a: number; life: number; decay: number; spr: HTMLCanvasElement };
  type Emitter = { t: number; rate: number; acc: number; each: () => void };
  let bits: Bit[] = [];
  let puffs: Puff[] = [];
  let emitters: Emitter[] = [];
  let running = false;
  let lastStep = 0;
  const COLORS = ['#F5333F', '#00FF6C', '#ffffff', '#E9B44C', '#5D0000'];
  const SPARKS = ['#fff6d5', '#ffd36b', '#ffb02e', '#ffffff'];
  const FIRE = [['#ff3b4a', '#ffd0d4'], ['#00ff6c', '#d6ffe6'], ['#ffd36b', '#fff6d5'], ['#b45cff', '#f0dcff'], ['#4fc3ff', '#e0f5ff']];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  // Bocanada de humo: un degradado redondo por color, pintado una sola vez y reutilizado
  const sprites = new Map<string, HTMLCanvasElement>();
  const puffOf = (hex: string) => {
    let c = sprites.get(hex);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const n = parseInt(hex.slice(1), 16);
    const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, `rgba(${rgb}, 1)`);
    grd.addColorStop(0.45, `rgba(${rgb}, 0.55)`);
    grd.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    sprites.set(hex, c);
    return c;
  };
  const step = (now: number) => {
    // Física por tiempo (no por fotograma): igual de rápida en pantallas de 60 y de 165 Hz
    const dt = now - lastStep;
    const f = clamp(dt / 16.67, 0.2, 3);
    lastStep = now;
    emitters = emitters.filter((e) => {
      e.acc += e.rate * f;
      for (; e.acc >= 1; e.acc--) e.each();
      e.t -= dt;
      return e.t > 0;
    });
    // Nítido: confeti, chispas y cohetes
    if (bits.length || !crisp.c.hidden) {
      const g = crisp.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, crisp.c.width, crisp.c.height);
      const born: Bit[] = [];
      bits = bits.filter((q) => q.life > 0);
      for (const q of bits) {
        q.vy += q.g * f;
        const dr = Math.pow(q.drag ?? 0.985, f);
        q.vx *= dr;
        if (q.drag) q.vy *= dr;
        q.x += q.vx * f;
        q.y += q.vy * f;
        q.r += q.vr * f;
        q.life -= q.decay * f;
        // El cohete estalla al frenarse en lo alto; algunas de sus estrellas vuelven a estallar (mecha)
        if (q.fuse !== undefined) q.fuse -= f;
        if (q.rocket && (q.fuse !== undefined ? q.fuse <= 0 : q.vy > -1.2)) {
          q.life = 0;
          const [c1, c2] = q.rocket;
          const big = q.fuse === undefined;
          const count = big ? 110 : 28;
          for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + Math.random() * 0.1;
            const v = big ? rnd(3, 9) : rnd(1.4, 3.8);
            born.push({ x: q.x, y: q.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: 0, vr: 0, w: big ? 3.4 : 2.4, h: big ? 3.4 : 2.4, c: i % 3 ? c1 : c2, life: 1, g: 0.06, decay: big ? rnd(0.012, 0.018) : rnd(0.02, 0.03), spark: true, drag: 0.975 });
          }
          if (big && Math.random() < 0.6)
            for (let i = 0; i < 5; i++) {
              const ang = Math.random() * Math.PI * 2;
              const v = rnd(3, 5.5);
              born.push({ x: q.x, y: q.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: 0, vr: 0, w: 3, h: 3, c: c2, life: 1, g: 0.05, decay: 0, spark: true, drag: 0.97, rocket: pick(FIRE), fuse: rnd(22, 34) });
            }
        }
      }
      bits.push(...born);
      // Primero el confeti (gira); después las chispas, todas de una vez en modo luz y sin girar (mucho más barato)
      for (const q of bits) {
        if (q.spark || q.life <= 0) continue;
        g.globalAlpha = clamp(q.life * 1.5);
        const k = crisp.c.width / innerWidth;
        g.setTransform(k * Math.cos(q.r), k * Math.sin(q.r), -k * Math.sin(q.r), k * Math.cos(q.r), k * q.x, k * q.y);
        g.fillStyle = q.c;
        g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      }
      const k = crisp.c.width / innerWidth;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.globalCompositeOperation = 'lighter';
      for (const q of bits) {
        if (!q.spark || q.life <= 0) continue;
        g.globalAlpha = clamp(q.life * 1.5);
        g.fillStyle = q.c;
        g.fillRect(q.x - q.w / 2, q.y - q.h / 2, q.w, q.h);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      if (!bits.length) crisp.c.hidden = true;
    }
    // Media resolución: humo y neblina
    if (puffs.length || !soft.c.hidden) {
      const g = soft.g;
      g.clearRect(0, 0, innerWidth, innerHeight);
      puffs = puffs.filter((q) => q.life > 0);
      for (const q of puffs) {
        const dr = Math.pow(q.drag, f);
        q.vx *= dr;
        q.vy = q.vy * dr + q.g * f;
        q.x += q.vx * f;
        q.y += q.vy * f;
        q.s += q.grow * f;
        q.life -= q.decay * f;
        // Entra suave y se desvanece al final
        g.globalAlpha = q.a * smooth(clamp((1 - q.life) / 0.12)) * clamp(q.life / 0.45);
        g.drawImage(q.spr, q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      g.globalAlpha = 1;
      if (!puffs.length) soft.c.hidden = true;
    }
    if (bits.length || puffs.length || emitters.length) requestAnimationFrame(step);
    else running = false;
  };
  const kick = () => {
    if (bits.length) crisp.open();
    if (puffs.length) soft.open();
    if (!running) {
      running = true;
      lastStep = performance.now();
      requestAnimationFrame(step);
    }
  };
  /** Lanza partículas durante un tiempo (rate: cuántas por fotograma a 60 Hz) */
  const emit = (ms: number, rate: number, each: () => void) => {
    emitters.push({ t: ms, rate, acc: 0, each: () => (each(), kick()) });
    kick();
  };
  const burst = (x: number, y: number, kind: 'confetti' | 'sparks' = 'confetti') => {
    if (kind === 'sparks') {
      for (let i = 0; i < 70; i++)
        bits.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: -(5 + Math.random() * 10), r: 0, vr: 0, w: 2 + Math.random() * 3, h: 2 + Math.random() * 3, c: SPARKS[i % SPARKS.length], life: 1, g: 0.28, decay: 0.02, spark: true });
    } else {
      for (let i = 0; i < 130; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 4 + Math.random() * 9;
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: COLORS[i % COLORS.length], life: 1, g: 0.32, decay: 0.009 });
      }
    }
    kick();
  };
  // Efectos de pantalla completa: cada carta de Efectos especiales hace lo que anuncia (site.json → items[].fx).
  // Cada uno devuelve cuánto dura; se encolan para que no se pisen (el siguiente empieza cuando termina el anterior).
  const fog = (ms = 1100) => {
    emit(ms, 0.7, () => {
      const fromLeft = Math.random() < 0.5;
      puffs.push({ x: fromLeft ? rnd(-150, innerWidth * 0.5) : rnd(innerWidth * 0.5, innerWidth + 150), y: innerHeight + rnd(-50, 70), vx: (fromLeft ? 1 : -1) * rnd(0.6, 2.2), vy: -rnd(0.15, 0.5), s: rnd(240, 380), grow: rnd(0.8, 1.6), drag: 0.997, g: 0, a: 0.2, life: 1, decay: rnd(0.0075, 0.009), spr: puffOf(pick(['#f2f2f6', '#dcdce4', '#ffffff'])) });
    });
    return ms + 2200;
  };
  const FX: Record<string, (r: DOMRect) => number> = {
    // Bazooka: un chorro de humo de colores sale de la esquina superior derecha de la carta y se abre por la pantalla
    smoke(r) {
      const x0 = r.right - 14;
      const y0 = r.top + 14;
      emit(500, 1.7, () => {
        const ang = -Math.PI * 0.28 + rnd(-0.38, 0.38); // hacia arriba a la derecha, como el cañón de la foto
        const v = rnd(18, 30);
        puffs.push({ x: x0, y: y0, vx: Math.cos(ang) * v * 1.3, vy: Math.sin(ang) * v, s: rnd(90, 150), grow: rnd(7, 12), drag: 0.966, g: -0.005, a: 0.5, life: 1, decay: rnd(0.012, 0.015), spr: puffOf(pick(['#ff3fb4', '#ff7ad9', '#d14cff', '#ff5fa0', '#ff9be3'])) });
      });
      return 500 + 1400;
    },
    // Neblina baja: entra por abajo y cubre el suelo de la pantalla (ligera)
    fog: () => fog(),
    // Fuegos artificiales: muchos cohetes que suben y estallan por toda la pantalla (algunos en varias explosiones)
    fireworks() {
      let n = 0;
      const ms = 2600;
      emit(ms, 0.17, () => {
        n++;
        bits.push({ x: innerWidth * rnd(0.08, 0.92), y: innerHeight + 10, vx: rnd(-1.4, 1.4), vy: -rnd(12.5, 17.5) * Math.sqrt(innerHeight / 900), r: 0, vr: 0, w: 3, h: 9, c: '#fff1c9', life: 1, g: 0.24, decay: 0, spark: true, drag: 0.995, rocket: FIRE[n % FIRE.length] });
      });
      return ms + 2300;
    },
    // Confeti: lluvia de confeti por toda la pantalla
    confetti() {
      emit(1600, 4, () =>
        bits.push({ x: rnd(-20, innerWidth + 20), y: rnd(-60, -10), vx: rnd(-1.5, 1.5), vy: rnd(2, 5), r: rnd(0, 3), vr: rnd(-0.2, 0.2), w: rnd(7, 13), h: rnd(4, 7), c: pick(COLORS), life: 1, g: 0.04, decay: rnd(0.0045, 0.0065), drag: 0.995 }),
      );
      return 1600 + 2600;
    },
    // Neblina y pirotecnia fría: neblina ligera por abajo y fuentes de chispas frías
    'fog-sparks'() {
      const ms = fog(1600);
      for (const fx of [0.18, 0.5, 0.82])
        emit(1700, 2.6, () =>
          bits.push({ x: innerWidth * fx + rnd(-8, 8), y: innerHeight + 4, vx: rnd(-1.4, 1.4), vy: -rnd(9, 15) * Math.sqrt(innerHeight / 900), r: 0, vr: 0, w: rnd(1.8, 3), h: rnd(1.8, 3), c: pick(SPARKS), life: 1, g: 0.2, decay: rnd(0.016, 0.024), spark: true }),
        );
      return Math.max(ms, 2900);
    },
  };
  const fxQueue: { run: () => number; done?: () => void }[] = [];
  let fxBusy = 0;
  const nextFx = () => {
    while (!fxBusy && fxQueue.length) {
      const { run, done } = fxQueue.shift()!;
      const ms = run();
      if (ms > 0)
        fxBusy = window.setTimeout(() => {
          fxBusy = 0;
          done?.();
          nextFx();
        }, ms);
      else done?.();
    }
  };
  /** Encola un efecto; done se llama cuando termina (o si se salta) */
  const playFx = (run: () => number, done?: () => void) => {
    fxQueue.push({ run, done });
    nextFx();
  };
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('.btn, .social__link--whatsapp');
    if (!b) return;
    const r = b.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
  });

  // Silueta del bigote (la del inicio o, si no hay, la de «Nosotros») para el dorso de las tarjetas
  const stache = document.querySelector<HTMLImageElement>('.hero__stache')?.src || srcOf(document.querySelector('.about__decor'));

  // ---------- Animaciones de cada sección ----------
  const builders: Partial<Record<AnimMode, (pin: HTMLElement, sec: HTMLElement) => Part | null>> = {
    // Inicio: el bigote se enciende como un LED, deja ver la fiesta dentro de su silueta y crece hasta llenar la pantalla.
    // La ventana (máscara) se dibuja una sola vez; crecer es escalar la capa (y la foto/video al revés para que no se agranden).
    mask(_pin, sec) {
      const media = sec.querySelector<HTMLElement>('.hero__media');
      const cover = sec.querySelector<HTMLImageElement>('.hero__stache');
      if (!media || !cover) return null;
      const layers = Array.from(media.querySelectorAll<HTMLElement>('.hero__bg, .hero__overlay'));
      const ui = Array.from(sec.querySelectorAll<HTMLElement>('.hero__content, .hero__social, .hero__lang, .hero__scroll'));
      const header = document.querySelector<HTMLElement>('[data-header]');
      const RATIO = Number(cover.dataset.ratio) || 0.6835;
      const FY = 0.512; // altura del "puente" del bigote: el punto desde el que crece
      const url = `url("${cover.src}")`;
      const set = (k: string, v: string) => {
        media.style.setProperty(k, v);
        media.style.setProperty(`-webkit-${k}`, v);
      };
      set('mask-repeat', 'no-repeat');
      let W = 0;
      let S0 = 0;
      let masked: boolean | null = null;
      let pinned: boolean | null = null;
      let shown = -1;
      // Borde LED: se pinta una sola vez en un lienzo (brillo rojo + filo claro, sin el interior) y luego solo se escala
      const led = make('div', 'hero__led');
      led.setAttribute('aria-hidden', 'true');
      cover.after(led);
      let ledFor = 0;
      const paintLed = () => {
        if (!cover.naturalWidth || !S0 || Math.abs(ledFor - S0) < 2) return;
        ledFor = S0;
        const w = S0;
        const h = w * RATIO;
        const pad = Math.round(w * 0.07);
        const dpr = Math.min(2, devicePixelRatio || 1);
        const c = document.createElement('canvas');
        c.width = Math.round((w + pad * 2) * dpr);
        c.height = Math.round((h + pad * 2) * dpr);
        const g = c.getContext('2d')!;
        g.scale(dpr, dpr);
        g.shadowColor = '#ff2b3a';
        g.shadowBlur = 20 * dpr;
        for (let i = 0; i < 3; i++) g.drawImage(cover, pad, pad, w, h);
        g.shadowColor = '#ffe0e4';
        g.shadowBlur = 3 * dpr;
        for (let i = 0; i < 2; i++) g.drawImage(cover, pad, pad, w, h);
        g.globalCompositeOperation = 'destination-out';
        g.shadowColor = 'transparent';
        g.shadowBlur = 0;
        g.drawImage(cover, pad, pad, w, h);
        c.style.width = `${w + pad * 2}px`;
        c.style.height = `${h + pad * 2}px`;
        led.replaceChildren(c);
        led.style.transformOrigin = `50% calc(50% + ${((FY - 0.5) * h).toFixed(1)}px)`;
      };
      cover.decode?.().then(paintLed, () => {});
      return {
        measure() {
          W = sec.clientWidth;
          S0 = Math.min(W * 0.62, Math.max(640, innerWidth * 0.333));
          const h0 = S0 * RATIO;
          set('mask-size', `${S0}px ${h0}px`);
          set('mask-position', `${(W - S0) / 2}px ${(vh - h0) / 2}px`);
          const origin = `${W / 2}px ${vh / 2 + (FY - 0.5) * h0}px`;
          media.style.transformOrigin = origin;
          layers.forEach((l) => (l.style.transformOrigin = origin));
          paintLed();
        },
        run(p) {
          // 0 → 0,16: el bigote rojo se desvanece y deja ver la fiesta dentro de su silueta (el borde LED sigue encendido)
          const fade = clamp(p / 0.16);
          const grow = 1 + fade * 0.04;
          cover.style.opacity = (1 - fade).toFixed(3);
          cover.style.transform = `translate(-50%, -50%) scale(${grow})`;
          // 0,12 → 0,8: la silueta crece hasta llenar la pantalla
          const g = ease(clamp((p - 0.12) / 0.68));
          const s = grow * Math.pow((W * 60) / S0, g * g);
          const on = p < 0.82;
          if (on !== masked) {
            masked = on;
            set('mask-image', on ? url : 'none');
            if (!on) {
              media.style.transform = '';
              layers.forEach((l) => (l.style.transform = ''));
            }
          }
          if (on) {
            media.style.transform = `scale(${s.toFixed(4)})`;
            const inv = `scale(${(1 / s).toFixed(5)})`;
            layers.forEach((l) => (l.style.transform = inv));
          }
          const ledOn = 1 - clamp((p - 0.16) / 0.18);
          led.style.opacity = ledOn.toFixed(3);
          led.style.visibility = ledOn > 0 ? '' : 'hidden';
          if (ledOn > 0) led.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;
          // 0,55 → 0,8: aparecen el título, el idioma, las redes y la flecha
          const t = clamp((p - 0.55) / 0.25);
          const tk = Math.round(t * 1000);
          if (tk !== shown) {
            shown = tk;
            ui.forEach((el) => {
              el.style.opacity = t.toFixed(3);
              el.style.visibility = t > 0 ? '' : 'hidden';
              el.style.pointerEvents = t > 0.5 ? '' : 'none';
            });
          }
        },
        // La cabecera se queda fija mientras dura el inicio (sin moverla en cada fotograma) y luego sigue a la página.
        // Se decide en cada fotograma aunque el inicio no esté en pantalla (p. ej. al saltar con el menú).
        each(r, len) {
          const pin = -r.top < len;
          if (!header || pin === pinned) return;
          pinned = pin;
          header.classList.toggle('is-fixed', pin);
          header.style.transform = pin ? '' : `translate3d(0, ${len}px, 0)`;
        },
      };
    },

    // Nosotros se queda fija; el bigote guía (más abajo) hace el resto
    guide: () => ({ run: () => {} }),

    // Servicios: un carrusel normal que avanza con el scroll hasta mostrar todas las tarjetas
    slide(_pin, sec) {
      const c = carousel(sec);
      if (!c || !c.items.length) return null;
      const { root, track, view, items } = c;
      const d = driver(root);
      let m = cardsMetrics(track, view, items);
      return {
        warm: (urgent) => preload(c.items, urgent),
        measure() {
          // El carril mide justo lo que ocupan las tarjetas que caben (si se encogen por el alto, no asoma la siguiente)
          track.style.width = '';
          m = cardsMetrics(track, view, items);
          track.style.width = `${m.visible * m.step - m.gap}px`;
          m = cardsMetrics(track, view, items);
          d.count(m.pages);
        },
        run(p) {
          const t = ease(clamp((p - 0.1) / 0.8));
          const x = `translate3d(${(-m.max * t).toFixed(1)}px, 0, 0)`;
          items.forEach((el) => (el.style.transform = x));
          d.active(Math.round(t * (m.pages - 1)));
        },
        at: (i) => (m.pages > 1 ? 0.1 + 0.8 * unease(i / (m.pages - 1)) : 0),
      };
    },

    // Hora loca: cada show a pantalla completa; al bajar, el banner se retira hacia el fondo y el siguiente entra por encima
    ring(_pin, sec) {
      const c = carousel(sec);
      if (!c || c.items.length < 2) return null;
      const { root, view, items } = c;
      const N = items.length;
      const texts = items.map((s) => s.querySelector<HTMLElement>('.slide__content'));
      const side = peek(view, items);
      const warm = ahead(items);
      const PAD = 0.25 / N;
      const at = (i: number) => PAD + (1 - 2 * PAD) * (i / (N - 1));
      const far = farSet(items);
      const d = driver(root);
      d.count(N);
      return {
        at,
        run(p) {
          const v = plateau(clamp((p - PAD) / (1 - 2 * PAD)) * (N - 1));
          const s = Math.min(N - 2, Math.floor(v));
          const f = v - s;
          items.forEach((el, i) => {
            const off = i < s || i > s + 2;
            far(i, off);
            if (off) return;
            const tx = texts[i];
            if (i === s) {
              el.style.visibility = 'visible';
              el.style.zIndex = '1';
              el.style.transform = `translate3d(${(-f * 6).toFixed(2)}%, 0, 0) scale(${(1 - f * 0.12).toFixed(4)})`;
              el.style.opacity = (1 - f * 0.6).toFixed(3);
              if (tx) {
                tx.style.opacity = (1 - clamp(f / 0.5)).toFixed(3);
                tx.style.transform = '';
              }
            } else if (i === s + 1) {
              el.style.visibility = f > 0 ? 'visible' : 'hidden';
              el.style.zIndex = '2';
              // Entra desde la franja de la derecha, donde ya asomaba
              el.style.transform = `translate3d(${((1 - f) * 100).toFixed(2)}%, 0, 0)`;
              el.style.opacity = '1';
              if (tx) {
                tx.style.opacity = clamp((f - 0.45) / 0.55).toFixed(3);
                tx.style.transform = `translate3d(0, ${((1 - f) * 28).toFixed(1)}px, 0)`;
              }
            } else el.style.visibility = 'hidden';
          });
          side(Math.round(v));
          warm(s);
          d.active(Math.round(v));
        },
        warm: (urgent) => preload(items, urgent),
      };
    },

    // Recibe: al bajar, la diapositiva se abre como una puerta doble y deja ver la siguiente
    doors(_pin, sec) {
      const c = carousel(sec);
      if (!c || c.items.length < 2) return null;
      const { root, view, items } = c;
      const RN = items.length;
      const PAD = 0.25 / RN;
      const shade = () => {
        const el = make('div', 'anim-shade');
        el.setAttribute('aria-hidden', 'true');
        return el;
      };
      // Dos hojas: la izquierda es la diapositiva original; la derecha, una copia decorativa.
      // La hoja izquierda se monta ya dentro de la página, así sus fotos siguen cargándose solo cuando hacen falta.
      const parts = items.map((slide) => {
        const l = make('div', 'leaf leaf--l');
        const content = Array.from(slide.childNodes);
        slide.append(l);
        l.append(...content);
        const r = make('div', 'leaf leaf--r');
        r.setAttribute('aria-hidden', 'true');
        r.inert = true;
        const dim = shade();
        dim.classList.add('anim-dim');
        slide.append(r, dim);
        return { l, r, dim, sl: null as HTMLElement | null, sr: null as HTMLElement | null };
      });
      // La copia se rellena cuando la diapositiva está a punto de verse (copiarla antes descargaría todas las fotos al cargar)
      const fill = (i: number) => {
        const pt = parts[i];
        if (pt.sl) return;
        pt.r.append(...Array.from(pt.l.childNodes, (n) => n.cloneNode(true)));
        pt.sl = shade();
        pt.sr = shade();
        pt.l.append(pt.sl);
        pt.r.append(pt.sr);
      };
      const at = (i: number) => PAD + (1 - 2 * PAD) * (i / (RN - 1));
      const far = farSet(items);
      const d = driver(root);
      d.count(RN);
      const side = peek(view, items);
      const warm = ahead(items);
      return {
        at,
        warm: (urgent) => preload(items, urgent),
        run(p) {
          const v = plateau(clamp((p - PAD) / (1 - 2 * PAD)) * (RN - 1));
          const s = Math.min(RN - 2, Math.floor(v));
          const k = v - s;
          items.forEach((el, i) => {
            const off = i < s || i > s + 2;
            far(i, off);
            if (off) return;
            fill(i);
            const { l, r, dim, sl, sr } = parts[i];
            if (i === s) {
              // Las dos hojas se abren hacia fuera y se oscurecen al girar
              el.style.visibility = 'visible';
              el.style.zIndex = '2';
              el.style.transform = '';
              el.style.opacity = (1 - clamp((k - 0.75) / 0.25)).toFixed(3);
              l.style.transform = `rotateY(${(-k * 100).toFixed(2)}deg)`;
              r.style.transform = `rotateY(${(k * 100).toFixed(2)}deg)`;
              sl!.style.opacity = sr!.style.opacity = (k * 0.55).toFixed(3);
              dim.style.opacity = '0';
            } else if (i === s + 1) {
              // La siguiente espera detrás, algo más pequeña y en penumbra, y avanza al abrirse las puertas
              el.style.visibility = 'visible';
              el.style.zIndex = '1';
              el.style.opacity = '1';
              el.style.transform = `scale(${lerp(0.9, 1, k).toFixed(4)})`;
              l.style.transform = r.style.transform = '';
              sl!.style.opacity = sr!.style.opacity = '0';
              dim.style.opacity = ((1 - k) * 0.65).toFixed(3);
            } else el.style.visibility = 'hidden';
          });
          side(Math.round(v));
          warm(s);
          d.active(Math.round(v));
        },
      };
    },

    // Efectos: las tarjetas se reparten por tandas desde la baraja (una detrás de otra, con chispas al caer).
    // Al bajar, la tanda se retira y se reparte la siguiente.
    deal(_pin, sec) {
      const c = carousel(sec);
      if (!c || !c.items.length) return null;
      const { root, track, view } = c;
      const flips = c.items.map((card) => {
        const f = make('div', 'flip');
        card.replaceWith(f);
        const back = make('div', 'anim-back');
        back.setAttribute('aria-hidden', 'true');
        if (stache) back.append(decorative(stache));
        f.append(card, back);
        return f;
      });
      const n = flips.length;
      const d = driver(root);
      let m = cardsMetrics(track, view, flips);
      let B = 1;
      let nat: number[] = [];
      // Pasos: 0 = baraja cerrada; cada paso descubre una carta más, de una en una (también en las tandas siguientes:
      // al empezar una tanda nueva, la anterior se retira). steps = cartas + 1.
      let stage = -1;
      const tok = flips.map(() => 0); // cada carta lleva su propia cuenta (sus chispas no se cancelan por las demás)
      const steps = () => n + 1;
      const batchOf = (i: number) => Math.floor(i / m.visible);
      const slotX = (i: number) => {
        const b = batchOf(i);
        const cnt = Math.min(m.visible, n - b * m.visible);
        const row = m.visible * m.step - m.gap;
        return (view.clientWidth - row) / 2 + ((m.visible - cnt) * m.step) / 2 + (i - b * m.visible) * m.step - nat[i];
      };
      const deckX = (i: number) => view.clientWidth / 2 - (nat[i] + m.cw / 2);
      type State = 'deck' | 'dealt' | 'goneL' | 'goneR' | 'hidden';
      const cur: State[] = flips.map(() => 'deck');
      // Orden en que se descubren las cartas de la primera tanda: los extremos primero y la del centro (donde está la baraja) al final
      const rank = (j: number, cnt: number) => (j === 0 ? 0 : j === cnt - 1 ? 1 : j + 1);
      // Orden global en que salen las cartas (tanda por tanda, y dentro de cada tanda según rank) y su posición en él
      let pos: number[] = [];
      let seq: number[] = [];
      const order = () => {
        seq = flips.map((_, i) => i).sort((a, b) => batchOf(a) - batchOf(b) || rank(a % m.visible, Math.min(m.visible, n - batchOf(a) * m.visible)) - rank(b % m.visible, Math.min(m.visible, n - batchOf(b) * m.visible)));
        pos = [];
        seq.forEach((card, k) => (pos[card] = k));
      };
      const batchAt = (st: number) => (st > 0 ? batchOf(seq[st - 1]) : 0);
      const want = (st: number, i: number): State => {
        const b = batchOf(i);
        const t = batchAt(st);
        if (b === t) return st > 0 && pos[i] < st ? 'dealt' : 'deck';
        return b < t ? 'goneL' : 'hidden';
      };
      // Cartas que acaban de salir y cuyo efecto aún no ha terminado: mientras haya alguna, no sale la siguiente
      let pending = 0;
      const settle = () => {
        pending = Math.max(0, pending - 1);
        if (!pending) advance();
        request(); // por si hay que soltar el bloqueo del scroll
      };
      const put = (f: HTMLElement, i: number, st: State, delay: number | null) => {
        const my = ++tok[i];
        const j = i % m.visible;
        const cnt = Math.min(m.visible, n - batchOf(i) * m.visible);
        let tf: string;
        if (st === 'dealt') tf = `translate3d(${slotX(i)}px, 0px, 0px) rotateZ(0deg) rotateY(0deg)`;
        else if (st === 'goneL' || st === 'goneR') tf = `translate3d(${slotX(i) + (st === 'goneL' ? -1 : 1) * m.step * 0.7}px, -40px, 0px) rotateZ(${st === 'goneL' ? -10 : 10}deg) rotateY(0deg)`;
        else tf = `translate3d(${deckX(i)}px, 0px, ${(cnt - 1 - j) * 2}px) rotateZ(${(j - (cnt - 1) / 2) * -6}deg) rotateY(180deg)`;
        // La transparencia va en las caras (en el contenedor 3D anularía el dorso de la carta)
        f.style.transition = delay === null ? 'none' : `transform 0.7s cubic-bezier(0.2, 0.8, 0.25, 1) ${delay}ms`;
        f.style.setProperty('--fade', delay === null ? '0s' : '0.45s');
        f.style.setProperty('--fade-delay', `${delay ?? 0}ms`);
        f.style.transform = tf;
        f.style.setProperty('--o', st === 'goneL' || st === 'goneR' || st === 'hidden' ? '0' : '1');
        f.style.zIndex = String(n - rank(j, cnt)); // encima de la baraja, la siguiente que va a salir
        f.inert = st !== 'dealt';
        f.classList.toggle('is-lift', st === 'dealt' && delay !== null);
        if (st === 'dealt' && delay !== null) {
          f.style.animationDelay = `${delay}ms`;
          // Al caer la carta suelta chispas y su efecto llena la pantalla (humo, neblina, fuegos…), en cola tras el anterior
          pending++;
          setTimeout(() => {
            if (my !== tok[i]) return settle();
            const r = f.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height * 0.15, 'sparks');
            const fx = FX[f.querySelector<HTMLElement>('[data-fx]')?.dataset.fx ?? ''];
            if (!fx) return settle();
            playFx(() => {
              // Si ya no está a la vista (se siguió bajando o subiendo), se salta
              const q = f.getBoundingClientRect();
              return my === tok[i] && q.bottom > 0 && q.top < innerHeight ? fx(q) : 0;
            }, settle);
          }, delay + 620);
        }
      };
      // Coloca todo al instante según el paso actual (al cargar o al cambiar el tamaño)
      const snapAll = () =>
        flips.forEach((f, i) => {
          cur[i] = want(Math.max(0, stage), i);
          put(f, i, cur[i], null);
        });
      // El scroll marca a qué paso hay que llegar (goal); se avanza de uno en uno y solo cuando terminó el efecto anterior.
      // Al subir, o si la sección ya no está en pantalla, se va directo.
      let goal = 0;
      let away = false;
      const advance = () => {
        if (goal === stage) return;
        if (goal < stage || away || stage < 0) return show(goal);
        if (!pending) show(stage + 1);
      };
      let prevStage = -1;
      const show = (st: number) => {
        if (st === stage) return;
        if (st < stage) pending = 0;
        prevStage = stage;
        stage = st;
        const forward = st > prevStage;
        // 1 · Las cartas que vuelven a la mesa aparecen al instante boca abajo en la baraja
        flips.forEach((f, i) => {
          if (want(st, i) === 'dealt' && cur[i] !== 'dealt' && cur[i] !== 'deck') {
            put(f, i, 'deck', null);
            cur[i] = 'deck';
          }
        });
        void track.offsetWidth; // aplica lo anterior antes de animar
        // 2 · Se anima solo lo que cambia
        const leaving = flips.some((_, i) => cur[i] === 'dealt' && want(st, i) !== 'dealt' && want(st, i) !== 'deck');
        flips.forEach((f, i) => {
          let w = want(st, i);
          if (w === cur[i]) return;
          const j = i % m.visible;
          if (w === 'hidden' && cur[i] === 'dealt') w = 'goneR'; // al subir, la tanda se retira hacia la derecha
          if (w === 'dealt') put(f, i, w, forward ? (leaving ? 380 : 60) : 0);
          else if (w === 'goneL' || w === 'goneR') put(f, i, w, j * 70);
          else if (w === 'deck') put(f, i, w, 0);
          else put(f, i, w, null);
          cur[i] = w;
        });
        d.active(batchAt(st));
      };
      // Mientras no haya salido la última carta y terminado su efecto, no se puede bajar más allá de la sección
      let endY = 0;
      let inside = false;
      return {
        warm: (urgent) => preload(flips, urgent),
        measure() {
          m = cardsMetrics(track, view, flips);
          nat = flips.map((f) => f.offsetLeft - flips[0].offsetLeft);
          B = Math.ceil(n / m.visible);
          order();
          d.count(B);
          snapAll();
        },
        run(p, len, top) {
          // Baraja cerrada hasta que la sección está casi entera en pantalla; luego, una carta por cada tramo de scroll
          // (el último tramo dura el doble: da tiempo a ver la última carta antes de seguir bajando).
          const S = steps();
          goal = top > vh * 0.3 ? 0 : Math.min(S - 1, Math.floor(clamp(p) * (S + 1) * 0.9999));
          away = top < -len - vh * 0.8; // la sección ya se fue por arriba
          endY = scrollY + top + len;
          inside = top <= vh * 0.3 && -top <= len + 2;
          advance();
        },
        hold: () => (inside && !(stage === n && !pending) ? endY : null),
        at: (i) => (i * m.visible + 1 + 0.5) / (steps() + 1),
      };
    },

    // Servicios adicionales: al bajar, cada tarjeta pasa por el centro y se queda un momento; la del centro se ilumina con su borde rojo
    spotlight(_pin, sec) {
      const c = carousel(sec);
      if (!c || c.items.length < 2) return null;
      const { root, track } = c;
      const cards = c.items.map((card) => {
        const x = make('div', 'xcard');
        const ring = make('div', 'xring');
        card.replaceWith(x);
        ring.append(card);
        x.append(make('div', 'xglow'), ring, make('div', 'xshade'));
        return x;
      });
      const glows = cards.map((x) => x.querySelector<HTMLElement>('.xglow')!);
      const shades = cards.map((x) => x.querySelector<HTMLElement>('.xshade')!);
      const off = cards.map(() => false);
      const far = cards.map(() => false);
      const XN = cards.length;
      const PAD = 0.25 / XN;
      const d = driver(root);
      d.count(XN);
      let stepX = 0;
      return {
        warm: (urgent) => preload(c.items, urgent),
        measure: () => (stepX = cards[1].offsetLeft - cards[0].offsetLeft),
        at: (i) => PAD + (1 - 2 * PAD) * (i / (XN - 1)),
        run(p) {
          const pos = plateau(clamp((p - PAD) / (1 - 2 * PAD)) * (XN - 1));
          track.style.transform = `translate3d(${(-pos * stepX).toFixed(1)}px, 0, 0)`;
          cards.forEach((el, i) => {
            const dd = i - pos;
            const ad = Math.abs(dd);
            const near = Math.max(0, 1 - ad);
            el.style.transform = `translate3d(0, 0, ${-Math.min(ad, 3) * 90}px) rotateY(${clamp(-dd, -1.5, 1.5) * 18}deg) scale(${1 + near * 0.15})`;
            glows[i].style.opacity = (0.15 + near * 0.85).toFixed(3);
            shades[i].style.opacity = (clamp(ad) * 0.5 + clamp(ad - 1) * 0.2).toFixed(3);
            // Las tarjetas lejanas (en penumbra) no dibujan el resplandor: menos trabajo para la tarjeta gráfica
            const fr = ad > 1.6;
            if (fr !== far[i]) el.classList.toggle('is-far', (far[i] = fr));
            // El brillo que recorre el borde (y el video de fondo, si lo tiene) solo se mueve en la tarjeta del centro
            const o = ad > 0.75;
            if (o !== off[i]) {
              el.classList.toggle('is-off', (off[i] = o));
              el.querySelectorAll('video').forEach((v) => {
                if (o) v.pause();
                else if (v.src) v.play().catch(() => {});
              });
            }
          });
          d.active(Math.round(pos));
        },
      };
    },

    // Las letras del título saltan al aparecer y la siguiente diapositiva se abre en círculo desde el botón
    pop(_pin, sec) {
      const c = carousel(sec);
      if (!c || c.items.length < 2) return null;
      const { root, track, view, items } = c;
      const T = items.length - 1;
      const side = peek(view, items);
      const pieces = items.map((s) => {
        const title = s.querySelector<HTMLElement>('.slide__title');
        if (title) return splitChars(title);
        const logo = s.querySelector<HTMLElement>('.slide__title-img'); // título en imagen: salta entero
        return logo ? [logo] : [];
      });
      const popIn = (els: HTMLElement[], t: number) =>
        els.forEach((ch, j) => {
          const q = clamp((t * (els.length + 5) - j) / 5);
          ch.style.transform = `translateY(${(1 - q) * 0.45}em) scale(${q <= 0 ? 0.3 : backOut(q)})`;
          ch.style.opacity = clamp(q * 3).toFixed(2);
        });
      const d = driver(root);
      d.count(items.length);
      let from: { x: number; y: number; r: number }[] = [];
      return {
        warm: (urgent) => preload(c.items, urgent),
        measure() {
          const b = track.getBoundingClientRect();
          from = items.map((s) => {
            const r = s.querySelector('.btn')?.getBoundingClientRect();
            const x = r ? r.left + r.width / 2 - b.left : b.width / 2;
            const y = r ? r.top + r.height / 2 - b.top : b.height / 2;
            return { x, y, r: Math.hypot(Math.max(x, b.width - x), Math.max(y, b.height - y)) };
          });
        },
        run(p) {
          const u = clamp(p) * T;
          popIn(pieces[0], clamp(u / 0.22));
          let cur = 0;
          for (let j = 1; j <= T; j++) {
            const l = u - (j - 1);
            const k = inOut(clamp((l - 0.32) / 0.38));
            const o = from[j - 1];
            if (o) items[j].style.clipPath = `circle(${(o.r * k).toFixed(1)}px at ${o.x}px ${o.y}px)`;
            items[j].style.visibility = k > 0 ? 'visible' : 'hidden';
            popIn(pieces[j], clamp((l - 0.55) / 0.3));
            if (k > 0.5) cur = j;
          }
          side(cur);
          d.active(cur);
        },
        at: (i) => (i === 0 ? 0 : (i - 1 + 0.9) / T),
      };
    },

    // Galería: cada foto viene hacia ti, se queda grande en pantalla y sigue de largo
    tunnel(_pin, sec) {
      const c = carousel(sec);
      if (!c || !c.items.length) return null;
      const { root, items: frames } = c;
      const M = frames.length;
      const SPAN = M - 1 + 0.45;
      const far = farSet(frames);
      const d = driver(root);
      d.count(M);
      const warm = ahead(frames);
      return {
        at: (i) => clamp((i + 0.2) / SPAN),
        warm: (urgent) => preload(frames, urgent),
        run(p) {
          const U = p * SPAN;
          warm(Math.max(0, Math.floor(U)));
          frames.forEach((el, i) => {
            const u = U - i;
            const off = u < -2.5 || u > 1.05;
            far(i, off);
            if (off) return;
            const side = i % 2 ? 1 : -1;
            let z = 0;
            let x = 0;
            let ry = 0;
            let o = 1;
            if (u < -1) o = 0;
            else if (u < 0) {
              const k = 1 - Math.pow(-u, 3);
              z = lerp(-2600, 0, k);
              ry = side * 12 * (1 - k);
              o = clamp((u + 1) / 0.3);
            } else if (u > 0.45) {
              const k = ease(clamp((u - 0.45) / 0.55));
              z = 620 * k;
              x = side * vw * 0.4 * k;
              ry = side * -18 * k;
              o = clamp(1 - k * 1.5);
            }
            el.style.opacity = o.toFixed(3);
            el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
            el.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${ry}deg)`;
          });
          d.active(clamp(Math.round(U - 0.2), 0, M - 1));
        },
      };
    },
  };

  // Las reseñas entran desde los lados (la sección no se fija)
  const sides = (sec: HTMLElement): Extra | null => {
    const c = carousel(sec);
    if (!c || !c.items.length) return null;
    const { track, view, items } = c;
    let per = 2;
    let entering = false;
    return {
      measure: () => (per = cardsMetrics(track, view, items).visible),
      read: () => ({ r: sec.getBoundingClientRect(), sl: track.scrollLeft }),
      write({ r, sl }: { r: DOMRect; sl: number }) {
        if (r.bottom < 0 || r.top > vh) return;
        const t = inOut(clamp((vh - r.top) / (vh * 0.75)));
        // Mientras entran, el carrusel deja ver lo que sobresale (solo si no se ha movido a mano)
        const enter = t < 0.999 && sl < 2;
        if (enter !== entering) {
          entering = enter;
          track.classList.toggle('is-entering', enter);
          items.forEach((el, i) => {
            el.style.visibility = enter && i >= per ? 'hidden' : '';
            if (!enter) el.style.transform = el.style.opacity = '';
          });
        }
        if (!enter) return;
        items.slice(0, per).forEach((el, i) => {
          const sd = i % 2 ? 1 : -1;
          el.style.transform = `translate3d(${sd * (1 - t) * vw * 0.25}px, ${(1 - t) * 40}px, 0) rotate(${sd * (1 - t) * 8}deg)`;
          el.style.opacity = (0.2 + 0.8 * t).toFixed(3);
        });
      },
    };
  };

  // ---------- Montaje ----------
  const anims: Anim[] = [];
  document.querySelectorAll<HTMLElement>('.pin[data-pin]').forEach((pin) => {
    const mode = pin.dataset.pin as AnimMode;
    const sec = pin.firstElementChild as HTMLElement | null;
    const part = sec && builders[mode]?.(pin, sec);
    if (part) anims.push({ mode, pin, len: 1, ...part });
  });
  const extras = Array.from(document.querySelectorAll<HTMLElement>('section[data-anim="sides"]'))
    .map(sides)
    .filter((x): x is Extra => !!x);

  // El bigote guía: de «Nosotros» a la primera sección de tarjetas que la sigue
  const ab = anims.find((a) => a.mode === 'guide');
  const sv = ab && anims.find((a) => a.mode === 'slide' && ab.pin.compareDocumentPosition(a.pin) & Node.DOCUMENT_POSITION_FOLLOWING);
  const guide = ab && sv ? guideStache(ab, sv) : null;
  const abIdx = ab ? anims.indexOf(ab) : -1;
  const svIdx = sv ? anims.indexOf(sv) : -1;

  function guideStache(ab: Anim, sv: Anim) {
    const abSec = ab.pin.firstElementChild as HTMLElement;
    const sSec = sv.pin.firstElementChild as HTMLElement;
    const stAbout = abSec.querySelector<HTMLElement>('.about__decor');
    const frameEl = abSec.querySelector<HTMLElement>('.about__frame');
    const [stD1, stD2] = Array.from(sSec.querySelectorAll<HTMLElement>(':scope > .decor-canvas > .decor'));
    if (!stAbout || !frameEl || !stD1 || !stD2) return null;
    // En reposo siempre se ve el bigote real en su sitio exacto; solo durante el vuelo se usa una copia.
    // La copia tiene tamaño fijo y se mueve/escala con transform (no se vuelve a pintar). Lleva una sola imagen
    // durante todo el vuelo; solo al aterrizar se funde con la del destino.
    const flyer = (cls: string) => {
      const el = make('div', cls);
      el.setAttribute('aria-hidden', 'true');
      el.append(decorative(), decorative());
      return el;
    };
    const g = flyer('anim-guide');
    const tr = flyer('anim-traveler');
    document.body.append(g);
    sSec.prepend(tr);
    const [gA, gB] = kids(g) as HTMLImageElement[];
    const [tA, tB] = kids(tr) as HTMLImageElement[];
    // a: bigote de «Nosotros» (relativo a la sección)
    let K: { a: Box } | null = null;
    let idle = '';
    const show = (el: HTMLElement, on: boolean) => {
      const v = on ? '' : 'hidden';
      if (el.style.visibility !== v) el.style.visibility = v;
    };
    const fly = (el: HTMLElement, on: boolean) => el.classList.toggle('on', on);
    const size = (el: HTMLElement, b: Box) => {
      el.style.width = `${b.w}px`;
      el.style.height = `${b.h}px`;
    };
    // El destino se coloca dentro de la caja de la copia para que, al llegar a escala, coincida al píxel
    const fit = (img: HTMLElement, base: Box, dest: Box) => {
      const k = base.w / dest.w;
      img.style.inset = 'auto';
      img.style.left = '0';
      img.style.width = `${base.w}px`;
      img.style.height = `${dest.h * k}px`;
      img.style.top = `${(base.h - dest.h * k) / 2}px`;
    };
    // c: centro (x, y) y ancho final w de la copia, cuya caja mide base
    const put = (el: HTMLElement, base: Box, x: number, y: number, w: number, rz: number) => {
      const k = w / base.w;
      el.style.transform = `translate3d(${(x - base.w / 2).toFixed(1)}px, ${(y - base.h / 2).toFixed(1)}px, 0) scale(${k.toFixed(4)}) rotate(${rz.toFixed(2)}deg)`;
    };
    const fade = (A: HTMLElement, B: HTMLElement, t: number) => {
      A.style.opacity = (1 - t).toFixed(3);
      B.style.opacity = t.toFixed(3);
    };
    return {
      measure() {
        gA.src = srcOf(stAbout);
        gB.src = tA.src = srcOf(stD1);
        tB.src = srcOf(stD2);
        stAbout.style.transform = '';
        const a = box(stAbout);
        const sg = box(abSec);
        const d1 = box(stD1);
        const d2 = box(stD2);
        K = { a: { x: a.x - sg.x, y: a.y - sg.y, w: a.w, h: a.h } };
        size(g, K.a);
        fit(gB, K.a, d1);
        size(tr, d1);
        fit(tB, d1, d2);
        idle = '';
      },
      update(ar: DOMRect, sr: DOMRect) {
        if (!K) return;
        // Lejos de las dos secciones: cada bigote en su sitio (arriba, el de «Nosotros»; abajo, el último de Servicios)
        if (ar.top > vh * 1.5 || sr.bottom < -vh * 0.5) {
          const side = ar.top > 0 ? 'above' : 'below';
          if (side === idle) return;
          idle = side;
          stAbout.style.transform = '';
          show(stAbout, side === 'above');
          show(stD1, false);
          show(stD2, side === 'below');
          fly(g, false);
          fly(tr, false);
          return;
        }
        idle = '';
        // Primero todas las lecturas (sin escrituras entre medias)
        const sg = box(abSec);
        const d1 = box(stD1);
        const st = box(sSec);
        const d2 = box(stD2);
        const P = clamp(-ar.top / ab.len); // progreso con «Nosotros» fija
        const k = clamp((vh - sr.top) / vh); // Servicios entrando en pantalla
        const q = clamp((clamp(-sr.top / sv.len) - 0.04) / 0.9);
        const { a } = K;
        // Esquina de espera: abajo a la izquierda, justo encima de donde aterrizará en Servicios
        const wx = d1.x + d1.w / 2;
        const wy = vh * 0.82;

        // 1 · Desde su sitio va directo a la esquina, por DETRÁS del marco trofeo + foto, mientras se encoge
        //     al tamaño del de Servicios (un solo movimiento continuo durante todo el tramo de «Nosotros»)
        const e1 = smooth(clamp((P - 0.04) / 0.94));
        const sc = lerp(1, d1.w / a.w, e1);
        const dx = (wx - (sg.x + a.x + a.w / 2)) * e1;
        const dy = (wy - (sg.y + a.y + a.h / 2)) * e1;
        stAbout.style.transform = e1 > 0 ? `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(4)}) rotate(${(Math.sin(e1 * Math.PI) * -8).toFixed(2)}deg)` : '';
        show(stAbout, P < 1);

        // 2 · Entra Servicios: desde la esquina baja con la página hasta su sitio y allí se funde con el bigote real
        const flying = P >= 1 && k < 1;
        fly(g, flying);
        if (flying) {
          const t = smooth(k);
          put(g, a, wx, lerp(wy - k * vh, d1.y + d1.h / 2, t), d1.w, 0);
          fade(gA, gB, clamp((k - 0.75) / 0.25));
        }

        // 4 · Con Servicios fija, baja por DETRÁS de las tarjetas hasta el bigote de abajo
        show(stD1, k >= 1 && q <= 0);
        const fly2 = q > 0 && q < 1;
        fly(tr, fly2);
        if (fly2) {
          const e = smooth(q);
          const x1 = d1.x - st.x + d1.w / 2;
          const y1 = d1.y - st.y + d1.h / 2;
          const x2 = d2.x - st.x + d2.w / 2;
          const y2 = d2.y - st.y + d2.h / 2;
          put(tr, d1, lerp(x1, x2, e), lerp(y1, y2, e) + Math.sin(e * Math.PI) * vh * 0.05, lerp(d1.w, d2.w, e), Math.sin(e * Math.PI) * -10);
          fade(tA, tB, clamp((e - 0.8) / 0.2));
        }
        show(stD2, q >= 1);
      },
    };
  }

  // ---------- Bucle: primero se lee todo y después se escribe; solo se calcula lo que está en pantalla ----------
  let ringLive = false;
  function frame() {
    ticking = false;
    // Si se arrastró la barra de scroll más allá del bloqueo, se vuelve al final de la sección
    const lock = limit();
    if (lock != null && scrollY > lock + 1) scrollTo({ top: lock, behavior: 'instant' });
    const rects = anims.map((a) => a.pin.getBoundingClientRect());
    const reads = extras.map((x) => x.read());
    if (guide) guide.update(rects[abIdx], rects[svIdx]);
    ringLive = false;
    anims.forEach((a, i) => {
      const r = rects[i];
      a.each?.(r, a.len);
      // A 4 pantallas: se adelantan sus fotos. A pantalla y media: se preparan sus capas (lejos se liberan)
      if (!a.warmed && r.top < vh * 4) {
        a.warmed = true;
        a.warm?.();
      }
      const near = r.top < vh * 2.5 && r.bottom > -vh;
      if (near !== a.near) {
        a.near = near;
        a.pin.classList.toggle('near', near);
      }
      const on = r.bottom > -50 && r.top < vh + 50;
      if (on !== a.live) {
        a.live = on;
        a.pin.classList.toggle('live', on);
        if (on) a.warm?.(true); // al entrar en pantalla, sus fotos pendientes van primero
      }
      if (!on) return;
      if (a.mode === 'ring') ringLive = true;
      a.run(clamp(-r.top / a.len), a.len, r.top);
    });
    extras.forEach((x, i) => x.write(reads[i] as never));
  }

  const measure = () => {
    vh = innerHeight;
    vw = html.clientWidth;
    anims.forEach((a) => (a.len = Math.max(1, a.pin.offsetHeight - vh)));
    anims.forEach((a) => a.measure?.());
    extras.forEach((x) => x.measure?.());
    guide?.measure();
  };
  const init = () => {
    measure();
    frame();
  };

  addEventListener('scroll', request, { passive: true });

  // Secciones que no dejan bajar hasta terminar (Efectos especiales: hasta que sale el efecto de la última carta)
  const limit = () => {
    for (const a of anims) {
      const y = a.hold?.();
      if (y != null) return y;
    }
    return null;
  };
  addEventListener(
    'wheel',
    (e) => {
      const y = limit();
      if (y == null || e.deltaY <= 0 || scrollY + e.deltaY <= y) return;
      e.preventDefault();
      if (scrollY < y) scrollTo({ top: y, behavior: 'instant' });
    },
    { passive: false },
  );
  addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key) || (e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
    const y = limit();
    if (y == null || scrollY < y - 2) return;
    e.preventDefault();
  });
  let resizing = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizing);
    resizing = requestAnimationFrame(init);
  });
  addEventListener(
    'pointermove',
    (e) => {
      mouse.x = e.clientX / innerWidth - 0.5;
      mouse.y = e.clientY / innerHeight - 0.5;
      if (ringLive) request();
    },
    { passive: true },
  );

  // Puntos y flechas de un carrusel dirigido: llevan el scroll hasta ese elemento
  document.addEventListener('driven:go', (e) => {
    const a = anims.find((x) => x.pin.contains(e.target as Node));
    if (!a?.at) return;
    const i = (e as CustomEvent<{ index: number }>).detail.index;
    scrollTo({ top: a.pin.getBoundingClientRect().top + scrollY + a.at(i) * a.len, behavior: 'smooth' });
  });

  // Enlaces del menú a una sección fija: al principio de su tramo (no a donde esté pegada en ese momento)
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!link || e.defaultPrevented || link.hash.length < 2) return;
    const pin = document.getElementById(decodeURIComponent(link.hash.slice(1)))?.closest<HTMLElement>('.pin');
    if (!pin) return;
    e.preventDefault();
    scrollTo({ top: pin.getBoundingClientRect().top + scrollY, behavior: 'smooth' });
    history.pushState(null, '', link.hash);
  });

  init();
  document.fonts?.ready.then(init);
  addEventListener('load', init);
}

/** Separa el título en letras (para que salten una a una). El texto sigue disponible entero para lectores de pantalla. */
function splitChars(el: HTMLElement) {
  const text = el.textContent ?? '';
  el.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());
  el.textContent = '';
  const chars: HTMLElement[] = [];
  // Cada palabra en un bloque que no se parte; los espacios y saltos de línea se conservan tal cual
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      el.append(part);
      continue;
    }
    const word = make('span', 'anim-word');
    word.setAttribute('aria-hidden', 'true');
    for (const ch of part) {
      const s = make('span', 'anim-ch');
      s.textContent = ch;
      word.append(s);
      chars.push(s);
    }
    el.append(word);
  }
  return chars;
}
