// ⚠️ VeVePreda/veve-sites — engine/tools/_cascade.mjs   (FICHIER NEUF — lot 161)
// ═══════════════════════════════════════════════════════════════════════════
//  QUI GAGNE ? — la question qu'aucun de nos instruments ne posait
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI CE FICHIER EXISTE. Le 06/08/2026, `themes/vitrine/theme.css`
// a reçu `main{padding:var(--s7) 0 var(--s8)}` pour rendre à Preda l'espace
// au-dessus du pied de page, avec douze lignes de commentaire pour défendre le
// choix du PADDING contre la MARGE. Mesuré le 24/08 sur la feuille servie en
// production : ce padding valait **0**. `Base.astro` émet `<main class="wrap">`
// et `.wrap{padding:0 24px}` — une CLASSE (0,1,0) bat un ÉLÉMENT (0,0,1) quel
// que soit l'ordre, et le raccourci remet haut et bas à zéro.
// ⇒ La règle était écrite, lisible, commentée, et elle n'a jamais peint.
//
// ⭐⭐⭐ « EST-CE ÉCRIT ? » ET « EST-CE CE QUI GAGNE ? » SONT DEUX QUESTIONS.
//   · `outils/css-mort.mjs`       demande « cette règle EXISTE-t-elle ? »   → oui
//   · `outils/cascade-aplatie.mjs` demande « la version mobile FUIT-elle ? » → non
//   Aucun des deux ne pouvait voir le défaut. Celui-ci pose la troisième.
//
// ⛔ CE QU'IL NE FAIT PAS, ET IL FAUT LE LIRE AVANT DE S'EN SERVIR :
//   · il ne résout PAS `var()` — il rend `var(--s8)`, pas `88px` ;
//   · il n'applique PAS l'héritage, ni les valeurs calculées, ni le layout ;
//   · il ne connaît que `@media` sur `min-width`/`max-width` en px, dans les
//     deux syntaxes (`(max-width:640px)` ET `(width <= 640px)`) ;
//   · il ignore `@keyframes`, `@starting-style`, `@supports`, `@container`.
//   ⇒ Il répond à UNE question : *quelle déclaration l'emporte sur cet élément.*
//   Un banc qui lui demanderait autre chose lui ferait dire ce qu'il ne sait pas.
//
// ⭐⭐ ZÉRO DÉPENDANCE NOUVELLE. `postcss` et `lightningcss` sont présents dans
// `node_modules`, mais en TRANSITIF d'Astro : ils ne sont pas dans notre
// `package.json`. Un banc bâti dessus rougirait le jour où Astro change de
// parseur, sans que rien chez nous ait bougé. Le découpage est donc écrit ici,
// à la main, et il tient en cinquante lignes.

/** Découpe une feuille en règles de premier niveau, `@media` inclus.
 *  Rend aussi les ANOMALIES — un sélecteur sans bloc, une étape de keyframes
 *  égarée à la racine : les deux signatures trouvées le 24/08 dans la feuille
 *  servie, qu'aucun build, aucun log et aucun banc ne signalait. */
export function decouper(css) {
  const sansCom = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const regles = [], anomalies = [];
  let ordre = 0;

  const decouperDans = (texte, media) => {
    let j = 0, debutSel = 0;
    while (j < texte.length) {
      const c = texte[j];
      if (c === '{') {
        const sel = texte.slice(debutSel, j).trim();
        let k = j + 1, prof = 1;
        while (k < texte.length && prof > 0) { if (texte[k] === '{') prof++; else if (texte[k] === '}') prof--; k++; }
        const corps = texte.slice(j + 1, k - 1);
        if (/^@media/i.test(sel)) decouperDans(corps, (media ? media + ' and ' : '') + sel.replace(/^@media/i, '').trim());
        else if (sel.startsWith('@')) { /* hors sujet */ }
        else if (sel) {
          if (!media && /^\s*(\d+(\.\d+)?%|from|to)\s*$/i.test(sel))
            anomalies.push({ quoi: 'etape de keyframes a la racine', texte: sel, ligne: ligneDe(texte, debutSel) });
          regles.push({ selecteurs: sel.split(',').map((s) => s.trim()).filter(Boolean), corps, media: media || '', ordre: ++ordre });
        }
        j = k; debutSel = j;
      } else if (c === '}') {
        const reste = texte.slice(debutSel, j).trim();
        if (reste) anomalies.push({ quoi: 'selecteur sans bloc', texte: reste.slice(0, 80), ligne: ligneDe(texte, debutSel) });
        j++; debutSel = j;
      } else j++;
    }
    // 🔴 LE RESTE APRÈS LA DERNIÈRE ACCOLADE. Sans ce contrôle, la version du
    // 24/08 ratait la MOITIÉ de ce qu'elle cherchait : `.decor,.banniere,` était
    // la DERNIÈRE chose d'un bloc `@media`, et le `}` du media avait déjà servi
    // de fermeture. Le sélecteur pendant sortait donc de la boucle sans jamais
    // être examiné — et le détecteur rendait « 12 anomalies » au lieu de 13.
    // ⭐⭐ Trouvé par contre-épreuve : lightningcss en signalait une de plus.
    const queue = texte.slice(debutSel).trim();
    if (queue) anomalies.push({ quoi: 'selecteur sans bloc', texte: queue.slice(0, 80), ligne: ligneDe(texte, debutSel) });
  };
  decouperDans(sansCom, '');
  return { regles, anomalies };
}

