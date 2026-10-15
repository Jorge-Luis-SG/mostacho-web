/**
 * Tipos de los archivos de cada sitio (src/sites/<sitio>/).
 *
 * - site.json   → estructura: secciones, orden, imágenes, enlaces. SIN textos visibles.
 * - theme.json  → aspecto visual (design tokens → variables CSS).
 * - i18n/*.json → TODOS los textos que ve el cliente, uno por idioma.
 */

import type { AnimMode } from './anim';

export type Network = 'youtube' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

/** Imagen decorativa (p. ej. bigotes 3D). Posición y ancho en px del diseño a 1920, relativos a la sección. */
export interface Decor {
  image: string;
  x: number;
  y: number;
  w: number;
  /** Bigote que cae con dos rebotes al pasar el cursor (como el de «Nosotros»). */
  hover?: boolean;
}

export interface SectionBase {
  id: string;
  type: string;
  /** Nombre de un degradado de theme.json → gradient.<nombre> */
  background?: string;
  titleStyle?: 'plain' | 'pill';
  /** Tamaño del título de la sección (lg = un poco más grande). */
  titleSize?: 'md' | 'lg';
  decor?: Decor[];
  /** Espacio arriba/abajo en px del diseño a 1920 (se escala con la pantalla). */
  space?: { top?: number; bottom?: number; inner?: number };
  /** Animación con el scroll (solo escritorio). Ver src/lib/anim.ts */
  anim?: AnimMode;
}

export interface HeroSection extends SectionBase {
  type: 'hero';
  image: string;
  /** Video de fondo opcional (src/sites/<sitio>/video/). La imagen hace de póster. */
  video?: string;
  /** Versión ligera del video para móviles y tablets en vertical (opcional). */
  videoMobile?: string;
  scrollTo?: string;
  /** Silueta para la animación "mask" (normalmente el bigote). */
  animImage?: string;
}

export interface AboutSection extends SectionBase {
  type: 'about';
  awardImage: string;
  teamImage: string;
}

export interface CardItem {
  id: string;
  image: string;
  /** Tamaño del título en px del diseño a 1920 (opcional). */
  titleSize?: number;
  /** Video opcional: con la imagen como miniatura, se reproduce (con sonido) al pasar el ratón. */
  video?: string;
  /** Encuadre de la foto en la parte visible de la tarjeta (CSS object-position), p. ej. "50% 30%". */
  imagePos?: string;
  /** Si se indica, el botón lleva a ese ancla/URL en vez de a WhatsApp. */
  href?: string;
  /** Efecto a pantalla completa al aparecer la tarjeta (animación "deal"): smoke | fog | fireworks | confetti | fog-sparks */
  fx?: 'smoke' | 'fog' | 'fireworks' | 'confetti' | 'fog-sparks';
}

export interface CardsSection extends SectionBase {
  type: 'cards';
  items: CardItem[];
  showText?: boolean;
  /** Carrusel sin fin: tras la última página, la flecha vuelve a la primera (y al revés). */
  loop?: boolean;
}

export interface ShowcaseSlide {
  id: string;
  image: string;
  /** Color del degradado lateral de la diapositiva. */
  accent?: string;
  /** Color opcional de un resplandor sobre el degradado (p. ej. dorado). */
  glow?: string;
  /** Posición del resplandor dentro de la diapositiva, p. ej. "30% 20%". */
  glowAt?: string;
  /** Imagen opcional para el título (por ejemplo, un logo). */
  titleImage?: string;
  /** Personaje recortado (PNG transparente) que entra por la derecha al pasar el ratón y sobresale por arriba. */
  pop?: ShowcasePop;
  /** Sin foto de fondo: en reposo se ve el mismo personaje dentro de la diapositiva (al pasar el ratón sale por arriba). */
  inside?: boolean;
  /** Encuadre vertical de la foto (CSS object-position, p. ej. "0% 0%" = pegada arriba, para que se vean las caras). */
  imagePos?: string;
  /** Fondo propio de la diapositiva (CSS), p. ej. una luz degradada cuando no hay foto. */
  bg?: string;
  /** Foto en una caja a la derecha (sin ocupar todo el ancho): ancho máximo en % de la diapositiva. Llena la caja
   *  (cover), centrada en altura (o en imagePos). El resto de la diapositiva muestra el fondo (bg). */
  imageBox?: { maxWidth: number };
}

