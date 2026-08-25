// ⚠️ VeVePreda/veve-sites — engine/tools/test_entetes.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
//  LES EN-TÊTES DE SÉCURITÉ — le banc qui RÉCLAME ce que le dépôt ne contient pas
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE BANC EST LA MOITIÉ QUI MANQUAIT À UNE DÉCISION. Les en-têtes sont
// posés dans CLOUDFLARE, donc aucun fichier de ce dépôt ne sait qu'ils
// existent. Supprimez la règle : le build passe, la CI passe, le site marche,
// et personne n'apprend rien. C'est « posé ≠ branché », et c'est la forme la
// plus coûteuse de panne de ce projet — celle qui ne produit AUCUN run rouge.
// ⇒ `engine/lib/entetes_attendus.mjs` DÉCLARE ; ce fichier RÉCLAME.
//
// ⛔⛔ IL NE VA PAS DANS LE DOCKERFILE. Il interroge le réseau : l'y mettre
// ferait échouer un déploiement sur un hoquet Cloudflare, et un banc ne doit
// JAMAIS rougir pour une raison qui n'est pas la sienne. Il vit dans `npm test`
// et dans la CI, qui CONSTATENT — elles n'EMPÊCHENT pas.
//
// 🔴🔴 TROIS VERDICTS, PAS DEUX :
//     conforme (0) · écart (1) · INDÉCIDABLE (2)
// ⛔ RÉSEAU MUET ⇒ INDÉCIDABLE, JAMAIS VERT. Un banc qui se déclare vert parce
//   qu'il n'a rien pu mesurer est `regle-silence-du-non-execute` sous une forme
//   neuve : il transforme une absence de mesure en preuve de conformité.
//
// ⭐ CE QU'IL NE MESURE PAS, IL LE DIT. Un audit qui comble un trou de mesure
//   par une impression vaut moins que pas d'audit du tout.
//
// Usage :
//     npm run test:entetes
//     npm run test:entetes -- --attendre     (75 s d'abord — APRÈS un changement
//                                             de règle Cloudflare, le temps que
//                                             la propagation se fasse)

import {
  ENTETES_ATTENDUS, ZONES, CIBLES, EXCEPTIONS, PASSAGES, PAUSE_MS,
  ATTENTE_PROPAGATION_MS, DELAI_MS, METHODE, ECHELLE_HSTS,
  CSP_VOLONTAIREMENT_ABSENTE,
} from '../lib/entetes_attendus.mjs';

let echecs = 0, indecidables = 0, mesures = 0, zonesJoignables = 0;

