#!/usr/bin/env node
/**
 * Importa los assets originales de capturas/assets/ a src/sites/ecuador/.
 *   npm run assets
 *
 * - Fotos: convierte HEIC/HEIF a JPG y reduce las enormes a un máximo de 2560 px (sin recortar).
 *   Astro las vuelve a optimizar (AVIF/WebP y varios tamaños) en cada build.
 * - Videos: los pasa a MP4 H.264 listos para la web (sin audio, salvo los que se escuchan al pasar el ratón)
 *   y, si se indica, saca un fotograma como imagen de carga.
 * - Tarjetas: genera la versión desenfocada de cada foto (img/blur/) para el fondo del texto.
 * - Fuentes: convierte Neue Montreal (.otf) a .woff2 en public/fonts/.
 *
 * Para cambiar una foto, edita la tabla de abajo (destino ← origen) y vuelve a ejecutar el script.
 * Un archivo que ya existe y es más nuevo que su origen no se vuelve a procesar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import ffmpegPath from 'ffmpeg-static';
import wawoff2 from 'wawoff2';

const SRC = 'capturas/assets/';
const IMG = 'src/sites/ecuador/img/';
const VID = 'src/sites/ecuador/video/';
const MAX = 2560; // lo más grande que se muestra una foto (diapositivas a pantalla completa, retina)
const FORCE = process.argv.includes('--force'); // npm run assets -- --force  → reprocesa todo

// ---------------------------------------------------------------------------
// Fotos: destino (en src/sites/ecuador/img/) ← origen (en capturas/assets/)
// ---------------------------------------------------------------------------
const images = {
  'nosotros-equipo.jpg': 'QUIENES SOMOS/EQUIPO.jpg',

  'servicio-recibe.jpg': 'SERVICIOS/RECIBIMIENTO DE INVITADOS 2.jpg',
  'servicio-efectos.jpg': 'SERVICIOS/EFECTOS ESPECIALES.jpg',
  'servicio-infantiles.jpg': 'SERVICIOS/MOSTACHO INFANTILES 6.jpg',
  'servicio-adicionales.jpg': 'SERVICIOS/SERVICIO ADICIONAL DJ Y DISCO MOVIL.PNG',

  'hora-loca-robots-led.jpg': '../show-robots-led-slider.png',
  'hora-loca-show-mirror.jpg': 'HORA LOCA/MIRROR(4).jpg',
  'hora-loca-funky-animals.jpg': 'HORA LOCA/FUNKY ANIMALS(2).png',
  'hora-loca-arlequines.jpg': 'HORA LOCA/ARLEQUINES(2).jpg',
  'hora-loca-monster-glitter.jpg': 'HORA LOCA/GLITTER AND MIRROR.jpg',
  'hora-loca-galacticos.jpg': 'HORA LOCA/GALACTICOS.jpg',
  'hora-loca-white-wings.jpg': 'HORA LOCA/WHITE WINGS(1).jpg',
  'hora-loca-robots-mirror.jpg': 'HORA LOCA/MIRROR(2).jpg', // robots con traje de espejo y LED (la de ROBOTS/ mide 720 px)
  'hora-loca-alicia.jpg': 'HORA LOCA/ALICIA EN EL PAÍS DE LAS MARAVILLAS.jpg',
  'hora-loca-artistas.jpg': 'HORA LOCA/ARTISTAS(9).jpg',
  'hora-loca-batucada-led.jpg': 'HORA LOCA/BATUCADA LED(1).jpg',
  'hora-loca-charleston.jpg': 'HORA LOCA/CHARLESTON.jpg',
  'hora-loca-folklore.jpg': 'HORA LOCA/FOLCKLORE(2).heif',
  'hora-loca-garotas.jpg': 'HORA LOCA/GAROTAS(1).jpg',
  'hora-loca-futbolista.jpg': 'HORA LOCA/HORA LOCA FUTBOLISTA(1).jpg',
  'hora-loca-casa-de-papel.jpg': 'HORA LOCA/LA CASA DE PAPEL.jpg',
  'hora-loca-la-mascara.jpg': 'HORA LOCA/LA MASCARA.jpg',
  'hora-loca-neon.jpg': 'HORA LOCA/NEÓN.png',
  'hora-loca-rabbit-girls.jpg': 'HORA LOCA/RABBIT GIRLS(1).jpg',
  'hora-loca-rumberas.jpg': 'HORA LOCA/RUMBERAS(2).JPG',
  // Personajes recortados (PNG transparente) que asoman por la derecha al pasar el ratón por la diapositiva
  'hora-loca-robots-led-pop.png': '../Nueva carpeta/show-robots-led-effect.png',
  'hora-loca-show-mirror-pop.png': '../Nueva carpeta/show-mirror-effect.png',
  'hora-loca-funky-animals-pop.png': '../Nueva carpeta/funky-animals-effect.png',
  'hora-loca-arlequines-pop.png': '../Nueva carpeta/show-alequines-effect.png',
  'hora-loca-monster-glitter-pop.png': '../Nueva carpeta/monster-glitter-effect.png',
  'hora-loca-galacticos-pop.png': '../Nueva carpeta/show-galacticos-effect.png',
  'hora-loca-white-wings-pop.png': '../Nueva carpeta/withe-wings-effects.png',
  'recibe-rosas-doradas-pop.png': '../Nueva carpeta/rosas-glam-effect.png',
  'recibe-rosas-rojas-pop.png': '../Nueva carpeta/rosas-glam-rojas-effect.png',
  'recibe-rosas-blancas-pop.png': '../Nueva carpeta/rosas-glan-blancas-effect.png',
  'recibe-personajes-golden-pop.png': '../Nueva carpeta/personajes-golden-effect.png',
  'recibe-personajes-silver-pop.png': '../Nueva carpeta/personajes-silver-effect.png',
  'recibe-afrodita-pop.png': '../Nueva carpeta/afrodita-effects.png',
  'infantil-kpop-pop.png': '../k-pop-effect.png',
  'infantil-world-tour-pop.png': '../messi-effect.png',

  'recibe-rosas-doradas.jpg': 'RECIBIMIENTO DE INVITADOS/ROSAS GLAM DORADAS.jpg',
  'recibe-rosas-rojas.png': '../rosas-glam-rojas-slider.png', // con transparencia: se funde con el fondo radial
  // Rosas glam blancas: la única que hay mide 158 × 284 px (se verá borrosa; cambiarla en cuanto llegue una más grande)
  'recibe-rosas-blancas.jpg': 'RECIBIMIENTO DE INVITADOS/ROSAS GLAM BLANCAS.png',
  'recibe-personajes-golden.png': '../personajes-golden-slider.png', // con transparencia: se funde con el fondo radial
  'recibe-personajes-silver.png': '../personajes-silver-slider.png', // con transparencia: se funde con el fondo radial
  'recibe-afrodita.png': '../afrodita-slider.png', // con transparencia: se funde con el fondo
  'recibe-arlequines.jpg': 'RECIBIMIENTO DE INVITADOS/ARLQUINES.jpg',
  'recibe-black-and-white.jpg': 'RECIBIMIENTO DE INVITADOS/BLACK AND WHITE.jpg',
  'recibe-combinados.jpg': 'RECIBIMIENTO DE INVITADOS/COMBINADOS(1).jpg',
  'recibe-elementos.jpg': 'RECIBIMIENTO DE INVITADOS/ELEMENTOS.jpg',
  'recibe-isis.jpg': 'RECIBIMIENTO DE INVITADOS/ISIS.jpg',
  'recibe-mimos.jpg': 'RECIBIMIENTO DE INVITADOS/MIMOS.heif',

  'efecto-bazooka.jpg': 'EFECTOS ESPECIALES/BAZOOKA CO2(1).jpg', // novios con bazookas (la de BAZOOKA CO2.jpg es la quinceañera)
  'efecto-fuegos-artificiales.jpg': 'EFECTOS ESPECIALES/FUEGOS ARTIFICIALES.jpg',
  'efecto-confeti.jpg': 'EFECTOS ESPECIALES/CONFETI.jpg',
  'efecto-neblina-pirotecnia.jpg': 'EFECTOS ESPECIALES/NEBLINA BAJA Y PIROTECNIA FRIA.jpg',

  'adicional-glitter-bar.jpg': 'SERVICIOS ADICIONALES/GLITTER BAR MOVIL.PNG',
  'adicional-dj.jpg': 'SERVICIOS ADICIONALES/DJ Y DISCO MOVIL 3.jpg',
  'adicional-maestro-ceremonia.jpg': 'SERVICIOS ADICIONALES/MAESTRO DE CEREMONIA.PNG',
  'adicional-barra-cocteles.jpg': 'SERVICIOS ADICIONALES/BARRA DE COCTELES.jpg',
  'adicional-batucada.jpg': 'SERVICIOS ADICIONALES/BATUCADA.jpg',
  'adicional-montaje-bailes.jpg': 'SERVICIOS ADICIONALES/MONTAJE PARA BAILES DE NOVIOS Y 15 AÑOS.jpg',
  'adicional-pantallas-carpas.jpg': 'SERVICIOS ADICIONALES/PANTALLAS MOBILIARIO CARPAS.jpg',
  'adicional-totems-led.jpg': 'SERVICIOS ADICIONALES/TOTEMS LED.jpg',
  'adicional-zanqueros.jpg': 'SERVICIOS ADICIONALES/ZANQUEROS.JPG', // zanqueros azules (CRISFE)

  'infantil-kpop.jpg': 'SERVICIOS/MOSTACHO INFANTILES 1.jpg',
  'infantil-world-tour.jpg': 'SERVICIOS/MOSTACHO INFANTILES.jpg',
  'infantil-kpop-logo.png': '../k-pop-demon-hunters.png', // logo transparente (está en capturas/, no en assets/)

  // Ventana emergente de Halloween (capturas/POP)
  'promo-fondo.png': '../POP/Enmascarar grupo 1101.png',
  'promo-esqueleto.png': '../POP/Imagen 83.png',
  'promo-espantapajaros.png': '../POP/Imagen 81.png',
  'promo-logo.png': '../POP/Imagen 82.png',
  'promo-texto.png': '../POP/personajes de recibimiento y show performance.png',
  'promo-halloween.png': '../POP/halloween.png',

  // España (capturas/spain): La casa de papel y Robots mirror (fondo + personaje), equipo y Bautizos
  'hora-loca-casa-de-papel-slider.png': '../spain/imagen Casa de Papel.png',
  'hora-loca-casa-de-papel-pop.png': '../spain/Casa de papel.png',
  'hora-loca-robots-mirror-slider.png': '../spain/imagen robot mirror.png',
  'hora-loca-robots-mirror-pop.png': '../spain/Robot Mirror.png',
  'espana-equipo.jpg': '../spain/Imagen equipo.jpg.jpeg',
  'evento-bautizo.jpg': '../spain/bautizo.jpg', // sacada del diseño (Estructura España.xd)

  'testimonio-whatsapp-tatiana.png': 'MOSTACHO EXPERIENCE/IMG_1072.PNG',
};

// Galería: en este orden
const gallery = [
  'GALERIA/eddd10d5-ea5b-4984-af1a-1c7751795469.jpg',
  'GALERIA/IMG_0632.JPG',
  'GALERIA/IMG_0220.HEIC',
  'GALERIA/IMG_0346.JPG',
  'GALERIA/IMG_0647.PNG',
  'GALERIA/IMG_1055.HEIC',
  'GALERIA/IMG_1057.JPG',
  'GALERIA/IMG_1061.JPG',
  'GALERIA/IMG_1063.JPG',
  'GALERIA/IMG_1894.JPG.jpg',
  'GALERIA/IMG_6217.HEIC',
  'GALERIA/IMG_6281 (2).PNG',
  'GALERIA/IMG_6415.HEIC',
  'GALERIA/IMG_9845.JPG.jpeg',
  'GALERIA/RECIBIMIENTO DE INVITADOS 2.jpg',
  'GALERIA/RECIBIMIENTO DE INVITADOS 4.HEIC',
  'GALERIA/SaveClip.App_681252561_18192437176362105_472769167590643787_n.jpg',
  'GALERIA/SaveClip.App_681488590_18192437227362105_5792064684209979491_n.webp',
  'GALERIA/SaveClip.App_682034509_18192437161362105_1860436993938154555_n.jpg',
  'GALERIA/SaveClip.App_682057712_18192437299362105_5417822561794211049_n.jpg',
  'GALERIA/SaveClip.App_683034127_18192437245362105_7403857611088372870_n.jpg',
  'GALERIA/SaveClip.App_683727748_18192437272362105_1308646456249761373_n.jpg',
  'GALERIA/SaveClip.App_683755656_18192437206362105_1554146183881042760_n.jpg',
  'GALERIA/SaveClip.App_683822614_18192437218362105_6606920034233943276_n.jpg',
  'GALERIA/SaveClip.App_684662529_18192437236362105_4367288982942467819_n.jpg',
  'GALERIA/WhatsApp Image 2025-11-06 at 12.33.13 PM (1).jpg',
  'GALERIA/WhatsApp Image 2025-11-06 at 12.33.14 PM.jpg',
];
gallery.forEach((src, i) => (images[`galeria-${i + 1}.jpg`] = src));

// ---------------------------------------------------------------------------
// Videos: destino (en src/sites/ecuador/video/, o en el sitio indicado con site) ← origen.
// El póster va a img/ del mismo sitio con el nombre indicado. audio: conserva el sonido (tarjetas que suenan al pasar el ratón).
// maxrate (kbit/s): tope de calidad para que ninguna escena dispare el peso del archivo.
// ---------------------------------------------------------------------------
const videos = {
  // Fondo del inicio a pantalla completa: a la resolución del original y con calidad alta (se ve grande y se nota)
  'hero.mp4': { src: 'VIDEO HERO/IMG_0600.MOV', width: 1920, crf: 22, fps: 30, maxrate: 6000 },
  // Versión para móviles y tablets en vertical: recorte central 9:16 y más ligera
  'hero-movil.mp4': { src: 'VIDEO HERO/IMG_0600.MOV', width: 720, crf: 26, fps: 30, portrait: true, maxrate: 1800 },
  // Servicios: la foto de cada tarjeta sigue siendo su miniatura; el video (con sonido) sale al pasar el ratón
  'servicio-hora-loca.mp4': { src: '../videos/HORA LOCA.mp4', width: 640, crf: 28, audio: true, maxrate: 900 },
  'servicio-recibe.mp4': { src: '../videos/RECIBE A LOS INVITADOS.mp4', width: 640, crf: 28, fps: 30, audio: true, maxrate: 900 },
  // «RECIBIMIENTO DE INVITADOS 1» en realidad muestra efectos: confeti, CO2 de colores, neblina y pirotecnia fría
  'servicio-efectos.mp4': { src: '../videos/RECIBIMIENTO DE INVITADOS 1.mp4', width: 640, crf: 28, portrait: true, audio: true, maxrate: 900 },
  'servicio-infantiles.mp4': { src: '../videos/INFATILES.mp4', width: 640, crf: 28, portrait: true, audio: true, maxrate: 900 },
  // Portada (elegir país): franjas rojas en bucle
  'principal.mp4': { site: 'portal', src: '../videos/principal.mp4', width: 1920, crf: 28, poster: 'fondo.jpg' },
  'principal-movil.mp4': { site: 'portal', src: '../videos/principal.mp4', width: 720, crf: 30, portrait: true },
  'promo-fondo.mp4': { src: '../POP/background_hallowen.mp4', width: 1280, crf: 30, maxrate: 1500 },
  'promo-fondo-movil.mp4': { src: '../POP/background_hallowen.mp4', width: 640, crf: 31, portrait: true, maxrate: 700 },
  'adicional-glitter-bar.mp4': { src: '../glitter-bar-movil.mp4', width: 480, crf: 28 },
  'adicional-cabina-espejada.mp4': { src: 'SERVICIOS ADICIONALES/CABINA ESPEJADA.mp4', width: 720, crf: 26, poster: 'adicional-cabina-espejada.jpg' },
  'adicional-musica-en-vivo.mp4': { src: 'SERVICIOS ADICIONALES/MUSICA EN VIVO(1).mp4', width: 720, crf: 27, poster: 'adicional-musica-en-vivo.jpg' },
};

// Fotos sacadas de un fotograma de video: destino (en img/) ← { src, at: segundo }
const frames = {
  // Neblina baja: la quinceañera y su papá sobre la neblina
  'efecto-neblina-baja.jpg': { src: '../videos/neblina baja.mp4', at: 1 },
};

// ---------------------------------------------------------------------------
const fresh = (dst, src) => !FORCE && fs.existsSync(dst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs;
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(VID, { recursive: true });

async function open(file) {
  if (/\.(heic|heif)$/i.test(file)) {
    const out = await heicConvert({ buffer: fs.readFileSync(file), format: 'JPEG', quality: 0.95 });
    return sharp(Buffer.from(out));
  }
  return sharp(file);
}

let done = 0, skipped = 0;
for (const [dst, rel] of Object.entries(images)) {
  const src = SRC + rel, out = IMG + dst;
  if (!fs.existsSync(src)) { console.warn(`⚠  no existe: ${src}`); continue; }
  if (fresh(out, src)) { skipped++; continue; }
  const img = (await open(src)).rotate().resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true });
  if (dst.endsWith('.png')) await img.png({ compressionLevel: 9 }).toFile(out);
  else await img.flatten({ background: '#000' }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  done++;
  process.stdout.write(`✔ ${dst}\n`);
}

for (const [dst, v] of Object.entries(videos)) {
  const dir = v.site ? `src/sites/${v.site}/` : 'src/sites/ecuador/';
  const src = SRC + v.src, out = dir + 'video/' + dst;
  if (!fs.existsSync(src)) { console.warn(`⚠  no existe: ${src}`); continue; }
  fs.mkdirSync(dir + 'video/', { recursive: true });
  if (!fresh(out, src)) {
    const crop = v.portrait ? 'crop=ih*9/16:ih,' : '';
    const audio = v.audio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an'];
    const cap = v.maxrate ? ['-maxrate', `${v.maxrate}k`, '-bufsize', `${v.maxrate * 2}k`] : [];
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, ...audio, '-vf', `${crop}scale='min(${v.width},iw)':-2,fps=${v.fps ?? 30}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(v.crf), ...cap, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    done++;
    console.log(`✔ ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  } else skipped++;
  const poster = v.poster && dir + 'img/' + v.poster;
  if (poster && !fresh(poster, src)) {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(v.posterAt ?? 1), '-i', out, '-frames:v', '1', '-q:v', '3', poster]);
    console.log(`✔ ${v.poster} (fotograma del video)`);
  }
}

for (const [dst, f] of Object.entries(frames)) {
  const src = SRC + f.src, out = IMG + dst;
  if (!fs.existsSync(src)) { console.warn(`⚠  no existe: ${src}`); continue; }
  if (fresh(out, src)) { skipped++; continue; }
  execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(f.at), '-i', src, '-frames:v', '1', '-vf', "scale='min(1440,iw)':-2", '-threads', '1', '-q:v', '2', out]);
  done++;
  console.log(`✔ ${dst} (fotograma del video)`);
}

// ---------------------------------------------------------------------------
// Versiones desenfocadas para la parte inferior de las tarjetas (img/blur/).
// Se generan aquí para que el navegador no tenga que aplicar filtros al hacer scroll.
// ---------------------------------------------------------------------------
fs.mkdirSync(IMG + 'blur/', { recursive: true });
for (const file of fs.readdirSync(IMG)) {
  if (!/^(servicio|efecto|adicional|evento)-.*.jpg$/.test(file)) continue;
  const out = IMG + 'blur/' + file;
  if (fresh(out, IMG + file)) continue;
  await sharp(IMG + file).resize(160).blur(7).modulate({ saturation: 1.2 }).jpeg({ quality: 70 }).toFile(out);
  console.log(`✔ blur/${file}`);
}

// ---------------------------------------------------------------------------
// Fuentes Neue Montreal → public/fonts/*.woff2
// ---------------------------------------------------------------------------
const FONTS = 'public/fonts/';
fs.mkdirSync(FONTS, { recursive: true });
for (const weight of ['Light', 'Regular', 'Medium', 'Bold']) {
  const src = `${SRC}FONT/NeueMontreal-${weight}.otf`, out = `${FONTS}NeueMontreal-${weight}.woff2`;
  if (!fs.existsSync(src) || fresh(out, src)) continue;
  fs.writeFileSync(out, Buffer.from(await wawoff2.compress(fs.readFileSync(src))));
  console.log(`✔ fonts/NeueMontreal-${weight}.woff2`);
}

console.log(`\nListo: ${done} procesados, ${skipped} ya estaban al día.`);
