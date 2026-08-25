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

noeud.close();
console.log(echecs
  ? `\n❌ ${echecs} écart(s)\n`
  : '\n✅ la sonde de caisse est branchée, muette au repos, et elle ne fait attendre personne\n');
process.exit(echecs ? 1 : 0);