const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? `\n       ${detail}` : ''}`);
};
const indecis = (titre, pourquoi) => {
  indecidables++;
  console.log(`  ⏸️   ${titre} — INDÉCIDABLE : ${pourquoi}`);
};
const note = (t) => console.log(`  ·    ${t}`);

const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('\n═══ EN-TÊTES DE SÉCURITÉ — les DEUX zones Cloudflare ═══');
console.log(`    (méthode ${METHODE}, ${PASSAGES} passages, ${ZONES.length} zones)`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA DÉCLARATION — le § QUI N'OUVRE PAS LE RÉSEAU
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ CE § EST LE SEUL QUI RENDE UN VERDICT MÊME HORS LIGNE. Il ne vérifie pas
// la production : il vérifie que ce qu'on lui demande d'exiger a du sens. Une
// déclaration qui s'est dégradée (un plancher abaissé « pour faire passer le
// banc », un `preload` glissé par distraction) rendrait tout le reste vert en
// ne prouvant plus rien.
// 🔴 C'est le remède au réflexe qui a coûté trois bancs à ce projet : réparer
//   l'INSTRUMENT en relevant la borne jusqu'à ce qu'il se taise.
console.log('\n1. la liste déclarée est-elle saine ? (aucun appel réseau)');

const noms = Object.keys(ENTETES_ATTENDUS);
verifie(`${noms.length} en-tête(s) déclaré(s)`, noms.length >= 5,
  noms.join(' · '));
verifie('tous les noms sont en minuscules',
  noms.every((n) => n === n.toLowerCase()),
  'les en-têtes HTTP/2 arrivent en minuscules — comparer autrement, c\'est ' +
  'déclarer absent un en-tête présent');

const hsts = ENTETES_ATTENDUS['strict-transport-security'];
verifie('`strict-transport-security` est un PLANCHER, pas une égalité',
  hsts && hsts.genre === 'plancher-max-age',
  'une égalité rougirait le jour de la montée à 6 mois — le banc empêcherait ' +
  'le progrès qu\'il est censé protéger');
verifie('le plancher déclaré est un palier connu de l\'échelle',
  ECHELLE_HSTS.includes(hsts?.plancher),
  `plancher = ${hsts?.plancher} · échelle = ${ECHELLE_HSTS.join(' → ')}`);
verifie('`includeSubDomains` et `preload` sont déclarés INTERDITS',
  hsts?.interdits?.includes('includesubdomains') && hsts?.interdits?.includes('preload'),
  '⛔ irréversibles : `preload` grave le domaine DANS les navigateurs');

// ⛔ Et la déclaration elle-même ne doit pas contenir ce qu'elle interdit.
//   « Est-ce là ? » n'est pas « est-ce que ça marche ? » : on lit la valeur.
const decl = JSON.stringify(ENTETES_ATTENDUS).toLowerCase();
verifie('aucune directive irréversible ne s\'est glissée dans la déclaration',
  !decl.includes('includesubdomains=') && !/"[^"]*preload[^"]*"\s*:/.test(decl) &&
  !decl.includes('; preload') && !decl.includes(';preload'),
  'un `preload` déclaré serait exigé, donc posé, donc irréversible');

verifie('la CSP est absente VOLONTAIREMENT et c\'est écrit',
  CSP_VOLONTAIREMENT_ABSENTE === true && !noms.includes('content-security-policy'),
  '⛔ la CSP suit OPT‑3 (sortie des `<script is:inline>`), elle ne le précède ' +
  'jamais — l\'exiger aujourd\'hui casserait toutes les pages');

verifie('les DEUX zones sont déclarées', ZONES.length === 2,
  ZONES.map((z) => z.nom).join(' · ') +
  ' — ⛔ une règle par zone, elle ne voyage pas');
verifie('les cibles comprennent un 404 ET un fichier statique',
  CIBLES.some((c) => c.fabrique404) && CIBLES.some((c) => c.decouvreCss),
  '🔴 c\'est EXACTEMENT là qu\'était le défaut du 11/08 : l\'audit du 10/08 ' +
  'n\'avait ouvert que des pages qui existent');

// ⭐ Une exception sans date de revue est une exception éternelle.
for (const e of EXCEPTIONS) {
  verifie(`l'exception « ${e.cible} » porte une raison et une date de revue`,
    Boolean(e.pourquoi) && Boolean(e.revoirLe), e.pourquoi);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA PRODUCTION — les deux zones, cible par cible, trois passages
// ═══════════════════════════════════════════════════════════════════════════

if (process.argv.includes('--attendre')) {
  console.log(`\n⏳ attente de propagation (${ATTENTE_PROPAGATION_MS / 1000} s) —` +
    ' une règle Cloudflare fraîche se lit comme ABSENTE pendant sa propagation.');
  await dodo(ATTENTE_PROPAGATION_MS);
}

/** Un GET qui ne lève jamais : il rend soit les en-têtes, soit la panne. */
async function frappe(url) {
  const stop = AbortSignal.timeout(DELAI_MS);
  try {
    const r = await fetch(url, { method: METHODE, redirect: 'manual', signal: stop });
    // ⛔ On CONSOMME le corps : un corps non lu laisse la socket ouverte et le
    //   processus ne rend jamais la main — un banc qui ne se termine pas est un
    //   banc muet.
    await r.arrayBuffer().catch(() => {});
    const h = {};
    for (const [k, v] of r.headers) h[k.toLowerCase()] = v;
    return { ok: true, code: r.status, h };
  } catch (e) {
    return { ok: false, panne: e?.message || String(e) };
  }
}

