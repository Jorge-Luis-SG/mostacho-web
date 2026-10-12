import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Cambia por el dominio real cuando lo tengas (se usa para URLs absolutas y SEO).
  site: 'https://example.com',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  // El proyecto está en OneDrive: el modo "polling" asegura que el servidor detecte cada cambio.
  vite: { server: { watch: { usePolling: true, interval: 300 } } },
});
