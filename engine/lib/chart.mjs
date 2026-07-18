// Graphique de prix rendu cote SERVEUR en SVG : zero JavaScript envoye au navigateur.
export function priceChartSVG(history, opts = {}) {
  const w = opts.width || 720, h = opts.height || 260;
  const pad = { t: 16, r: 16, b: 28, l: 52 };
  const pts = (history || []).filter((p) => Number.isFinite(p.floor));
  if (pts.length < 2) return '<p class="muted">Pas encore assez d\'historique pour tracer une courbe.</p>';
  const xs = pts.map((p) => new Date(p.ts).getTime());
  const ys = pts.map((p) => p.floor);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const spanX = x1 - x0 || 1, spanY = (y1 - y0) || 1;
  const px = (v) => pad.l + ((v - x0) / spanX) * (w - pad.l - pad.r);
  const py = (v) => h - pad.b - ((v - y0) / spanY) * (h - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(new Date(p.ts).getTime()).toFixed(1)},${py(p.floor).toFixed(1)}`).join('');
  const area = `${d}L${px(x1).toFixed(1)},${(h - pad.b).toFixed(1)}L${px(x0).toFixed(1)},${(h - pad.b).toFixed(1)}Z`;
  const fmt = (n) => n >= 1000 ? Math.round(n).toLocaleString('fr-FR') : n.toFixed(2);
  const yTicks = [y0, y0 + spanY / 2, y1].map((v) => `<line x1="${pad.l}" y1="${py(v).toFixed(1)}" x2="${w - pad.r}" y2="${py(v).toFixed(1)}" class="grid"/><text x="${pad.l - 8}" y="${(py(v) + 4).toFixed(1)}" class="axis" text-anchor="end">${fmt(v)}</text>`).join('');
  const year = (t) => new Date(t).getUTCFullYear();
  const xTicks = [x0, x0 + spanX / 2, x1].map((t) => `<text x="${px(t).toFixed(1)}" y="${h - 8}" class="axis" text-anchor="middle">${year(t)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Historique du prix plancher"><title>Historique du prix plancher</title>${yTicks}<path d="${area}" class="area"/><path d="${d}" class="line" fill="none"/>${xTicks}</svg>`;
}
