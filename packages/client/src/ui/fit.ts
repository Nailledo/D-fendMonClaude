/**
 * Garde un élément flottant (infobulle, aperçu) entièrement à l'écran.
 * Son ancre suit la caméra : la correction est recalculée à chaque image tant qu'il est affiché.
 * Utilise la propriété CSS `translate`, indépendante de `transform`.
 */
export function fit(el: HTMLElement, margin = 8) {
  let dx = 0, dy = 0, raf = 0;
  const step = () => {
    const r = el.getBoundingClientRect();
    // position sans correction
    const x0 = r.left - dx, y0 = r.top - dy;
    const W = innerWidth, H = innerHeight, m = margin;
    let nx = 0, ny = 0;
    if (x0 + r.width > W - m) nx = W - m - (x0 + r.width);
    if (x0 + nx < m) nx = m - x0;
    if (y0 + r.height > H - m) ny = H - m - (y0 + r.height);
    if (y0 + ny < m) ny = m - y0;
    if (Math.abs(nx - dx) > 0.5 || Math.abs(ny - dy) > 0.5) {
      dx = nx;
      dy = ny;
      el.style.translate = `${dx | 0}px ${dy | 0}px`;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { destroy: () => cancelAnimationFrame(raf) };
}
