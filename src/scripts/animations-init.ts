// El motor de efectos se descarga cuando una sección que lo necesita se acerca.
// Las páginas sin efectos y quienes prefieren menos movimiento no pagan esa descarga.
const animated = [...document.querySelectorAll<HTMLElement>('.pin[data-pin], section[data-anim="sides"]')];
// Mantener el cambio a la versión sin efectos al girar un móvil o activar «reducir movimiento»,
// incluso si el motor todavía no se ha descargado.
if (document.documentElement.classList.contains('anim')) {
  matchMedia('(min-height: 500px) and (prefers-reduced-motion: no-preference)').addEventListener('change', () => location.reload());
}
if (document.documentElement.classList.contains('anim') && animated.length) {
  let requested = false;
  const load = () => {
    if (requested) return;
    requested = true;
    observer.disconnect();
    import('./animations').catch(() => {
      // Si falla la conexión, quedan disponibles las tarjetas y los carruseles normales.
      document.documentElement.classList.remove('anim');
    });
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) load();
  }, { rootMargin: '1000px 0px' });
  animated.forEach((section) => observer.observe(section));

  const linkedEffect = (hash: string) => {
    try {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target && animated.some((section) => section.contains(target))) load();
    } catch { /* Un ancla inválida no impide navegar por la página. */ }
  };
  if (location.hash) linkedEffect(location.hash);
  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (link) linkedEffect(link.hash);
  }, { capture: true });
}
