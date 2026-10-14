import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Cambia por el dominio real cuando lo tengas (se usa para URLs absolutas y SEO).
  // SITE_URL y BASE_PATH permiten publicar en una subcarpeta (p. ej. GitHub Pages: /mostacho-web).
  site: process.env.SITE_URL || 'https://example.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  // El servidor de desarrollo escucha en IPv4 e IPv6: así localhost abre en cualquier navegador
  // (y también se puede probar desde el móvil en la misma red Wi-Fi, con la IP del ordenador).
  server: { host: true },
  // El proyecto está en OneDrive: el modo "polling" asegura que el servidor detecte cada cambio.
  vite: { server: { watch: { usePolling: true, interval: 300 } } },
});
