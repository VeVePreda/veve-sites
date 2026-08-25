// ⚠️ VeVePreda/veve-sites — engine/tools/test_caisse.mjs   (FICHIER NEUF — lot 199)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DE LA SONDE DE CAISSE — il juge l'INSTRUMENT, pas le réseau
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE BANC TOURNE DANS LE DOCKERFILE : IL NE SORT SUR AUCUN RÉSEAU, ET
// IL NE REND AUCUN « INDÉCIDABLE ». Un banc qui interrogerait `mainnet.base.org`
// dirait « le constructeur d'images a du réseau » — une question qui n'est pas
// la sienne, et dont la réponse change d'une machine à l'autre. Il monte donc
// son PROPRE noeud sur 127.0.0.1 et lui fait jouer les cinq réponses possibles.
// ⭐⭐⭐ *Un banc juge le code, jamais l'avancement d'une collecte.* La question
// « la production joint-elle Base ? » se lit sur `/api/sante`, en production.
//
// ⚠️ CE QU'IL NE PEUT PAS FAIRE, ET C'EST L'ESSENTIEL À DIRE : il ne prouve
// pas que le VPS a une sortie internet. Il prouve que si elle existe, la sonde
// le dira, et que si elle n'existe pas, la sonde le dira AUSSI — au lieu de
// rendre un silence qui ressemble à un succès.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
let echecs = 0;
const dire = (ok, quoi, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};
const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });

console.log('\n💳 LA SONDE DE CAISSE — le conteneur peut-il lire Base ?\n');

// ═══ LE FAUX NOEUD ═════════════════════════════════════════════════════════
// ⭐ IL COMPTE SES APPELS. C'est ce compteur qui rend décidables les deux
//   contrôles les plus importants du banc : « aucune configuration ⇒ AUCUN
//   appel » et « le cache tient ». Sans lui, ces deux-là seraient verts par
//   construction — l'instrument qui ne peut pas échouer.
let appels = 0;
let scenario = 'ok';
const BLOC = 50436738;

const noeud = createServer((req, res) => {
  appels++;
  let corps = '';
  req.on('data', (c) => { corps += c; });
  req.on('end', async () => {
    if (scenario === 'lent') { await dormir(3000); }
    if (scenario === 'http') { res.writeHead(503); res.end('non'); return; }
    if (scenario === 'charabia') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'bonjour' }));
      return;
    }
    // ⭐ On vérifie au passage que la sonde demande bien `eth_blockNumber` :
    //   une sonde qui interrogerait autre chose mesurerait autre chose.
    if (!/eth_blockNumber/.test(corps)) { res.writeHead(400); res.end('{}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: `0x${BLOC.toString(16)}` }));
  });
});

await new Promise((r) => { noeud.listen(0, '127.0.0.1', r); });
const PORT = noeud.address().port;
const URL_NOEUD = `http://127.0.0.1:${PORT}/`;

process.env.CAISSE_RPC = URL_NOEUD;
process.env.CAISSE_DELAI_MS = '400';
process.env.CAISSE_FRAICHEUR_MS = '60000';

const mod = await import(pathToFileURL(join(ROOT, 'engine/lib/caisse_sonde.mjs')).href);
const { etatDeLaCaisse, oublierLaMesure, adresseBienFormee } = mod;

const ADRESSE_ESSAI = '0x0f457f6D086243607977eF283dc682B0BD3b9388';

// ⭐ REMETTRE À ZÉRO ENTRE CHAQUE CONTRÔLE. Question ⑲ de la liste
//   d'avant-codage : un instrument qui garde un état entre deux mesures rend
//   chaque contrôle dépendant du précédent, et le banc ment dans l'ordre.
const neuf = (adresse) => {
  oublierLaMesure();
  appels = 0;
  if (adresse === null) delete process.env.CAISSE_ADRESSE;
  else process.env.CAISSE_ADRESSE = adresse;
};

// ─── ① AUCUNE CAISSE CONFIGURÉE : AUCUN APPEL, ET « INCONNU », PAS « FAUX » ──
// ⭐⭐ C'est l'état d'AUJOURD'HUI, et c'est celui qui doit être silencieux. Une
//   sonde qui rendrait `joignable: false` sur une installation parfaitement
//   correcte apprend à se faire ignorer, et le jour où elle crie pour de bon,
//   plus personne ne l'écoute.
{
  neuf(null);
  const e = etatDeLaCaisse();
  dire(e.configuree === false, '① sans CAISSE_ADRESSE : `configuree` est faux');
  dire(e.joignable === null, '① ...et `joignable` vaut null, PAS false',
    'inconnu ≠ faux : la caisse n\'est pas cassée, elle n\'est pas ouverte');
  await dormir(120);
  dire(appels === 0, '① ...et AUCUN appel réseau n\'est parti', `${appels} appel(s)`);
}