const ligneDe = (s, i) => s.slice(0, i).split('\n').length;

/** Spécificité (ids, classes, éléments). Suffisante pour nos sélecteurs. */
export function specificite(sel) {
  const ids = (sel.match(/#[\w-]+/g) || []).length;
  const cls = (sel.match(/\.[\w-]+/g) || []).length
            + (sel.match(/\[[^\]]+\]/g) || []).length
            + (sel.match(/(?<!:):(?!:)[\w-]+/g) || []).length;
  const el = (sel.replace(/[.#:][\w-]+/g, '').replace(/\[[^\]]*\]/g, '')
                 .match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return [ids, cls, el];
}

/** La condition `@media` tient-elle à cette largeur ? Les deux syntaxes. */
export function mediaTient(txt, largeur) {
  if (!txt) return true;
  if (/print|prefers-reduced-motion|forced-colors|hover\s*:/i.test(txt)) return false;
  for (const m of txt.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)/g))
    if (m[1] === 'max' ? largeur > +m[2] : largeur < +m[2]) return false;
  for (const m of txt.matchAll(/width\s*(<=|>=|<|>|=)\s*([\d.]+)px/g)) {
    const v = +m[2], ok = { '<=': largeur <= v, '<': largeur < v, '>=': largeur >= v, '>': largeur > v, '=': largeur === v }[m[1]];
    if (!ok) return false;
  }
  for (const m of txt.matchAll(/([\d.]+)px\s*(<=|<)\s*width/g))
    if (!(m[2] === '<=' ? +m[1] <= largeur : +m[1] < largeur)) return false;
  return true;
}

/** Quelle déclaration gagne pour `propriete` sur `element` (un nœud linkedom) ?
 *  `raccourcis` : les propriétés-raccourci qui posent aussi cette valeur,
 *  avec l'index de la sous-valeur — ex. padding-bottom ⇒ ['padding', 2]. */
export function quiGagne(regles, element, propriete, largeur, raccourci = null) {
  const candidates = [];
  for (const r of regles) {
    if (!mediaTient(r.media, largeur)) continue;
    let matche = false;
    for (const sel of r.selecteurs) { try { if (element.matches(sel)) { matche = true; var gagnant = sel; break; } } catch { /* sélecteur exotique */ } }
    if (!matche) continue;
    for (const d of r.corps.split(';')) {
      const k = d.indexOf(':'); if (k < 0) continue;
      const prop = d.slice(0, k).trim().toLowerCase();
      let val = d.slice(k + 1).trim();
      const imp = /!\s*important$/i.test(val); if (imp) val = val.replace(/!\s*important$/i, '').trim();
      if (prop === propriete) candidates.push({ sel: gagnant, prop, val, imp, spec: specificite(gagnant), ordre: r.ordre, media: r.media });
      else if (raccourci && prop === raccourci[0]) {
        const p = val.split(/\s+/);
        const v = p.length === 1 ? p[0] : (p[raccourci[1]] ?? p[raccourci[1] % p.length] ?? p[0]);
        candidates.push({ sel: gagnant, prop, val: v, brut: val, imp, spec: specificite(gagnant), ordre: r.ordre, media: r.media });
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.imp - b.imp) || (a.spec[0] - b.spec[0]) || (a.spec[1] - b.spec[1])
                          || (a.spec[2] - b.spec[2]) || (a.ordre - b.ordre));
  return candidates.at(-1);
}