/** Personaje de una diapositiva. Medidas en % de la diapositiva (ancho sin la franja desenfocada de la derecha). */
export interface ShowcasePop {
  image: string;
  /** Borde izquierdo del personaje (% del ancho). */
  left?: number;
  /** Ancho del personaje (% del ancho); el alto sale de la proporción de la imagen. Lo que pase del borde de abajo se recorta. */
  width?: number;
  /** Borde de arriba (% del alto); negativo = sobresale por encima de la diapositiva. */
  top?: number;
  /** Color del resplandor suave que se enciende detrás del personaje. */
  glow?: string;
  /** Posición del centro del resplandor en la diapositiva entera, p. ej. "80% 45%". Va por encima del degradado lateral. */
  glowAt?: string;
  /** Tamaño del resplandor (radios horizontal y vertical), p. ej. "40% 85%". */
  glowSize?: string;
  /** Capa oscura sobre la foto mientras se ve el personaje (0 a 1). */
  shade?: number;
  /** Color que tiñe la foto mientras se ve el personaje (con transparencia, p. ej. "rgba(150, 40, 255, 0.4)"). */
  tint?: string;
  /** Si se indica, el tinte pasa de «tint» (izquierda) a este color (derecha). */
  tintRight?: string;
}

export interface ShowcaseSection extends SectionBase {
  type: 'showcase';
  slides: ShowcaseSlide[];
  /** Carrusel sin fin: tras la última diapositiva, la flecha vuelve a la primera. */
  loop?: boolean;
  /** Px que se agrandan los personajes de esta sección (sobre su tamaño medido en el diseño). */
  popGrow?: number;
}

export interface GallerySection extends SectionBase {
  type: 'gallery';
  /** pos: encuadre de la foto en su tarjeta (CSS object-position), si el general no centra bien a las personas. */
  items: { id: string; image: string; pos?: string }[];
}

export type TestimonialItem =
  | { id: string; kind: 'review'; avatar?: string; rating?: number; platform?: 'google' | 'instagram' }
  | { id: string; kind: 'image'; image: string };

export interface TestimonialsSection extends SectionBase {
  type: 'testimonials';
  items: TestimonialItem[];
}

export interface ContactField {
  id: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'textarea';
  required?: boolean;
  autocomplete?: string;
}

export interface ContactSection extends SectionBase {
  type: 'contact';
  fields: ContactField[];
  social: Network[];
}

export type Section =
  | HeroSection
  | AboutSection
  | CardsSection
  | ShowcaseSection
  | GallerySection
  | TestimonialsSection
  | ContactSection;

export interface LandingConfig {
  kind: 'landing';
  /** Sitio del que se toman las imágenes/videos que falten en este (p. ej. "ecuador"). */
  assetsFrom?: string;
  route?: string;
  logo: string;
  contact: { whatsapp: string; email?: string };
  /** Icono del botón Contactar de la cabecera (img/). Por defecto icon-whatsapp-black.png */
  ctaIcon?: string;
  social: Partial<Record<Network, string>>;
  /** Ids de secciones que aparecen en el menú, en orden. */
  nav: string[];
  headerSocial: Network[];
  footerSocial: Network[];
  sections: Section[];
}

export interface PortalConfig {
  kind: 'portal';
  assetsFrom?: string;
  route?: string;
  logo: string;
  background: string;
  /** Video de fondo en bucle (src/sites/portal/video/); la imagen de fondo hace de póster. */
  video?: string;
  /** Versión ligera del video para móviles y tablets en vertical (opcional). */
  videoMobile?: string;
  social: Partial<Record<Network, string>>;
  socialOrder: Network[];
  countries: { site: string; flag: string }[];
}

export type SiteConfig = LandingConfig | PortalConfig;

export type Theme = { fontsUrl?: string } & Record<string, Record<string, string> | string | undefined>;

// Los textos son libres: su forma la define cada sitio y la valida scripts/validate-content.mjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Texts = Record<string, any>;