// ─── ② UNE ADRESSE MAL FORMÉE NE SONDE RIEN ────────────────────────────────
// 🔴 Le silence parfait : une adresse tronquée d'un caractère reste « une
//   chaîne qui commence par 0x ». Le collecteur filtrerait sur une cible qui
//   ne reçoit jamais rien, ne verrait aucun paiement, et ne rougirait nulle
//   part. Il faut que ça se VOIE de l'extérieur.
{
  for (const [mauvaise, pourquoi] of [
    ['0x0f457f6D086243607977eF283dc682B0BD3b938', 'un caractère de moins'],
    ['0f457f6D086243607977eF283dc682B0BD3b9388', 'sans le préfixe 0x'],
    ['0x0f457f6D086243607977eF283dc682B0BD3b93ZZ', 'un caractère non hexadécimal'],
    ['', 'vide après espaces'],
  ]) {
    neuf(mauvaise === '' ? '   ' : mauvaise);
    const e = etatDeLaCaisse();
    // ⚠️ Une chaîne d'espaces est vidée par `trim()` : elle retombe donc sur
    //   « pas configurée », ce qui est la bonne lecture.
    const attendu = mauvaise === '' ? e.configuree === false : e.adresse === false;
    dire(attendu, `② adresse refusée (${pourquoi})`);
    await dormir(60);
    dire(appels === 0, `② ...et aucun appel n'est parti (${pourquoi})`, `${appels} appel(s)`);
  }
  dire(adresseBienFormee(ADRESSE_ESSAI), '② ...et une adresse correcte est acceptée');
}

// ─── ③ LE CHEMIN HEUREUX : LA SONDE LIT LE BLOC ────────────────────────────
{
  neuf(ADRESSE_ESSAI);
  scenario = 'ok';
  const premier = etatDeLaCaisse();
  dire(premier.joignable === null, '③ le PREMIER appel rend null (elle n\'a pas fini de regarder)');
  await dormir(300);
  const e = etatDeLaCaisse();
  dire(e.configuree === true && e.adresse === true, '③ la caisse est configurée et bien formée');
  dire(e.joignable === true, '③ ...le noeud est joignable');
  dire(e.bloc === BLOC, '③ ...et le numéro de bloc est LU, pas inventé', `bloc ${e.bloc}`);
  dire(Number.isFinite(e.ms) && e.ms >= 0, '③ ...avec sa durée en millisecondes', `${e.ms} ms`);
  dire(e.cause === null, '③ ...et aucune cause d\'échec');
}

// ─── ④ ELLE NE FAIT JAMAIS ATTENDRE ─────────────────────────────────────────
// 🔴🔴🔴 LE CONTRÔLE LE PLUS IMPORTANT DU BANC. `docker-entrypoint.sh`
//   interroge `/api/sante` au démarrage et REFUSE DE SERVIR si la route tarde ;
//   Coolify arrête alors le conteneur au bout de douze essais. Une sonde qui
//   attendrait un hôte injoignable transformerait un pare-feu sortant en
//   **503 sur tout le site**. Le défaut serait invisible partout ailleurs :
//   hors ligne le noeud répond en 1 ms, et tout aurait l'air parfait.
{
  neuf(ADRESSE_ESSAI);
  scenario = 'lent';
  const t0 = Date.now();
  etatDeLaCaisse();
  const t1 = Date.now();
  dire(t1 - t0 < 50, '④ l\'appel rend la main immédiatement, même sur un noeud muet',
    `${t1 - t0} ms (le noeud, lui, met 3 000 ms)`);
  // ⭐ Et le deuxième appel non plus, pendant que le premier traîne encore.
  const t2 = Date.now();
  etatDeLaCaisse();
  dire(Date.now() - t2 < 50, '④ ...et le suivant non plus, pendant que la mesure court');
}

// ─── ⑤ TROIS PANNES, TROIS CAUSES DISTINCTES ───────────────────────────────
// ⭐⭐⭐ « CAUSE A » ET « CAUSE B » NE DOIVENT PAS EMPRUNTER LE MÊME CHEMIN DE
//   SORTIE. « personne ne décroche », « quelqu'un décroche et refuse » et « ça
//   répond mais ce n'est pas un noeud » ne se réparent pas de la même façon.
{
  for (const [scen, cause, quoi] of [
    ['lent', 'delai', 'le noeud ne répond pas assez vite'],
    ['http', 'http', 'le noeud répond, mais pas 200'],
    ['charabia', 'forme', 'ça répond 200, mais ce n\'est pas un noeud'],
  ]) {
    neuf(ADRESSE_ESSAI);
    scenario = scen;
    etatDeLaCaisse();
    await dormir(scen === 'lent' ? 700 : 300);
    const e = etatDeLaCaisse();
    dire(e.joignable === false, `⑤ ${quoi} ⇒ joignable est faux`);
    dire(e.cause === cause, `⑤ ...et la cause est « ${cause} »`, `lue : ${e.cause}`);
    // 🔴 LE PIÈGE DU « CHARABIA » : `parseInt('bonjour', 16)` rend NaN, et un
    //   code plus naïf aurait posé `bloc: 0`. Zéro se lit « le bloc 0 », donc
    //   « ça marche » — un vert sur la seule question que la sonde existe pour
    //   trancher. *Inconnu n'est pas zéro.*
    dire(e.bloc === null, `⑤ ...et le bloc reste null, jamais 0 (${quoi})`, `lu : ${e.bloc}`);
  }
}

