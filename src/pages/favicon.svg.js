import { manifest } from '../../engine/lib/manifest.mjs';
// Favicon derive du manifeste : chaque site a automatiquement le sien.
export function GET() {
  const m = manifest();
  const p = m.identity?.palette || {};
  const initials = String(m.site?.brand || '?')
    .split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${m.site?.brand || ''}">`
    + `<rect width="64" height="64" rx="14" fill="${p.primary || '#4f8cff'}"/>`
    + `<text x="32" y="44" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="30" font-weight="600" fill="#ffffff" text-anchor="middle">${initials}</text></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
