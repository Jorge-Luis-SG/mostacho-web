/**
 * Tipos de los archivos de cada sitio (src/sites/<sitio>/).
 *
 * - site.json   → estructura: secciones, orden, imágenes, enlaces. SIN textos visibles.
 * - theme.json  → aspecto visual (design tokens → variables CSS).
 * - i18n/*.json → TODOS los textos que ve el cliente, uno por idioma.
 */

export type Network = 'youtube' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

/** Imagen decorativa (p. ej. bigotes 3D). Posición y ancho en px del diseño a 1920, relativos a la sección. */
export interface Decor {
  image: string;
  x: number;
  y: number;
  w: number;
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
}

export interface HeroSection extends SectionBase {
  type: 'hero';
  image: string;
  /** Video de fondo opcional (src/sites/<sitio>/video/). La imagen hace de póster. */
  video?: string;
  scrollTo?: string;
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
  /** Video de fondo opcional; la imagen hace de póster. */
  video?: string;
  /** Si se indica, el botón lleva a ese ancla/URL en vez de a WhatsApp. */
  href?: string;
}

export interface CardsSection extends SectionBase {
  type: 'cards';
  items: CardItem[];
  showText?: boolean;
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
}

export interface ShowcaseSection extends SectionBase {
  type: 'showcase';
  slides: ShowcaseSlide[];
}

export interface GallerySection extends SectionBase {
  type: 'gallery';
  items: { id: string; image: string }[];
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
  social: Partial<Record<Network, string>>;
  socialOrder: Network[];
  countries: { site: string; flag: string }[];
}

export type SiteConfig = LandingConfig | PortalConfig;

export type Theme = { fontsUrl?: string } & Record<string, Record<string, string> | string | undefined>;

// Los textos son libres: su forma la define cada sitio y la valida scripts/validate-content.mjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Texts = Record<string, any>;