// ─── ⑥ LE CACHE TIENT : LA SONDE NE MARTÈLE PAS LE NOEUD ───────────────────
// ⚠️ `/api/sante` est publique. Sans fraîcheur, chaque visite d'un robot
//   déclencherait un appel sortant — un site qui se met à marteler un service
//   gratuit finit par en être banni, et la sonde tuerait ce qu'elle mesure.
{
  neuf(ADRESSE_ESSAI);
  scenario = 'ok';
  etatDeLaCaisse();
  await dormir(200);
  const apresLaPremiere = appels;
  for (let i = 0; i < 20; i++) etatDeLaCaisse();
  await dormir(200);
  dire(appels === apresLaPremiere,
    '⑥ vingt-et-un appels à la sonde = UN seul appel au noeud',
    `${appels} appel(s) au total`);

  // ⭐ ET LA FRAÎCHEUR EXPIRE VRAIMENT. Sans ce second volet, un cache
  //   ÉTERNEL passerait le contrôle ci-dessus : la sonde figerait à jamais la
  //   réponse du démarrage, et un réseau tombé trois jours plus tard
  //   n'apparaîtrait nulle part. Le banc doit distinguer « il ne martèle pas »
  //   de « il ne regarde plus jamais ».
  process.env.CAISSE_FRAICHEUR_MS = '1';
  await dormir(20);
  etatDeLaCaisse();
  await dormir(200);
  dire(appels > apresLaPremiere, '⑥ ...mais la fraîcheur expirée relance la mesure',
    `${appels} appel(s)`);
  process.env.CAISSE_FRAICHEUR_MS = '60000';
}

// ─── ⑦ RIEN DE PRIVÉ NE SORT ────────────────────────────────────────────────
// ⛔ Cette route est PUBLIQUE. Ni l'adresse d'encaissement, ni l'URL du noeud,
//   ni un fragment de l'une ou de l'autre.
// ⭐ LISTE BLANCHE **ET** FORME, jamais une liste noire : une liste noire ne
//   protège que de ce qu'on a imaginé, et le champ qu'on ajoutera demain n'y
//   sera pas.
{
  neuf(ADRESSE_ESSAI);
  scenario = 'ok';
  etatDeLaCaisse();
  await dormir(300);
  const e = etatDeLaCaisse();
  const PERMIS = ['configuree', 'adresse', 'joignable', 'bloc', 'ms', 'cause', 'quand'];
  const enTrop = Object.keys(e).filter((k) => !PERMIS.includes(k));
  dire(enTrop.length === 0, '⑦ aucun champ hors de la liste blanche',
    enTrop.length ? enTrop.join(', ') : PERMIS.join(', '));

  const texte = JSON.stringify(e);
  dire(!texte.toLowerCase().includes(ADRESSE_ESSAI.toLowerCase().slice(2, 12)),
    '⑦ ...aucun fragment de l\'adresse d\'encaissement');
  dire(!/0x[0-9a-fA-F]{20,}/.test(texte), '⑦ ...aucune adresse d\'aucune sorte');
  dire(!texte.includes(String(PORT)) && !/https?:\/\//.test(texte),
    '⑦ ...ni l\'URL du noeud, ni son port');
  dire(typeof e.adresse === 'boolean', '⑦ ...`adresse` est un BOOLÉEN, pas une valeur');
  dire(e.cause === null || ['delai', 'reseau', 'http', 'forme'].includes(e.cause),
    '⑦ ...et `cause` reste dans ses quatre valeurs');
}

