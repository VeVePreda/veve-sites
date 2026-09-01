// ═══════════════════════════════════════════════════════════════════════════
// test:liens — UN LIEN VERS UNE ADRESSE GATÉE EST GARDÉ PAR CE QUI LA GATE
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ VeVePreda/veve-sites — engine/tools/test_liens.mjs   (FICHIER NEUF — lot 213)
//
// 🔬 POURQUOI CE BANC EXISTE — IL A ÉTÉ MESURÉ MANQUANT, PAS SUPPOSÉ.
// Le 01/09, en jugeant le lot 213, j'ai retiré la garde `priceEnabled()` du
// lien de pied de page et reconstruit vevewiki. Résultat :
//     58 pages sur 283 portaient un lien vers `/how-prices-work/`
//     — page que `astro_features.mjs` venait d'effacer de `dist/`.
// Donc 58 liens vers un 404. Puis j'ai lancé `test:adresses`, `test:pages`,
// `test:cache`, `test:lastmod` et `test:schema` : **les cinq sont restés
// verts.** Aucun banc de ce dépôt ne voyait la panne.
//
// ⭐⭐⭐ ET CE N'EST PAS UNE PANNE NEUVE : c'est le lot 157-B, mot pour mot.
// Là-bas, `/analytics/` avait été déployé sur vevewiki avec quatre liens vers
// des sujets qui n'y existeraient jamais. La leçon d'alors était juste — « un
// avertissement que personne ne lit est un silence qui coûte cher » — mais
// elle n'avait produit AUCUN instrument. `astro_features.mjs` compte toujours
// les talons survivants et se contente d'un `logger.warn` : mesuré ce soir, le
// build sort **rc = 0** avec une page fantôme dans `dist/`.
// ⇒ Ce banc est la dent qui manquait à cette bouche.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 POURQUOI IL LIT LA SOURCE ET NON `dist/`, ce qui semble plus faible
// ═══════════════════════════════════════════════════════════════════════════
// La panne ne se voit QUE sur un `dist/` de vevewiki. Or le Dockerfile — la
// seule porte que le déploiement respecte — construit UN site à la fois, et
// celui de veveprice a toutes ses zones actives. Un banc adossé à `dist/`
// serait donc VERT sur veveprice pour la seule raison que sa condition
// n'arrive jamais : un banc muet qui ressemble à un succès, et un interrupteur
// de plus dans un dépôt qui en a déjà payé plusieurs.
// ⭐ Adossé à la SOURCE, il pose une question qui a une réponse sur les deux
// sites, à chaque build, sans dépendre d'un `SITE=` ni d'un `dist/`.
// ⚠️ Il ne remplace pas un banc de sortie, il le précède. Le banc de sortie
// (« aucun lien de `dist/` ne pointe vers une page absente de `dist/` ») reste
// à écrire : il bute sur les routes servies à la demande, qui sont absentes de
// `dist/` par construction et qu'il faudrait dédouaner via `ROUTES_COMPTE`.
// C'est un chantier, pas une ligne — noté comme tel, pas fait à moitié.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ CE QUE CE BANC NE PROUVE PAS
// ═══════════════════════════════════════════════════════════════════════════
// Il ne prouve pas que la garde est la BONNE (qu'elle vaut faux exactement
// quand la page est effacée) — il prouve qu'il y en a une, et que c'est la
// même fonction que celle qui décide de l'effacement. Les deux moitiés
// viennent de `astro_features.mjs`, donc elles ne peuvent pas diverger sans
// qu'une des deux listes change.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');

let echecs = 0;
const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
};

console.log('\n🔗 test:liens — les liens vers une adresse gatée sont gardés\n');

const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
const features = lire('engine/lib/astro_features.mjs');
const base = lire('src/layouts/Base.astro');

