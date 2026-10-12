import { fill, langLinks } from './i18n';
import { whatsappLink } from './links';
import { routeOf, type LoadedSite } from './sites';
import type { LandingConfig, Texts } from './types';

/** Todo lo que necesita una sección para pintarse, en un solo objeto. */
export interface LandingContext {
  site: string;
  lang: string;
  config: LandingConfig;
  t: Texts;
  ui: Texts;
  langLinks: ReturnType<typeof langLinks>;
  /** Enlace de WhatsApp con el mensaje por defecto */
  whatsapp: string;
  /** Enlace de WhatsApp preguntando por un servicio concreto */
  whatsappFor: (service: string) => string;
}

export function buildLandingContext(loaded: LoadedSite, lang: string): LandingContext {
  const config = loaded.config as LandingConfig;
  const { t } = loaded;
  return {
    site: loaded.key,
    lang,
    config,
    t,
    ui: t.ui,
    langLinks: langLinks(lang, routeOf(loaded.key)),
    whatsapp: whatsappLink(config.contact.whatsapp, t.ui.whatsappDefault),
    whatsappFor: (service: string) =>
      whatsappLink(config.contact.whatsapp, fill(t.ui.whatsappService, { service: service.replace(/\s*\n\s*/g, ' ') })),
  };
}