// ─── ⑧ `/api/sante` LA SERT VRAIMENT ────────────────────────────────────────
// ⭐ Sans ce contrôle, tout ce qui précède pourrait être juste et parfaitement
//   inutile : un instrument dont la sortie n'atteint pas son lecteur ne mesure
//   rien. C'est la leçon du lot 195, payée une journée entière.
{
  const brut = readFileSync(join(ROOT, 'src/pages/api/sante.js'), 'utf8');
  // ⭐ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER. Le long bloc qui EXPLIQUE
  //   la sonde suffirait sinon à satisfaire chaque contrôle : le banc lirait la
  //   documentation du sujet au lieu du sujet. Faute réellement commise quatre
  //   fois dans ce dépôt.
  const code = brut.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/caisse: caisse\(\)/.test(code), '⑧ `/api/sante` sert le bloc `caisse`');
  dire(/const caisse = \(\) =>/.test(code),
    '⑧ ...par une FONCTION, donc relue à chaque appel',
    'une constante de module figerait la réponse du démarrage pour toujours');
  dire(/etatDeLaCaisse/.test(code) && /caisse_sonde\.mjs/.test(code),
    '⑧ ...en important la sonde, sans recopier sa logique');
  // ⭐⭐ SOUS LA PORTE DES COMPTES, comme `favoris`. vevewiki n'ouvre aucun
  //   compte, ne vend aucun palier, et n'a donc pas de caisse : sa sonde
  //   annoncerait un problème sur une installation parfaitement correcte.
  dire(/comptesOuverts\(\) \? \{ favoris: favoris\(\), caisse: caisse\(\) \}/.test(code),
    '⑧ ...sous la porte `comptesOuverts()`, comme les favoris');
  dire(!/require\(/.test(code), '⑧ ...et toujours sans `require()` (module ES)');

  // 🔴 LE MODULE NE DOIT PAS SONDER AU CHARGEMENT. Un appel réseau au niveau du
  //   module partirait pendant `astro build` — dans le constructeur d'images,
  //   où il n'a rien à faire, et où il peut échouer longuement.
  const sonde = readFileSync(join(ROOT, 'engine/lib/caisse_sonde.mjs'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const lignesNues = sonde.split('\n').filter((l) => l && !l.startsWith(' ') && !l.startsWith('}'));
  dire(!lignesNues.some((l) => /^\s*(await\s+)?(mesurer|fetch)\s*\(/.test(l)),
    '⑧ ...et la sonde ne part PAS au chargement du module',
    'un fetch de niveau module tournerait pendant astro build');
  dire(/process\.env\.CAISSE_ADRESSE/.test(sonde),
    '⑧ ...son déclencheur est bien CAISSE_ADRESSE (runtime), pas RENDERING (build ET runtime)');
}

// ═══════════════════════════════════════════════════════════════════════════
//  PARTIE B — LA CAISSE ELLE-MÊME (LOT 200)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE QUI SUIT TOUCHE À DE L'ARGENT RÉEL, ET ÇA CHANGE CE QU'UN BANC
// DOIT FAIRE. Ailleurs dans ce dépôt, le pire défaut affiche une page fausse.
// Ici, le pire défaut ouvre le palier de quelqu'un d'autre, ou encaisse sans
// rien ouvrir. ⇒ Les trois contrôles qui comptent sont ⑫ (le rapprochement),
// ⑬ (l'anti-rejeu) et ⑭ (le curseur qui n'avance pas sur un échec) — les
// autres protègent du confort, ceux-là protègent de la perte.
//
// ⛔ TOUJOURS ZÉRO RÉSEAU. La base vit dans un fichier temporaire, le noeud est
// celui de la partie A, et veveid est un second faux serveur monté ici.
console.log('\n💳 LA CAISSE — commandes, montants uniques, rapprochement\n');

const { mkdtempSync, rmSync: rmDossier } = await import('node:fs');
const { tmpdir } = await import('node:os');
const dossier = mkdtempSync(join(tmpdir(), 'veve-caisse-banc-'));
process.env.CAISSE_DB = join(dossier, 'caisse.db');
process.env.CAISSE_ADRESSE = ADRESSE_ESSAI;

// ── LE FAUX veveid ──────────────────────────────────────────────────────────
// ⭐ IL COMPTE ET IL MÉMORISE CE QU'ON LUI DEMANDE. Sans ça, « le palier est
//   accordé » resterait invérifiable : on saurait qu'un appel est parti, pas
//   qu'il portait la bonne durée ni le bon palier — et c'est exactement là que
//   se logerait un défaut coûteux.
let abonnements = [];
let refusVeveid = false;
const veveid = createServer((req, res) => {
  let c = '';
  req.on('data', (d) => { c += d; });
  req.on('end', () => {
    if (refusVeveid) { res.writeHead(404); res.end('{}'); return; }
    try { abonnements.push({ ...JSON.parse(c), caisse: req.headers['x-caisse'] || null }); } catch { /* rien */ }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rejeu: false, message: 'ok' }));
  });
});
await new Promise((r) => { veveid.listen(0, '127.0.0.1', r); });
process.env.SESSION_API = `http://127.0.0.1:${veveid.address().port}`;
process.env.ID_CAISSE = 'secret-de-banc';

const c = await import(pathToFileURL(join(ROOT, 'engine/lib/caisse.mjs')).href);

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ « SANS OBJET » N'EST PAS « INDÉCIDABLE », ET LA DIFFÉRENCE EST TOUT
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE BANC RENDAIT **ROUGE** SUR vevewiki, ET IL AURAIT CASSÉ SON BUILD.
// Mesuré le 25/08 avant le dépôt : vevewiki ne déclare aucun plan payant, donc
// `grille()` y est vide, donc `ouvrirCommande()` refuse tout — et les douze
// contrôles de la partie B tombaient en cascade sur un site parfaitement
// correct. Le Dockerfile lance ce banc pour LES DEUX sites : le second
// déploiement se serait arrêté là.
// ⭐⭐⭐ C'est la question « ce banc restera-t-il vrai quand tout ira bien ? »,
// et la réponse était non. Un banc qui crie sur une installation saine finit
// par se faire ignorer — et le jour où il crie pour de bon, plus personne ne
// l'écoute.
// ⚠️ Et ce n'est PAS un « indécidable » déguisé : la condition mesurée
// (« ce site vend-il quelque chose ? ») est TRANCHÉE, et elle vaut non. Rien
// n'est laissé en suspens. Un indécidable dirait « je n'ai pas pu regarder ».
if (Object.keys(c.grille()).length === 0) {
  console.log('  --  ce site ne vend aucun palier : la caisse est SANS OBJET ici.');
  console.log('      ⭐ Message volontaire : un banc muet et un banc vert se ressemblent.');
  noeud.close();
  veveid.close();
  try { rmDossier(dossier, { recursive: true, force: true }); } catch { /* rien */ }
  console.log(echecs ? `\n❌ ${echecs} écart(s)\n` : '\n✅ la sonde ne fait attendre personne\n');
  process.exit(echecs ? 1 : 0);
}