// ═══════════════════════════════════════════════════════════════════════════
// § 1 — LA PAGE DE MÉTHODE EST BIEN DANS UNE ZONE QUI PEUT L'ÉTEINDRE
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ On cherche le PRÉFIXE dans la liste, jamais le nom du fichier ni la
// chaîne « how-prices-work » n'importe où : elle apparaît aussi dans les
// commentaires, et un banc qui compte des commentaires mesure la prose.
const zonePrix = (features.match(/\{\s*nom:\s*'prix',[\s\S]*?\]\s*\}/) || [])[0] || '';
verifie('§1 la zone « prix » est lisible dans astro_features.mjs',
  zonePrix.length > 0,
  zonePrix.length ? `${zonePrix.split(',').length} entrée(s)` : '🔴 bloc introuvable — la forme du fichier a changé');
verifie('§1 `/how-prices-work/` figure dans ses préfixes',
  /'\/how-prices-work\/'/.test(zonePrix),
  /'\/how-prices-work\/'/.test(zonePrix) ? null
    : '🔴 sans ce préfixe, la page SURVIT en 200 sur un site sans prix (mesuré le 01/09 : 1 talon fantôme, build rc=0)');

// ═══════════════════════════════════════════════════════════════════════════
// § 2 — LE LIEN DU PIED DE PAGE EST GARDÉ, ET PAR LA MÊME FONCTION
// ═══════════════════════════════════════════════════════════════════════════
// 🔬 C'EST LA SECTION QUI A MORDU À L'INJECTION DU 01/09. Retirer
// `priceEnabled() &&` fait tomber le §2 ci-dessous, et lui seul.
const lien = base.indexOf("'/how-prices-work/'");
verifie('§2 le pied de page émet bien le lien',
  lien > 0,
  lien > 0 ? null : '🔴 le lien a disparu de Base.astro — la page devient orpheline');

if (lien > 0) {
  // ⭐ ON REGARDE LES 400 CARACTÈRES QUI PRÉCÈDENT, ET C'EST MESURÉ, PAS CHOISI
  // AU HASARD : dans le gabarit actuel, la garde ouvre 3 lignes plus haut. Une
  // fenêtre trop large attraperait le `priceEnabled()` d'une AUTRE colonne du
  // pied et rendrait le banc vert pour la garde du voisin — la panne exacte
  // que `test:tableau` a payée en comparant des classes hors contexte.
  const avant = base.slice(Math.max(0, lien - 400), lien);
  const garde = /priceEnabled\(\)\s*&&/.test(avant);
  verifie('§2 il est gardé par `priceEnabled()`',
    garde,
    garde ? null
      : '🔴 lien NON gardé — mesuré le 01/09 sur vevewiki : 58 pages sur 283 pointent vers un 404, '
        + 'et test:adresses, test:pages, test:cache, test:lastmod et test:schema restent VERTS');
  verifie('§2 la garde est la MÊME fonction que celle de la zone',
    /actif:\s*priceEnabled/.test(zonePrix) && garde,
    /actif:\s*priceEnabled/.test(zonePrix)
      ? null
      : '🔴 la zone n\'est plus gouvernée par `priceEnabled` : deux juges pour une décision, ils divergeront');
}

// ═══════════════════════════════════════════════════════════════════════════
// § 3 — LE CONTRE-CONTRÔLE : CE BANC SAIT-IL ENCORE ROUGIR ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ UN BANC QUI NE SAIT PLUS ÉCHOUER EST UN INTERRUPTEUR. Ici on ne se
// contente pas de l'espérer : on rejoue le §2 sur un gabarit FAUX, fabriqué à
// la volée, et on exige qu'il tombe. Si cette ligne devient verte alors que le
// §2 l'est aussi, c'est le DÉTECTEUR qui est cassé, pas le code.
const faux = "<ul>\n<li><a href={localize(lang, '/how-prices-work/')}>x</a></li>\n</ul>";
const iFaux = faux.indexOf("'/how-prices-work/'");
verifie('§3 contre-contrôle : sur un gabarit SANS garde, le §2 tomberait',
  !/priceEnabled\(\)\s*&&/.test(faux.slice(Math.max(0, iFaux - 400), iFaux)),
  '⛔ si cette ligne échoue, le détecteur du §2 ne mord plus');

console.log(echecs === 0
  ? `\n✅ ${'tous les contrôles passent'}\n`
  : `\n🔴 ${echecs} contrôle(s) en échec\n`);
process.exit(echecs === 0 ? 0 : 1);