/** Le 404 est FABRIQUÉ à chaque passage : jamais deux fois la même adresse,
 *  donc jamais une réponse tirée d'un cache qui masquerait l'état réel. */
const url404 = (base) =>
  `${base}/banc-entetes-page-absente-${Date.now()}-${Math.floor(Math.random() * 1e6)}/`;

/** L'adresse du CSS se DÉCOUVRE : son nom porte un hachage de build. */
async function trouveCss(base) {
  const stop = AbortSignal.timeout(DELAI_MS);
  try {
    const html = await (await fetch(base + '/', { signal: stop })).text();
    const m = html.match(/href="([^"]+\.css[^"]*)"/i);
    if (!m) return null;
    return m[1].startsWith('http') ? m[1] : base + (m[1].startsWith('/') ? '' : '/') + m[1];
  } catch { return null; }
}

/** L'exception qui couvre (zone, cible, en-tête) — ou rien. */
const couverte = (zone, cle, entete) => EXCEPTIONS.find((e) =>
  e.cible === cle && e.zones.includes(zone) &&
  (e.entetes === '*' || e.entetes.includes(entete)));

/** Juge UNE valeur servie contre sa règle déclarée. */
function juge(nom, regle, valeur) {
  if (valeur === undefined) return { ok: false, dit: 'absent' };
  const v = String(valeur).trim();
  if (regle.genre === 'egal') {
    return v.toLowerCase() === String(regle.valeur).toLowerCase()
      ? { ok: true, dit: v }
      : { ok: false, dit: `« ${v} » au lieu de « ${regle.valeur} »` };
  }
  if (regle.genre === 'plancher-max-age') {
    const bas = v.toLowerCase();
    // 🔴 Les directives irréversibles se cherchent dans la valeur SERVIE.
    //   Les déclarer interdites ne les empêche pas d'être posées au bord ; seul
    //   un regard sur la production le dit — et il faut qu'il le dise le jour
    //   même, parce qu'on ne revient pas d'un `preload`.
    for (const mauvais of regle.interdits || []) {
      if (bas.includes(mauvais)) {
        return { ok: false, dit: `⛔ « ${mauvais} » SERVI (irréversible) — « ${v} »` };
      }
    }
    const m = bas.match(/max-age\s*=\s*(\d+)/);
    if (!m) return { ok: false, dit: `pas de max-age lisible dans « ${v} »` };
    const n = Number(m[1]);
    // ⭐ PLANCHER : il rougit si ça BAISSE, il se tait si ça monte.
    return n >= regle.plancher
      ? { ok: true, dit: `max-age=${n}${n > regle.plancher ? ' (au-dessus du plancher — pensez à relever le plancher)' : ''}` }
      : { ok: false, dit: `max-age=${n} < plancher ${regle.plancher} — LA VALEUR A BAISSÉ` };
  }
  return { ok: true, dit: v };
}

const exceptionsUtiles = new Set();

// ⚠️⚠️ CE COMPTEUR EST DISTINCT DE `indecidables`, ET LA DISTINCTION EST LE
//   POINT. `indecidables` compte « je n'ai pas pu regarder » (réseau muet).
//   Celui-ci compte « j'ai regardé DEUX FOIS et le bord m'a répondu deux
//   choses ». Les confondre ferait taire le second : un banc qui range une
//   contradiction du bord dans « non mesuré » a cessé de mesurer.
let deuxReponses = 0;

/** Une salve de `PASSAGES` requêtes sur une cible. Les 404 se refabriquent à
 *  chaque appel — jamais deux fois la même adresse, jamais un cache. */