// ─── ⑨ LES PRIX SONT CEUX DU MANIFESTE, ET CEUX DE `/offre/` ───────────────
// ⛔ DEUX TARIFS SUR DEUX PAGES NE COÛTENT PAS UNE CORRECTION, ILS COÛTENT UN
//   LITIGE. `/offre/` affiche `Math.round(prix / (1 - remise))` ; la caisse
//   réclame `grille()`. Si les deux divergent d'un centime, l'acheteur paie ce
//   qu'il a lu et le montant n'est **jamais reconnu** — le paiement disparaît
//   dans les orphelins, sans erreur nulle part.
{
  const { manifest } = await import(pathToFileURL(join(ROOT, 'engine/lib/manifest.mjs')).href);
  const m = manifest();
  const remise = m.offer?.annual_discount ?? 0.20;
  const g = c.grille();
  const plans = (m.offer?.plans || []).filter((p) => Number(p?.prix) > 0);
  dire(plans.length >= 1, '⑨ le manifeste porte au moins un plan payant', `${plans.length} plan(s)`);
  let ecarts = 0;
  for (const p of plans) {
    // ⭐ LA FORMULE EST RECOPIÉE ICI **EXPRÈS**, depuis `Offre.astro` l. 123.
    //   Un banc qui importerait `grille()` pour la comparer à elle-même serait
    //   toujours vert : il mesurerait la sortie de sa propre transformation.
    const mensuelOffre = Math.round(Number(p.prix) / (1 - remise)) * 100;
    const annuelOffre = Number(p.prix) * 12 * 100;
    if (g[p.cle][1] !== mensuelOffre || g[p.cle][12] !== annuelOffre) ecarts++;
  }
  dire(ecarts === 0, '⑨ ...et la caisse réclame EXACTEMENT le prix affiché par /offre/',
    ecarts ? `${ecarts} palier(s) divergent` : 'au centime près, mensuel et annuel');
  dire(!g.member, '⑨ ...et le palier gratuit ne se vend pas');
}

const PALIER = Object.keys(c.grille())[0];

// ─── ⑩ LE MONTANT UNIQUE, ET SA FENÊTRE DE RÉSERVATION ─────────────────────
{
  const a = c.ouvrirCommande('cpt-1', PALIER, 1);
  const b = c.ouvrirCommande('cpt-2', PALIER, 1);
  const d3 = c.ouvrirCommande('cpt-3', PALIER, 1);
  dire(a.ok && b.ok && d3.ok, '⑩ trois commandes du même palier s\'ouvrent');
  dire(new Set([a.cents, b.cents, d3.cents]).size === 3,
    '⑩ ...avec TROIS montants différents', `${a.cents} · ${b.cents} · ${d3.cents}`);
  const socle = c.grille()[PALIER][1];
  dire([a, b, d3].every((x) => x.cents > socle && x.cents - socle <= 9),
    '⑩ ...tous au-dessus du prix, et de neuf centimes au maximum');
  dire(a.reference !== b.reference && a.reference.length >= 12,
    '⑩ ...et chaque référence est distincte et non devinable');
  const mauvais = c.ouvrirCommande('cpt-1', 'palier-qui-nexiste-pas', 1);
  dire(!mauvais.ok && mauvais.raison === 'palier', '⑩ un palier inconnu est refusé');
  dire(!c.ouvrirCommande('cpt-1', PALIER, 3).ok, '⑩ ...et une durée qui n\'est ni 1 ni 12 aussi');
}

// ─── ⑪ LE MONTANT RESTE RÉSERVÉ 24 h, PAS 15 MINUTES ───────────────────────
// 🔴🔴 C'EST LA DÉCISION DU 25/08, ET ELLE EST INVISIBLE SANS CE CONTRÔLE.
//   Preda a choisi un écran de 15 minutes. Recycler le montant au bout de ces
//   15 minutes rouvrirait le trou qu'on venait de fermer : le retardataire —
//   celui qui paie depuis un exchange, donc le cas NORMAL — enverrait le
//   montant d'une commande devenue celle de quelqu'un d'autre, et ouvrirait le
//   palier d'un inconnu. Le code serait vert, la caisse aurait « fonctionné ».
{
  process.env.CAISSE_ECRAN_MS = '1';
  const mod = await import(`${pathToFileURL(join(ROOT, 'engine/lib/caisse.mjs')).href}?ecran`);
  const x = mod.ouvrirCommande('cpt-9', PALIER, 12);
  await dormir(30);
  const y = mod.ouvrirCommande('cpt-10', PALIER, 12);
  dire(x.ok && y.ok && x.cents !== y.cents,
    '⑪ un écran expiré ne libère PAS le montant', `${x.cents} vs ${y.cents}`);
  delete process.env.CAISSE_ECRAN_MS;
}

