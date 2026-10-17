#!/usr/bin/env node
/**
 * Revisa los datos de todos los sitios en src/sites/ antes de construir.
 *   npm run validate
 *
 * ERRORES (detienen el build):
 *   - Una diapositiva compartida con assetsFrom usa otro fondo o personaje.
 *   - Falta un archivo (site.json, theme.json, i18n/<idioma>.json).
 *   - Los idiomas de un sitio no tienen exactamente las mismas claves.
 *   - Una sección, tarjeta o diapositiva de site.json no tiene su texto.
 *   - Dos sitios de tipo landing no tienen los mismos tokens de tema.
 * AVISOS (no detienen el build):
 *   - Imágenes que todavía no están en src/sites/<sitio>/img/.
 *   - Números de WhatsApp o redes sociales sin configurar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitesDir = path.join(root, 'src', 'sites');
const languages = readJson(path.join(root, 'src', 'config', 'languages.json'));

const errors = [];
const warnings = [];
const err = (site, msg) => errors.push(`[${site}] ${msg}`);
const warn = (site, msg) => warnings.push(`[${site}] ${msg}`);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw new Error(`JSON inválido en ${path.relative(root, file)}: ${e.message}`);
  }
}

/** Lista de rutas de claves: { a: { b: 1 } } → ["a.b"] */
function keyPaths(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function requireText(site, lang, t, dotted) {
  const value = get(t, dotted);
  if (typeof value !== 'string' || !value.trim()) err(site, `${lang}.json: falta el texto "${dotted}"`);
}

const assetsFrom = (site) => readJson(path.join(sitesDir, site, 'site.json'))?.assetsFrom;
const imageExists = (site, file) =>
  fs.existsSync(path.join(sitesDir, site, 'img', file)) || (assetsFrom(site) ? imageExists(assetsFrom(site), file) : false);
const missingVideos = new Map();
function checkVideo(site, file) {
  const has = (s) => fs.existsSync(path.join(sitesDir, s, 'video', file)) || (assetsFrom(s) ? has(assetsFrom(s)) : false);
  if (!file || has(site)) return;
  if (!missingVideos.has(site)) missingVideos.set(site, []);
  missingVideos.get(site).push(file);
}
const missingImages = new Map();
function checkImage(site, file, optional = false) {
  if (!file || imageExists(site, file)) return;
  if (!missingImages.has(site)) missingImages.set(site, []);
  missingImages.get(site).push(optional ? `${file} (opcional)` : file);
}

const sites = fs
  .readdirSync(sitesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const landingThemes = [];

for (const site of sites) {
  const dir = path.join(sitesDir, site);
  const config = readJson(path.join(dir, 'site.json'));
  const theme = readJson(path.join(dir, 'theme.json'));
  if (!config) { err(site, 'falta site.json'); continue; }
  if (!theme) err(site, 'falta theme.json');

  const texts = {};
  for (const lang of languages.available) {
    const t = readJson(path.join(dir, 'i18n', `${lang}.json`));
    if (!t) err(site, `falta i18n/${lang}.json`);
    else texts[lang] = t;
  }

  // Mismas claves en todos los idiomas
  const [baseLang, ...otherLangs] = Object.keys(texts);
  if (baseLang) {
    const baseKeys = new Set(keyPaths(texts[baseLang]));
    for (const lang of otherLangs) {
      const keys = new Set(keyPaths(texts[lang]));
      for (const k of baseKeys) if (!keys.has(k)) err(site, `${lang}.json: falta "${k}" (existe en ${baseLang}.json)`);
      for (const k of keys) if (!baseKeys.has(k)) err(site, `${lang}.json: sobra "${k}" (no existe en ${baseLang}.json)`);
    }
  }

  for (const [lang, t] of Object.entries(texts)) {
    requireText(site, lang, t, 'meta.title');
    requireText(site, lang, t, 'meta.description');
  }

  if (config.kind === 'portal') {
    checkImage(site, config.logo);
    checkImage(site, config.background, true);
    for (const c of config.countries ?? []) {
      if (!sites.includes(c.site)) err(site, `countries: el sitio "${c.site}" no existe en src/sites/`);
      checkImage(site, c.flag);
      for (const [lang, t] of Object.entries(texts)) requireText(site, lang, t, `countries.${c.site}`);
    }
    for (const [lang, t] of Object.entries(texts)) {
      requireText(site, lang, t, 'title');
      requireText(site, lang, t, 'subtitle');
    }
    continue;
  }

  if (config.kind !== 'landing') { err(site, `site.json: "kind" debe ser "landing" o "portal"`); continue; }
  // fontsUrl es opcional (solo si la fuente viene de Google Fonts)
  if (theme) landingThemes.push({ site, keys: new Set(keyPaths(theme).filter((k) => k !== "fontsUrl")) });

  checkImage(site, config.logo);
  if (!config.contact?.whatsapp || /^\d+0{6,}$/.test(config.contact.whatsapp)) {
    warn(site, 'site.json: contact.whatsapp no está configurado (pon el número real con código de país)');
  }
  for (const [network, url] of Object.entries(config.social ?? {})) {
    if (/^https?:\/\/(www\.)?[a-z]+\.com\/?$/.test(url)) warn(site, `site.json: social.${network} apunta a la portada genérica (${url})`);
  }

  const sharedConfig = config.assetsFrom ? readJson(path.join(sitesDir, config.assetsFrom, 'site.json')) : undefined;
  const ids = new Set();
  for (const s of config.sections ?? []) {
    if (ids.has(s.id)) err(site, `site.json: id de sección repetido "${s.id}"`);
    ids.add(s.id);
    if (s.background && theme && !theme.gradient?.[s.background]) err(site, `sección "${s.id}": no existe gradient.${s.background} en theme.json`);
    for (const d of s.decor ?? []) checkImage(site, d.image, true);

    for (const [lang, t] of Object.entries(texts)) {
      const base = `sections.${s.id}`;
      if (!get(t, base)) { err(site, `${lang}.json: faltan los textos de la sección "${s.id}"`); continue; }
      switch (s.type) {
        case 'hero':
          ['title', 'tagline', 'cta'].forEach((k) => requireText(site, lang, t, `${base}.${k}`));
          break;
        case 'about':
          ['title', 'text', 'awardTitle', 'awardSubtitle', 'awardAlt', 'teamAlt'].forEach((k) => requireText(site, lang, t, `${base}.${k}`));
          break;
        case 'cards':
          requireText(site, lang, t, `${base}.title`);
          for (const item of s.items) requireText(site, lang, t, `${base}.items.${item.id}.title`);
          break;
        case 'showcase':
          requireText(site, lang, t, `${base}.title`);
          for (const slide of s.slides) requireText(site, lang, t, `${base}.slides.${slide.id}.title`);
          break;
        case 'gallery':
          requireText(site, lang, t, `${base}.title`);
          for (const item of s.items) requireText(site, lang, t, `${base}.items.${item.id}.alt`);
          break;
        case 'testimonials':
          requireText(site, lang, t, `${base}.title`);
          for (const item of s.items) {
            const keys = item.kind === 'review' ? ['name', 'text'] : ['alt'];
            keys.forEach((k) => requireText(site, lang, t, `${base}.items.${item.id}.${k}`));
          }
          break;
        case 'contact':
          ['title', 'intro', 'submit'].forEach((k) => requireText(site, lang, t, `${base}.${k}`));
          for (const f of s.fields) requireText(site, lang, t, `${base}.fields.${f.id}.label`);
          break;
        default:
          err(site, `sección "${s.id}": tipo desconocido "${s.type}"`);
      }
    }

    // Imágenes de la sección
    checkImage(site, s.image);
    checkVideo(site, s.video);
    checkVideo(site, s.videoMobile);
    checkImage(site, s.awardImage);
    checkImage(site, s.teamImage);
    for (const item of s.items ?? []) {
      checkImage(site, item.image);
      checkImage(site, item.avatar, true);
      checkVideo(site, item.video);
    }
    for (const slide of s.slides ?? []) {
      checkImage(site, slide.image);
      checkImage(site, slide.titleImage);
      checkImage(site, slide.pop?.image);
      // Mismo servicio en la misma sección: comparte fondo y personaje con el sitio de origen.
      const sharedSlide = sharedConfig?.sections?.find((section) => section.type === 'showcase' && section.id === s.id)
        ?.slides.find((item) => item.id === slide.id);
      if (sharedSlide && (slide.image !== sharedSlide.image || slide.pop?.image !== sharedSlide.pop?.image)) {
        err(site, `${s.id}/${slide.id}: el fondo y la imagen superpuesta deben coincidir con ${config.assetsFrom}`);
      }
    }
  }

  for (const id of config.nav ?? []) {
    if (!ids.has(id)) err(site, `nav: la sección "${id}" no existe`);
    for (const [lang, t] of Object.entries(texts)) requireText(site, lang, t, `nav.${id}`);
  }
}

// Todas las landings deben tener los mismos tokens de tema (mismo diseño, distinto aspecto)
const [refTheme, ...otherThemes] = landingThemes;
for (const other of otherThemes) {
  for (const k of refTheme.keys) if (!other.keys.has(k)) err(other.site, `theme.json: falta "${k}" (existe en ${refTheme.site})`);
  for (const k of other.keys) if (!refTheme.keys.has(k)) err(other.site, `theme.json: sobra "${k}" (no existe en ${refTheme.site})`);
}

for (const [site, files] of missingImages) {
  warn(site, `faltan ${files.length} imágenes en src/sites/${site}/img/:\n      ${files.join('\n      ')}`);
}

for (const [site, files] of missingVideos) {
  warn(site, `faltan ${files.length} videos en src/sites/${site}/video/ (se mostrará la foto):\n      ${files.join('\n      ')}`);
}

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} aviso(s):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
}
if (errors.length) {
  console.error(`\n✖  ${errors.length} error(es):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`\n✔  Contenido válido: ${sites.length} sitio(s) × ${languages.available.length} idioma(s).`);
