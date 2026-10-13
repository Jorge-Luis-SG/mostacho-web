#!/usr/bin/env node
/**
 * Importa los assets originales de capturas/assets/ a src/sites/ecuador/.
 *   npm run assets
 *
 * - Fotos: convierte HEIC/HEIF a JPG y reduce las enormes a un máximo de 2560 px (sin recortar).
 *   Astro las vuelve a optimizar (AVIF/WebP y varios tamaños) en cada build.
 * - Videos: los pasa a MP4 H.264 sin audio, listos para la web, y saca un fotograma como imagen de carga.
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

  'hora-loca-robots-led.jpg': 'ROBOTS/SaveClip.App_681488590_18192437227362105_5792064684209979491_n.webp',
  'hora-loca-show-mirror.jpg': 'HORA LOCA/MIRROR(4).jpg',
  'hora-loca-funky-animals.jpg': 'HORA LOCA/FUNKY ANIMALS(2).png',
  'hora-loca-arlequines.jpg': 'HORA LOCA/ARLEQUINES(2).jpg',
  'hora-loca-monster-glitter.jpg': 'HORA LOCA/GLITTER AND MIRROR.jpg',
  'hora-loca-galacticos.jpg': 'HORA LOCA/GALACTICOS.jpg',
  'hora-loca-white-wings.jpg': 'HORA LOCA/WHITE WINGS(1).jpg',
  'hora-loca-robots-mirror.jpg': 'ROBOTS/ROBOTS MIRROR.jpg',
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

  'recibe-rosas-doradas.jpg': 'RECIBIMIENTO DE INVITADOS/ROSAS GLAM DORADAS.jpg',
  // Rosas glam rojas: la de "ROSAS GLAM ROJAS.jpg" lleva textos de Instagram encima; se usa la de COMBINADOS con las rosas rojas
  'recibe-rosas-rojas.jpg': 'RECIBIMIENTO DE INVITADOS/COMBINADOS(2).heif',
  // Rosas glam blancas: la única que hay mide 158 × 284 px (se verá borrosa; cambiarla en cuanto llegue una más grande)
  'recibe-rosas-blancas.jpg': 'RECIBIMIENTO DE INVITADOS/ROSAS GLAM BLANCAS.png',
  'recibe-personajes-golden.jpg': 'RECIBIMIENTO DE INVITADOS/GOLDEN.jpg',
  'recibe-personajes-silver.jpg': 'RECIBIMIENTO DE INVITADOS/SILVER.heif',
  'recibe-afrodita.jpg': 'RECIBIMIENTO DE INVITADOS/AFRODITOS(2).jpg',
  'recibe-arlequines.jpg': 'RECIBIMIENTO DE INVITADOS/ARLQUINES.jpg',
  'recibe-black-and-white.jpg': 'RECIBIMIENTO DE INVITADOS/BLACK AND WHITE.jpg',
  'recibe-combinados.jpg': 'RECIBIMIENTO DE INVITADOS/COMBINADOS(1).jpg',
  'recibe-elementos.jpg': 'RECIBIMIENTO DE INVITADOS/ELEMENTOS.jpg',
  'recibe-isis.jpg': 'RECIBIMIENTO DE INVITADOS/ISIS.jpg',
  'recibe-mimos.jpg': 'RECIBIMIENTO DE INVITADOS/MIMOS.heif',

  'efecto-bazooka.jpg': 'EFECTOS ESPECIALES/BAZOOKA CO2.jpg',
  'efecto-neblina-baja.jpg': 'EFECTOS ESPECIALES/NEBLINA BAJA.png',
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
  'adicional-zanqueros.jpg': 'SERVICIOS ADICIONALES/ZANQUEROS(2).jpg',
  'adicional-party-shot.jpg': 'SERVICIOS/SERVICIO ADICIONAL PARTY SHOT.HEIF',

  'infantil-kpop.jpg': 'SERVICIOS/MOSTACHO INFANTILES 1.jpg',
  'infantil-world-tour.jpg': 'SERVICIOS/MOSTACHO INFANTILES.jpg',
  'infantil-kpop-logo.png': '../k-pop-demon-hunters.png', // logo transparente (está en capturas/, no en assets/)

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
// Videos: destino (en src/sites/ecuador/video/) ← origen. El póster va a img/ con el nombre indicado.
// ---------------------------------------------------------------------------
const videos = {
  'hero.mp4': { src: 'VIDEO HERO/IMG_0600.MOV', width: 1280, crf: 32, fps: 24 },
  'servicio-hora-loca.mp4': { src: 'SERVICIOS/HORA LOCA.mp4', width: 720, crf: 26, poster: 'servicio-hora-loca.jpg' },
  'adicional-cabina-espejada.mp4': { src: 'SERVICIOS ADICIONALES/CABINA ESPEJADA.mp4', width: 720, crf: 26, poster: 'adicional-cabina-espejada.jpg' },
  'adicional-musica-en-vivo.mp4': { src: 'SERVICIOS ADICIONALES/MUSICA EN VIVO(1).mp4', width: 720, crf: 27, poster: 'adicional-musica-en-vivo.jpg' },
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
  const src = SRC + v.src, out = VID + dst;
  if (!fs.existsSync(src)) { console.warn(`⚠  no existe: ${src}`); continue; }
  if (!fresh(out, src)) {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-an', '-vf', `scale='min(${v.width},iw)':-2,fps=${v.fps ?? 30}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(v.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    done++;
    console.log(`✔ video/${dst} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  } else skipped++;
  if (v.poster && !fresh(IMG + v.poster, src)) {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-q:v', '3', IMG + v.poster]);
    console.log(`✔ ${v.poster} (fotograma del video)`);
  }
}

// ---------------------------------------------------------------------------
// Versiones desenfocadas para la parte inferior de las tarjetas (img/blur/).
// Se generan aquí para que el navegador no tenga que aplicar filtros al hacer scroll.
// ---------------------------------------------------------------------------
fs.mkdirSync(IMG + 'blur/', { recursive: true });
for (const file of fs.readdirSync(IMG)) {
  if (!/^(servicio|efecto|adicional)-.*.jpg$/.test(file)) continue;
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