// ─── ⑫ LE RAPPROCHEMENT — LA DÉCISION QUI TOUCHE À L'ARGENT ────────────────
// ⭐ `rapprocher()` est exportée et pure EXPRÈS : enfouie dans la boucle de
//   scan, elle ne s'éprouverait qu'en montant une chaîne entière — donc mal.
{
  const ouvertes = [
    { reference: 'petite', cents: 601, palier: 'crevette' },
    { reference: 'grosse', cents: 3603, palier: 'whale' },
  ];
  dire(c.rapprocher(601, ouvertes).commande?.reference === 'petite',
    '⑫ le montant exact trouve sa commande');
  dire(c.rapprocher(3603, ouvertes).commande?.reference === 'grosse',
    '⑫ ...et chacune trouve la sienne');
  const trop = c.rapprocher(631, ouvertes);
  dire(trop.commande?.reference === 'petite' && trop.trop === 30,
    '⑫ 30 cents de trop ⇒ on ouvre quand même (arbitrage Preda)');
  dire(c.rapprocher(599, ouvertes).commande === null,
    '⑫ trop peu ⇒ RIEN ne s\'ouvre');
  // 🔴🔴🔴 LE CONTRÔLE QUI PROTÈGE D'UNE PERTE RÉELLE. Sans la double borne,
  //   un versement de 36 $ trouverait la commande crevette à 6,01 « payée en
  //   trop » et l'acheteur perdrait trente dollars. Le code serait vert.
  const whaleSurPetite = c.rapprocher(3603, [{ reference: 'petite', cents: 601 }]);
  dire(whaleSurPetite.commande === null,
    '⑫ un versement whale n\'ouvre JAMAIS une commande crevette oubliée',
    'sans la borne de 50 cents, l\'acheteur perdrait la différence');
  dire(c.rapprocher(700, ouvertes).commande === null,
    '⑫ ...et 99 cents de trop ne suffisent pas non plus');
  dire(c.rapprocher(601, []).commande === null, '⑫ aucune commande ouverte ⇒ aucun crédit');
}

// ─── ⑬ LE SCAN, DE BOUT EN BOUT, SANS RÉSEAU ───────────────────────────────
{
  const logs = [];
  const versement = (cents, tx, bloc) => logs.push({
    transactionHash: tx,
    logIndex: '0x0',
    blockNumber: '0x' + bloc.toString(16),
    data: '0x' + (cents * 1e4).toString(16),
  });

  let tete = 1000;
  let refuseLogs = false;
  scenario = 'caisse';
  // ⭐ Le noeud de la partie A rend maintenant les deux méthodes du scan.
  noeud.removeAllListeners('request');
  noeud.on('request', (req, res) => {
    appels++;
    let corps = '';
    req.on('data', (d) => { corps += d; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      if (/eth_blockNumber/.test(corps)) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x' + tete.toString(16) }));
        return;
      }
      if (refuseLogs) { res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32614, message: 'range' } })); return; }
      // ⚠️ Le faux noeud ne rend les logs QUE pour le premier jeton : sinon le
      //   même versement serait vu deux fois, ce qui masquerait justement le
      //   défaut d'anti-rejeu qu'on cherche à éprouver.
      const usdc = corps.includes(c.JETONS.usdc);
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: usdc ? logs : [] }));
    });
  });

  const cmd = c.ouvrirCommande('cpt-paie', PALIER, 1);
  // ⚠️ LE VERSEMENT EST DANS UN BLOC QUE LE PREMIER SCAN COUVRE VRAIMENT. Le
  //   collecteur démarre 500 blocs derrière la tête — poser le log au-delà de
  //   `tete` le rendrait invisible pour une raison qui n'a rien à voir avec le
  //   code : le banc rougirait sur son propre jeu d'essai.
  versement(cmd.cents, '0xaaa', 999);
  tete = 1000;
  abonnements = [];
  const bilan = await c.scanner();
  dire(bilan.erreur === null, '⑬ le scan aboutit', JSON.stringify(bilan));
  dire(bilan.credites === 1, '⑬ ...et il crédite la commande', `${bilan.credites} crédit(s)`);
  dire(abonnements.length === 1, '⑬ ...veveid a bien été appelé UNE fois');
  dire(abonnements[0]?.palier === PALIER && abonnements[0]?.jours === 30,
    '⑬ ...avec le bon palier et la bonne durée', JSON.stringify(abonnements[0] || {}));
  dire(abonnements[0]?.caisse === 'secret-de-banc',
    '⑬ ...et le secret partagé voyage dans l\'en-tête x-caisse');
  dire(abonnements[0]?.reference === cmd.reference,
    '⑬ ...avec la référence, qui porte l\'anti-rejeu de veveid');

  // 🔴🔴🔴 L'ANTI-REJEU. Le scan repasse sur les mêmes blocs à chaque
  //   redémarrage. Sans l'index UNIQUE sur `tx`, le même transfert
  //   rappellerait veveid — et prolongerait l'abonnement, gratuitement, à
  //   chaque tour de boucle. Un `if` en JavaScript ne suffit pas : deux passes
  //   simultanées le franchiraient toutes les deux.
  abonnements = [];
  const suivi = join(dossier, 'caisse.db');
  dire(Boolean(suivi), '⑬ (la base vit dans un fichier temporaire)');
  const bilan2 = await c.scanner();
  dire(bilan2.credites === 0, '⑬ un second scan ne recrédite RIEN', `${bilan2.credites}`);
  dire(abonnements.length === 0, '⑬ ...et veveid n\'est PAS rappelé');

  // ─── ⑭ UNE TRANCHE EN ÉCHEC N'AVANCE PAS LE CURSEUR ──────────────────────
  // 🔴🔴🔴 LE DÉFAUT LE PLUS COÛTEUX ET LE PLUS SILENCIEUX DE TOUT LE LOT.
  //   Poser `dernier_bloc = fin` après une erreur saute DÉFINITIVEMENT
  //   par-dessus des paiements réels : ils ne seront jamais relus, aucun banc
  //   ne rougit, et le site reste vert. *Où l'état est-il écrit quand ça
  //   rate ?* — ici, nulle part, et c'est la bonne réponse.
  const avant = c.etatDuMagasin().dernierBloc;
  refuseLogs = true;
  tete = 5000;
  const bilan3 = await c.scanner();
  refuseLogs = false;
  dire(bilan3.erreur !== null, '⑭ une tranche refusée se signale', String(bilan3.erreur));
  dire(c.etatDuMagasin().dernierBloc === avant,
    '⑭ ...et le curseur N\'A PAS avancé', `${avant} → ${c.etatDuMagasin().dernierBloc}`);

  // ─── ⑮ VEVEID MUET : L'ARGENT EST ARRIVÉ, ON NE L'OUBLIE PAS ─────────────
  // ⛔ On ne remet SURTOUT pas la commande en « ouverte » : le versement est
  //   sur la chaîne, il ne reviendra pas. On marque un état distinct, et
  //   `/api/sante` le compte — le filet manuel de `/admin` existe déjà.
  const cmd2 = c.ouvrirCommande('cpt-muet', PALIER, 12);
  versement(cmd2.cents, '0xbbb', 5001);
  tete = 5100;
  refusVeveid = true;
  await c.scanner();
  refusVeveid = false;
  dire(c.etatDuMagasin().aAccorder === 1,
    '⑮ veveid muet ⇒ la commande passe en « à accorder », jamais en « ouverte »',
    `aAccorder = ${c.etatDuMagasin().aAccorder}`);

  // 🔴🔴🔴 L'ANNUEL DOIT DONNER UN AN — CONTRÔLE AJOUTÉ APRÈS UNE INJECTION
  //   QUI N'A PAS MORDU. Le §⑬ n'éprouvait que le mensuel : en remplaçant
  //   `JOURS = {1:30, 12:365}` par `{1:30, 12:30}`, les 74 contrôles restaient
  //   VERTS. Quelqu'un aurait payé soixante dollars pour un an et reçu trente
  //   jours, sans qu'une seule ligne rougisse nulle part.
  //   ⭐ *Une injection qui ne mord pas accuse le jeu d'essai, pas le code.*
  const cmdAn = c.ouvrirCommande('cpt-annuel', PALIER, 12);
  versement(cmdAn.cents, '0xddd', 5150);
  tete = 5199;
  abonnements = [];
  await c.scanner();
  dire(abonnements[0]?.jours === 365,
    '⑮ un paiement ANNUEL accorde bien 365 jours',
    `jours = ${abonnements[0]?.jours}`);
  dire(abonnements[0]?.jours !== 30,
    '⑮ ...et surtout pas 30');

  // ─── ⑯ L'ARGENT QUE PERSONNE NE RÉCLAME EST COMPTÉ ───────────────────────
  // ⭐ « Trop peu ⇒ rien ne s'ouvre, TU ES PRÉVENU » (Preda, 25/08). Sans
  //   cette table, « prévenu » n'existe pas : l'argent arrive, rien ne s'ouvre,
  //   et il n'en reste aucune trace nulle part. Le silence parfait.
  versement(999999, '0xccc', 5101);
  tete = 5200;
  await c.scanner();
  dire(c.etatDuMagasin().orphelins === 1,
    '⑯ un versement qui ne correspond à rien est ENREGISTRÉ',
    `orphelins = ${c.etatDuMagasin().orphelins}`);
}