async function salve(zone, cible, css) {
  let urls;
  if (cible.fabrique404) urls = Array.from({ length: PASSAGES }, () => url404(zone.base));
  else if (cible.decouvreCss) urls = Array(PASSAGES).fill(css);
  else urls = Array(PASSAGES).fill(zone.base + cible.chemin);

  const vus = [];
  for (const u of urls) {
    vus.push(await frappe(u));
    mesures++;
    await dodo(PAUSE_MS);
  }
  return vus.filter((v) => v.ok);
}

/** Les verdicts sont-ils du même avis ? ⛔ On compare `ok`, pas `dit` : deux
 *  `max-age` différents mais tous deux au-dessus du plancher sont d'accord sur
 *  ce qui compte ici (l'écart de valeur est signalé séparément). */
const unanime = (v) => v.length > 0 && v.every((x) => x.ok === v[0].ok);

for (const zone of ZONES) {
  console.log(`\n2. ${zone.nom} — production`);

  const css = await trouveCss(zone.base);
  let joignable = false;

  for (const cible of CIBLES) {
    if (cible.decouvreCss && !css) {
      indecis(`${zone.nom} · statique`, 'aucun `.css` trouvé sur l\'accueil — cible non mesurée');
      continue;
    }

    let bons = await salve(zone, cible, css);
    if (bons.length === 0) {
      // ⛔ Réseau muet sur cette cible : INDÉCIDABLE, jamais vert.
      indecis(`${zone.nom} · ${cible.cle}`,
        `aucun des ${PASSAGES} passages n'a abouti`);
      continue;
    }
    joignable = true;

    // ═══════════════════════════════════════════════════════════════════════
    // 🔴🔴⭐⭐⭐ LA SECONDE SALVE — *une mesure pas encore mûre et un vrai
    //   défaut se ressemblent, et ils sont l'inverse.*
    // ═══════════════════════════════════════════════════════════════════════
    // Ce banc tourne en CI, et la CI se déclenche SUR LE PUSH — donc pendant
    // que Coolify déploie et que la règle Cloudflare se propage. Une salve
    // partagée entre « présent » et « absent » a deux lectures opposées :
    //   ① la propagation n'est pas finie  → ça va se stabiliser tout seul ;
    //   ② le bord rend vraiment deux réponses → il faut le DIRE.
    // ⛔ TRANCHER SUR LA PREMIÈRE SALVE, C'EST TIRER À PILE OU FACE. C'est
    //   exactement ce qui a fait abandonner le lot 184 : retirer l'exception
    //   sans ce filet aurait rendu le banc rouge au tirage.
    // ⇒ On REJOUE, après une pause franche. Une mesure pas mûre se stabilise ;
    //   une bi-réponse persiste. Le second tirage n'est pas une seconde chance
    //   donnée au site : c'est ce qui SÉPARE les deux causes.
    // ⭐ Et il n'y a pas de troisième salve. Rejouer jusqu'à obtenir un
    //   résultat propre serait « réparer l'instrument à la place du défaut »
    //   avec de la patience au lieu d'une borne abaissée.
    const juges1 = Object.fromEntries(Object.entries(ENTETES_ATTENDUS)
      .map(([n, r]) => [n, bons.map((b) => juge(n, r, b.h[n]))]));
    const instables = Object.keys(juges1).filter((n) => !unanime(juges1[n]));

    let juges = juges1;
    let rejoue = false;
    if (instables.length) {
      note(`${zone.nom} · ${cible.cle} — ${instables.length} en-tête(s) partagé(s) sur ` +
        `${PASSAGES} passages (${instables.join(', ')}) ⇒ on REJOUE avant de conclure ` +
        '(propagation ou bord à deux réponses : les deux se ressemblent)');
      await dodo(PAUSE_MS * 4);
      const bons2 = await salve(zone, cible, css);
      if (bons2.length) {
        bons = bons2;
        rejoue = true;
        juges = Object.fromEntries(Object.entries(ENTETES_ATTENDUS)
          .map(([n, r]) => [n, bons2.map((b) => juge(n, r, b.h[n]))]));
      }
    }

    if (cible.fabrique404) {
      const codes = [...new Set(bons.map((b) => b.code))];
      verifie(`${zone.nom} · 404 — la page absente rend bien un 404`,
        codes.every((c) => c === 404), `codes vus : ${codes.join(', ')}`);
    }

    // En-tête par en-tête, sur les passages ABOUTIS de la salve retenue.
    for (const [nom, regle] of Object.entries(ENTETES_ATTENDUS)) {
      const exc = couverte(zone.nom, cible.cle, nom);
      const verdicts = juges[nom];
      const tousBons = verdicts.every((v) => v.ok);
      const dAccord = unanime(verdicts);

      // ── ⏸️ NI VERT NI ROUGE : LE BORD REND DEUX RÉPONSES ────────────────
      // ⛔ On ne tranche pas, et on ne se tait pas non plus. Dire « écart »
      //   accuserait Cloudflare d'un défaut qu'on n'a pas établi ; dire
      //   « conforme » signerait une sécurité qu'on n'a pas constatée.
      //   Le seul énoncé vrai est le troisième : *je vois deux réponses.*
      if (!dAccord) {
        deuxReponses++;
        indecidables++;
        const vus = verdicts.map((v, i) => `passage ${i + 1} : ${v.dit}`).join(' · ');
        console.log(`  ⏸️   ${zone.nom} · ${cible.cle} · ${nom} — LE BORD REND DEUX RÉPONSES`);
        console.log(`       ${rejoue ? 'après un second tirage complet' : 'salve unique'} — ${vus}`);
        console.log('       ⇒ ce n\'est PAS un verdict de conformité. Rejouer avec');
        console.log('         `--attendre` si une règle Cloudflare vient d\'être touchée ;');
        console.log('         sinon, deux nœuds du bord ne servent pas la même chose.');
        continue;
      }

      if (exc) {
        // ⭐⭐ L'EXCEPTION SE RETOURNE CONTRE ELLE-MÊME : si la cible porte
        //   maintenant l'en-tête, l'exception a survécu à sa cause et doit
        //   sauter. Un avertissement périmé protège un défaut futur en croyant
        //   protéger un défaut passé.
        // ⛔ MAIS ON NE LA DÉCLARE PÉRIMÉE QUE SUR UN AVIS UNANIME — le cas
        //   partagé est sorti plus haut. Révoquer une exception sur un tirage
        //   favorable, c'est retirer un garde-fou par chance.
        if (tousBons) {
          verifie(`${zone.nom} · ${cible.cle} · ${nom} — EXCEPTION PÉRIMÉE`, false,
            `l'en-tête est SERVI (${verdicts[0].dit}) alors qu'une exception le ` +
            `dispense. ⇒ retirer l'exception « ${exc.cible} » de ` +
            '`entetes_attendus.mjs` : elle masquerait sa disparition future.');
        } else {
          exceptionsUtiles.add(exc.cible);
        }
        continue;
      }

      const memeValeur = verdicts.every((v) => v.dit === verdicts[0].dit);
      verifie(`${zone.nom} · ${cible.cle} · ${nom}`, tousBons,
        tousBons
          ? verdicts[0].dit + (memeValeur ? '' : ' ⚠️ valeur INSTABLE entre les passages')
          : verdicts.map((v, i) => `passage ${i + 1} : ${v.dit}`).join(' · ') +
            (rejoue ? '\n       (constaté sur DEUX salves — ce n\'est pas une propagation)' : ''));
    }
  }
  if (joignable) zonesJoignables++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE CONTENU DE `robots.txt` A-T-IL SURVÉCU AU PRÉFIXAGE ?
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ CE § EST LA CONTREPARTIE DE L'EXCEPTION `robots`. On accepte que ce
// fichier n'ait pas d'en-têtes parce que Cloudflare le GÉNÈRE au bord. Mais
// « Cloudflare génère la réponse » veut aussi dire « Cloudflare peut manger le
// contenu du dépôt » — mesuré le 11/08 : il PRÉFIXE, il ne remplace pas.
// ⛔ UNE EXCEPTION SANS LE CONTRÔLE QUI BORNE SON RISQUE EST UN TROU AUTORISÉ.
//   Si un jour le préfixage devenait un remplacement, la ligne `Sitemap:`
//   disparaîtrait, Google perdrait le plan du site, et RIEN ne le dirait : le
//   build serait vert, les pages s'afficheraient, le trafic baisserait des
//   semaines plus tard sans cause lisible.
// ⭐ C'est « la véracité avant le SEO » appliquée à un fichier que personne ne
//   lit — donc exactement le profil qu'un banc doit couvrir.
console.log('\n3. le `robots.txt` servi porte-t-il encore le contenu du dépôt ?');
for (const zone of ZONES) {
  let corps = null;
  try {
    const stop = AbortSignal.timeout(DELAI_MS);
    const r = await fetch(`${zone.base}/robots.txt`, { method: 'GET', signal: stop });
    corps = await r.text();
    mesures++;
  } catch (e) {
    indecis(`${zone.nom} · robots.txt`, `illisible — ${e?.message || e}`);
    continue;
  }
  verifie(`${zone.nom} · robots.txt annonce le plan du site`,
    corps.includes(`Sitemap: ${zone.base}/sitemap.xml`),
    '⛔ sans cette ligne, les moteurs perdent le plan du site — et rien d\'autre ' +
    'que ce banc ne s\'en apercevrait');
  verifie(`${zone.nom} · robots.txt garde ses interdictions`,
    /^Disallow:\s*\/api\//m.test(corps),
    'la ligne du dépôt, pas celle que Cloudflare ajoute');
  // ⭐ Et le préfixage reste un PRÉFIXAGE : le contenu du dépôt vient APRÈS.
  //   Si l'ordre s'inversait, un `User-agent: *` de Cloudflare pourrait capter
  //   les règles du site — un fichier robots se lit par blocs, pas par lignes.
  const finCf = corps.indexOf('# END Cloudflare Managed Content');
  verifie(`${zone.nom} · le contenu du dépôt vient APRÈS le bloc Cloudflare`,
    finCf === -1 || corps.indexOf('Sitemap:') > finCf,
    finCf === -1
      ? 'aucun bloc Cloudflare détecté — le fichier vient entièrement du dépôt'
      : '⛔ un robots.txt se lit par blocs : du contenu placé avant la fin du ' +
        'bloc Cloudflare changerait de propriétaire');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES EXCEPTIONS ENCORE UTILES
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. les exceptions déclarées servent-elles encore ?');
if (EXCEPTIONS.length === 0) note('aucune exception déclarée.');
for (const e of EXCEPTIONS) {
  if (exceptionsUtiles.has(e.cible)) {
    note(`« ${e.cible} » sert encore (à revoir le ${e.revoirLe}) — ${e.pourquoi}`);
  } else if (zonesJoignables > 0) {
    // Elle n'a jamais servi : soit la cible n'a pas été mesurée, soit elle est
    // périmée — et le § 2 l'aura dit nommément dans ce second cas.
    note(`« ${e.cible} » n'a couvert aucun écart pendant ce passage.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. AUTO-CONTRÔLE — un banc qui n'a rien inspecté ne prouve rien
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ UN BANC SE JUGE SUR CE QU'IL LAISSE PASSER. Sans ce §, une panne DNS
// rendrait 0 mesure, 0 échec, et un « ✅ tout est vert » parfaitement faux.
console.log('\n5. auto-contrôle');

const attendues = ZONES.length * (CIBLES.length * PASSAGES + 1);
// ⚠️ `mesures` PEUT DÉPASSER `attendues`, ET C'EST LE SIGNE D'UNE SECONDE
//   SALVE — pas d'une anomalie. Écrire « 62 sur 32 prévues » sans le dire
//   ferait lire un débordement là où il y a un second tirage volontaire.
//   ⭐ C'est la borne BASSE qui protège ici : un banc qui a émis MOINS que
//   prévu n'a pas regardé partout, et c'est ça qu'il faut voir.
const rejeux = Math.max(0, mesures - attendues);
note(`${mesures} requête(s) émise(s) — ${Math.min(mesures, attendues)}/${attendues} prévue(s)` +
  (rejeux ? ` + ${rejeux} de seconde salve` : '') +
  ` · ${zonesJoignables}/${ZONES.length} zone(s) joignable(s)`);
if (mesures < attendues && zonesJoignables === ZONES.length) {
  note(`⚠️ ${attendues - mesures} requête(s) prévue(s) n'ont pas été émises — ` +
    'une cible a été sautée. Le verdict ne porte pas sur elle.');
}

if (zonesJoignables === 0) {
  console.log('\n⏸️  INDÉCIDABLE — aucune zone n\'a répondu.');
  console.log('    ⛔ Ce banc NE SE DÉCLARE PAS VERT sans mesure. Il ne dit pas');
  console.log('       « les en-têtes sont absents », il dit « je n\'ai pas pu regarder ».');
  console.log('       Rejouer quand le réseau revient ; sortie 2, pas 0.');
  process.exit(2);
}

if (zonesJoignables < ZONES.length) {
  console.log(`\n⚠️  ${ZONES.length - zonesJoignables} zone(s) non jointe(s) : le verdict` +
    ' ci-dessous ne porte QUE sur les zones mesurées.');
}

if (echecs) {
  console.log(`\n❌ ${echecs} ecart(s)` +
    (indecidables ? ` · ⏸️ ${indecidables} indécidable(s)` : ''));
  console.log('   ⛔ Les en-têtes vivent dans CLOUDFLARE (Zone → Rules → Overview →');
  console.log('      règle `en-tetes-securite`), PAS dans ce dépôt. Une règle par zone.');
  console.log('   ⛔ Ne « réparez » jamais ce banc en abaissant un plancher ou en');
  console.log('      ajoutant une exception : ce serait réparer l\'instrument à la place');
  console.log('      du défaut. Une exception se justifie par une CAUSE mesurée.');
  process.exit(1);
}

// ⏸️⏸️ UN BORD QUI REND DEUX RÉPONSES NE SE RANGE PAS DANS « VERT ».
//   ⛔ Sortie 0 ici, c'est `regle-banc-muet-ressemble-a-un-succes` : le banc
//   aurait VU la contradiction, l'aurait imprimée, et aurait quand même signé.
//   ⭐ Sortie 2 et pas 1 : « écart » accuserait Cloudflare d'un défaut établi.
//   Le run rougit — il doit rougir — mais il rougit en disant la vérité :
//   *je vois deux réponses*, et pas *l'en-tête est absent*.
if (deuxReponses) {
  console.log(`\n⏸️  ${deuxReponses} en-tête(s) sur lesquels LE BORD REND DEUX RÉPONSES` +
    ' — constaté sur deux salves complètes, pas sur un tirage.');
  console.log('    ⛔ Ce n\'est ni un écart ni une conformité : c\'est une mesure qui');
  console.log('       ne conclut pas. Ne posez AUCUNE exception là-dessus avant');
  console.log('       d\'avoir la cause — une exception se justifie par une CAUSE.');
  console.log('    ⇒ Si une règle Cloudflare vient d\'être touchée : `--attendre`.');
  console.log('       Sinon : deux nœuds du bord ne servent pas la même chose.');
  process.exit(2);
}

if (indecidables && zonesJoignables < ZONES.length) {
  console.log(`\n⏸️  ${indecidables} indécidable(s) et une zone manquante — sortie 2.`);
  process.exit(2);
}

console.log(indecidables
  ? `\n✅ conforme sur tout ce qui a pu être mesuré · ⏸️ ${indecidables} cible(s) non mesurée(s)`
  : '\n✅ tout est vert');
process.exit(0);
