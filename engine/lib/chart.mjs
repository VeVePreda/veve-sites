// Graphique de prix rendu cote SERVEUR en SVG : zero JavaScript envoye au navigateur.

// ═══════════════════════════════════════════════════════════════════════════
// DEUX COURBES, DEUX FONCTIONS, ET LE CHOIX SE FAIT AILLEURS
// ═══════════════════════════════════════════════════════════════════════════
// `priceChartSVG` trace des PRIX : il a des graduations chiffrees, donc il dit
// des montants. `courbeSVG` trace une FORME : la serie a ete normalisee 0..1000
// a la source (engine/lib/cote.mjs), il n'existe aucun montant a afficher.
//
// ⛔⛔ ON NE FAIT PAS UNE SEULE FONCTION QUI DEVINE. Un rendu qui inspecte la
// forme de son entree pour decider s'il a le droit d'ecrire un prix est un
// verrou pose sur une heuristique — et le jour ou l'entree change de forme,
// c'est la version qui PARLE qui gagne. Le manifeste decide (`coteFermee()`),
// le gabarit appelle la bonne fonction, et chacune ne sait faire qu'une chose.
//
// ⭐ COROLLAIRE : `courbeSVG` NE PEUT PAS FUITER, meme mal appelee. On ne lui
// passe pas de prix ; il n'y en a plus dans l'objet a ce stade du build.

export function priceChartSVG(history, opts = {}) {
  const label = opts.label || 'Floor price history';
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
  const yTicks = [y0, y0 + spanY / 2, y1].map((v) => `<line x1="${pad.l}" y1="${py(v).toFixed(1)}" x2="${w - pad.r}" y2="${py(v).toFixed(1)}" class="grille-l"/><text x="${pad.l - 8}" y="${(py(v) + 4).toFixed(1)}" class="axe" text-anchor="end">${fmt(v)}</text>`).join('');
  const year = (t) => new Date(t).getUTCFullYear();
  const xTicks = [x0, x0 + spanX / 2, x1].map((t) => `<text x="${px(t).toFixed(1)}" y="${h - 8}" class="axe" text-anchor="middle">${year(t)}</text>`).join('');
  return `<svg class="graph" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>${yTicks}<path d="${area}" class="aire"/><path d="${d}" class="ligne" fill="none"/>${xTicks}</svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LA COURBE SANS ÉCHELLE — lot 101 (07/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
// Arbitrage Preda : « les graphes sans échelle restent publics ». Une courbe
// dont on retire les graduations reste une FORME — elle raconte la tendance,
// elle se partage, et elle ne dit aucun montant.
//
// ⭐ LES DATES RESTENT, ET C'EST DELIBERE. Une date n'est pas un prix, et sans
// axe des temps la courbe ne raconte plus rien du tout : « ça monte » sans
// savoir sur combien de temps n'est pas une information, c'est une impression.
//
// ⛔ LA GRADUATION HORIZONTALE DU MILIEU DISPARAIT AUSSI. Elle ne portait pas
// de texte, mais elle marquait la MEDIANE de la fenetre : combinee a un seul
// prix connu par ailleurs (le prix de drop, public), elle donnait une echelle.
// On ne garde que le sol et le plafond du cadre, qui ne disent rien.
//
// @param courbe  [[ts_secondes, y_0_a_1000], …] — voir `normaliser()` dans cote.mjs
export function courbeSVG(courbe, opts = {}) {
  const label = opts.label || 'Price trend';
  const w = opts.width || 720, h = opts.height || 260;
  const pad = { t: 16, r: 16, b: 28, l: 16 };   // ⭐ plus de marge a gauche : plus d'axe
  const pts = (courbe || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 2) return '';
  const xs = pts.map((p) => p[0] * 1000);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const spanX = (x1 - x0) || 1;
  const px = (v) => pad.l + ((v - x0) / spanX) * (w - pad.l - pad.r);
  // ⭐ L'ECHELLE VERTICALE EST FIXE (0..1000), pas deduite des points : deduire
  // le min et le max de la serie recue reviendrait a re-normaliser une serie
  // deja normalisee, ce qui est sans effet ici mais deviendrait faux le jour ou
  // `normaliser()` changerait de borne. Une constante partagee se lit, une
  // deduction se devine.
  const py = (v) => h - pad.b - (v / 1000) * (h - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0] * 1000).toFixed(1)},${py(p[1]).toFixed(1)}`).join('');
  const area = `${d}L${px(x1).toFixed(1)},${(h - pad.b).toFixed(1)}L${px(x0).toFixed(1)},${(h - pad.b).toFixed(1)}Z`;
  const cadre = [0, 1000].map((v) => `<line x1="${pad.l}" y1="${py(v).toFixed(1)}" x2="${w - pad.r}" y2="${py(v).toFixed(1)}" class="grille-l"/>`).join('');
  const jour = (t) => new Date(t).toISOString().slice(0, 10);
  const xTicks = [x0, x0 + spanX / 2, x1].map((t) => `<text x="${px(t).toFixed(1)}" y="${h - 8}" class="axe axe--d" text-anchor="middle">${jour(t)}</text>`).join('');
  return `<svg class="graph graph--muet" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>${cadre}<path d="${area}" class="aire"/><path d="${d}" class="ligne" fill="none"/>${xTicks}</svg>`;
}