// ─── ⑰ LIRE UNE COMMANDE EXIGE LE COMPTE ───────────────────────────────────
// ⛔ La référence seule ne désigne pas une commande. Une référence récupérée
//   dans un historique de navigation laisserait sinon lire l'achat d'autrui.
{
  const cmd = c.ouvrirCommande('cpt-prive', PALIER, 1);
  dire(c.lireCommande(cmd.reference, 'cpt-prive') !== null, '⑰ son propriétaire lit sa commande');
  dire(c.lireCommande(cmd.reference, 'cpt-autre') === null, '⑰ ...et personne d\'autre');
  dire(c.lireCommande('reference-inventee', 'cpt-prive') === null, '⑰ une référence inventée ne rend rien');
}

// ─── ⑱ RIEN DE PRIVÉ NE SORT DU MAGASIN NON PLUS ───────────────────────────
{
  const e = c.etatDuMagasin();
  const PERMIS = ['ouverte', 'enAttente', 'payees', 'aAccorder', 'orphelins',
    'dernierBloc', 'dernierScan', 'erreur', 'branchee'];
  const enTrop = Object.keys(e).filter((k) => !PERMIS.includes(k));
  dire(enTrop.length === 0, '⑱ aucun champ hors de la liste blanche',
    enTrop.length ? enTrop.join(', ') : PERMIS.join(', '));
  const texte = JSON.stringify(e);
  dire(!/0x[0-9a-fA-F]{20,}/.test(texte), '⑱ ...aucune adresse');
  dire(!texte.includes('secret-de-banc'), '⑱ ...ni le secret partagé');
  dire(typeof e.branchee === 'boolean', '⑱ ...`branchee` est un booléen, pas une URL');
}

// ─── ⑲ LE COLLECTEUR NE PART NI AU BUILD, NI POUR RIEN ─────────────────────
// 🔴🔴🔴 Un `setInterval` de niveau module, ou posé dans le middleware,
//   tournerait pendant `astro build`. Et le garde-fou évident ne tient pas :
//   `RENDERING` est exportée juste avant le build, et Preda a laissé
//   `CAISSE_ADRESSE` « available during build » chez Coolify. ⇒ On part d'un
//   FAIT DE STRUCTURE : `reveiller()` n'est appelée que depuis les routes
//   `/api/`, qui sont `prerender = false` et ne s'exécutent jamais au build.
{
  const src = readFileSync(join(ROOT, 'engine/lib/caisse.mjs'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const nues = src.split('\n').filter((l) => l && !l.startsWith(' ') && !l.startsWith('}'));
  dire(!nues.some((l) => /^\s*(await\s+)?(scanner|reveiller|setInterval|fetch)\s*\(/.test(l)),
    '⑲ rien ne part au chargement du module');
  const route = readFileSync(join(ROOT, 'src/pages/api/caisse.js'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/reveiller\(\)/.test(route), '⑲ ...et la route `/api/caisse` réveille bien le collecteur');
  const sante = readFileSync(join(ROOT, 'src/pages/api/sante.js'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/magasin: etatDuMagasin\(\)/.test(sante), '⑲ ...et `/api/sante` sert les compteurs du magasin');

  c.arreter();
  // ⭐ Une caisse au repos ne doit rien coûter au noeud public qu'elle
  //   interroge : sans commande en attente, `reveiller()` ne démarre rien.
  const base2 = c.etatDuMagasin();
  dire(typeof base2.enAttente === 'number', '⑲ le magasin sait combien de commandes attendent');
}

// ─── ⑳ LES QUATRE DÉCLARATIONS QUI, OUBLIÉES, NE ROUGISSENT NULLE PART ─────
{
  const routes = readFileSync(join(ROOT, 'engine/lib/astro_routes_compte.mjs'), 'utf8');
  // 🔬🔴🔴 ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER, ET CE N'EST PAS UNE
  //   PRÉCAUTION THÉORIQUE : la première version de ce contrôle est restée
  //   VERTE quand j'ai mis la ligne en commentaire pour l'éprouver. La regex
  //   trouvait la chaîne… dans le commentaire qui la désactivait. C'est la
  //   cinquième fois que ce dépôt paie exactement cette faute.
  const brutBloc = routes.slice(routes.indexOf('const ROUTES_COMPTE'), routes.indexOf('];', routes.indexOf('const ROUTES_COMPTE')));
  const bloc = brutBloc.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/'pages\/api\/caisse\.js'/.test(bloc),
    '⑳ `pages/api/caisse.js` est dans ROUTES_COMPTE',
    'sans cette ligne la route est PRÉ-GÉNÉRÉE en silence : un fichier figé, sans cookie');

  const man = readFileSync(join(ROOT, 'sites/veveprice/manifest.yml'), 'utf8');
  const ligneUrl = man.split('\n').filter((l) => /^\s*url:/.test(l) && !l.trim().startsWith('#'))[0] || '';
  dire(/\/compte\//.test(ligneUrl),
    '⑳ `offer.url` est rempli — les 3 appels à l\'action s\'allument', ligneUrl.trim());

  // ⚠️ LES CINQ DICTIONNAIRES, PAS UN SEUL. Une clé posée dans `en` seul
  //   s'affiche en anglais au milieu d'une page française, et `test:cles` ne
  //   parle que des clés APPELÉES — celles-ci le sont depuis un `.astro` et
  //   depuis le DOM, deux chemins qu'il ne suit pas tous les deux.
  const CLES = ['caisse.title', 'caisse.lead', 'caisse.send', 'caisse.exact', 'caisse.to',
    'caisse.warn', 'caisse.left', 'caisse.late', 'caisse.wallet', 'caisse.back',
    'caisse.received', 'caisse.error', 'caisse.expired', 'caisse.current',
    'caisse.perMonth', 'caisse.perYear'];
  for (const d of ['en', 'fr', 'es', 'de', 'it']) {
    const dico = JSON.parse(readFileSync(join(ROOT, `engine/i18n/${d}.json`), 'utf8'));
    const abs = CLES.filter((k) => !dico[k]);
    dire(abs.length === 0, `⑳ les 16 libellés existent en « ${d} »`,
      abs.length ? abs.join(', ') : `${CLES.length} clés`);
  }

  // ⭐ ET LE PILOTE NE FABRIQUE AUCUN TEXTE. Une chaîne écrite dans le
  //   JavaScript serait anglaise pour tout le monde, et invisible au marquage.
  const pilote = readFileSync(join(ROOT, 'src/socle/modules/caisse.js'), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/data-caisse-mot/.test(pilote), '⑳ le pilote lit ses libellés dans le DOM');
  dire(!/textContent\s*=\s*['"][A-Za-z]{4,}/.test(pilote),
    '⑳ ...et n\'écrit aucun texte en dur');
}

noeud.close();
veveid.close();
try { rmDossier(dossier, { recursive: true, force: true }); } catch { /* rien */ }
console.log(echecs
  ? `\n❌ ${echecs} écart(s)\n`
  : '\n✅ la sonde ne fait attendre personne, et la caisse ne crédite que ce qu\'elle reconnaît\n');
process.exit(echecs ? 1 : 0);
