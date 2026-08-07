// Preuve que la matrice des paliers d'acces fait ce qu'elle dit.
//
//     npm run test:acces
//
// CE QU'ON TESTE, ET POURQUOI.
//
// Le 20/07/2026, la « matrice a 3 paliers pilotee par le manifeste » etait une
// intention ecrite NULLE PART dans le code : le seul verrou du moteur etait
// `publication.public_points_max`, lu directement par dataset.mjs et rendu en
// dur dans Item.astro. Ce lot la cree pour de bon. Or il s'agit d'un
// refactoring A COMPORTEMENT CONSTANT : s'il change quoi que ce soit a l'ecran
// de VeVePrice, c'est un bug. Un tel bug est INVISIBLE — le site reste valide,
// rapide et coherent, il montre simplement autre chose. D'ou ce test.
//
// ⭐ CHAQUE ASSERTION EST D'ABORD PASSEE SUR UN CAS DEFECTUEUX (les blocs
// « auto-controle »). Un test incapable d'echouer ne prouve rien : c'est la
// lecon du 18/07, ou un audit avait declare « aucun lien casse » sur un
// repertoire vide.
//
// Chaque scenario tourne dans un PROCESSUS SEPARE : la matrice ET le jeu de
// donnees sont memoises pour la duree d'un build, donc deux manifestes
// differents ne peuvent pas coexister dans un meme processus.
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = mkdtempSync(join(tmpdir(), 'acces-'));
// ⭐⭐ NETTOYAGE DU TEMPORAIRE — audit d'hygiene du 03/08/2026.
// Ce banc creait un dossier par execution et n'en supprimait aucun. Mesure ce
// jour-la : 393 Mo dans /sessions/.../tmp, 26 dossiers `acces-*` et 21
// `adresses-comics-*`, et un `ENOSPC` en plein milieu d'un lot.
// ⚠️ INVISIBLE DANS DOCKER — conteneur neuf a chaque build. Visible sur une
// machine de dev, ou sur toute session un peu longue. C'est la meme famille que
// le `dist/` sali de `test_slugs`, deja corrige une fois : la lecon n'avait pas
// ete propagee aux voisins.
// ⛔ PAS UN `try/finally` : ce fichier appelle `process.exit()` a plusieurs
//    endroits, et un `finally` ne s'execute pas apres un exit explicite. Le
//    crochet `exit` de Node, si — c'est le SEUL point de sortie commun.
process.on('exit', () => { try { rmSync(base, { recursive: true, force: true }); } catch { /* rien a nettoyer */ } });
let echecs = 0;

function verifie(titre, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre} — ${detail}`);
  if (!ok) echecs++;
}

// ---------------------------------------------------------------------------
// Harnais : construit un site jetable a partir d'un manifeste BRUT et renvoie
// une empreinte du jeu de donnees produit.
// ---------------------------------------------------------------------------
const RUNNER = join(base, 'runner.mjs');
writeFileSync(RUNNER, `
import { dataset } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'dataset.mjs'))};
import { acces, porte, restant, auMoins, palierVisiteur, franchit } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'access.mjs'))};
const ds = await dataset();
const p = porte('price_history');
// Empreinte : tout ce qui pourrait bouger si la troncature changeait.
let sommePoints = 0, sommeTotal = 0, maxPoints = 0;
for (const i of ds.items) {
  sommePoints += i.points || 0;
  sommeTotal += i.totalPoints || 0;
  if ((i.points || 0) > maxPoints) maxPoints = i.points;
}
process.stdout.write('###' + JSON.stringify({
  items: ds.items.length,
  sommePoints, sommeTotal, maxPoints,
  // Le « reste cache » brut, fiche par fiche.
  cachees: ds.items.filter((i) => restant(i.totalPoints, i.points) > 0).length,
  // ⚠️ CE QUE <Gate> AFFICHERAIT REELLEMENT — ce n'est PAS la meme chose.
  // Meme sans plafond, points < totalPoints : plusieurs releves partageant
  // l'horodatage a la milliseconde retombent dans le meme seau. La condition
  // d'affichage est donc « porte ACTIVE **et** reste > 0 », jamais le seul
  // reste. Ma premiere version de ce test confondait les deux et accusait le
  // code a tort.
  afficherait: p.actif ? ds.items.filter((i) => restant(i.totalPoints, i.points) > 0).length : 0,
  menteuses: ds.items.filter((i) => (i.points || 0) > (i.totalPoints || 0)).length,
  // 🔴 LOT 104 — CE CONTROLE VIENT DE test:fuite, ET IL A CHANGE DE PLACE
  // POUR UNE RAISON MESUREE. Il verifiait que \`projeter()\` a bien retire les
  // champs de cote du jeu public. C'est un controle de CODE : il n'a besoin
  // que d'un dataset, n'importe lequel. Mais il vivait dans un banc qui tourne
  // APRES le build, ou l'appel a \`dataset()\` recalculait tout sur
  // l'echantillon local et VIDAIT la reserve du vrai build (1 201 fichiers ->
  // 0). Le controle etait juste ; l'endroit ou il s'executait le rendait
  // destructeur. ⭐⭐⭐ UN CONTROLE VIT LA OU IL EST EXACT ET SANS EFFET DE
  // BORD, pas la ou il a ete ecrit la premiere fois.
  encorePrix: ds.items.filter((i) => i.floor !== undefined || i.ath !== undefined
    || i.atl !== undefined || i.prixMedian !== undefined || i.history !== undefined).length,
  nan: ds.items.filter((i) => !Number.isFinite(i.points) || (i.history || []).some((h) => !Number.isFinite(h.floor))).length,
  paliers: acces().tiers,
  demo: acces().demo,
  porte: { tier: p.tier, actif: p.actif, max: p.public_max, jours: p.public_days },
  premiers: ds.items.slice(0, 5).map((i) => i.path + '|' + i.points),
  // --- Lot 2b : le palier du VISITEUR, distinct de celui de la porte -------
  visiteur: {
    defaut: palierVisiteur(undefined),
    sansSession: franchit('price_history', undefined),
    membre: franchit('price_history', { palier: 'member' }),
    gratuit: franchit('price_history', { palier: 'free' }),
    inconnu: franchit('price_history', { palier: 'nawak' }),
    ordre: [auMoins('member', 'free'), auMoins('free', 'member'), auMoins('visitor', 'free'), auMoins('free', 'free')],
  },
  // 🔴 Preuve que la donnee cachee n'a jamais ete produite : la courbe fait
  // exactement le nombre de points annonce, et ne depasse pas le plafond.
  fuite: ds.items.filter((i) => (i.history || []).length !== i.points).length,
  depassement: p.actif ? ds.items.filter((i) => i.points > p.public_max).length : 0,
}));
`);

// ⭐ PREPARER et EXECUTER se separent (06/08/2026) : la sonde du middleware a
// besoin d'une RACINE de scenario, pas d'un resultat de scenario. Sans cette
// scission, elle ne pouvait interroger que le manifeste de production — et
// c'est ce qui a cable une DECISION de Preda dans une assertion de mecanisme.
function preparer(nom, manifesteYml) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test'), { recursive: true });
  mkdirSync(join(root, 'engine', 'data'), { recursive: true });
  cpSync(join(RACINE, 'engine', 'data', 'sample'), join(root, 'engine', 'data', 'sample'), { recursive: true });
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'), manifesteYml);
  return root;
}

function scenario(nom, manifesteYml) {
  const root = preparer(nom, manifesteYml);
  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: RACINE,
    env: { ...process.env, PROJECT_ROOT: root, SITE: 'test', WAREHOUSE_OFFLINE: '1' },
    encoding: 'utf8',
  });
  const m = (r.stdout || '').split('###')[1];
  return m
    ? { ok: true, ...JSON.parse(m) }
    : { ok: false, err: (r.stderr || '').trim() };
}

const ENTETE = [
  'site:', '  domain: test.local', '  brand: Test',
  'languages:', '  default: en', '  active: [en]',
  'publication:', '  min_price_points: 8', '  comic_leaf: rarity',
  '  quotas: { collectible: 60, comic: 40 }',
].join('\n');

const ANCIEN = `${ENTETE}\n  public_points_max: 30\n  public_history_days: 90\n`;
const NOUVEAU = `${ENTETE}\naccess:\n  tiers: [visitor, member]\n  gates:\n    price_history:\n      tier: member\n      public_max: 30\n      public_days: 90\n`;
const GRATUIT = `${ENTETE}\naccess:\n  tiers: [visitor]\n`;
// 🔴 LOT 104 — LE PROFIL QUI FERME LA COTE. Aucun scenario du banc ne
// l'activait : `ANCIEN` est en retro-compat (pas de `crevette` dans `tiers`,
// donc porte inactive) et `NOUVEAU` s'arrete a `member`. Le controle de
// projection, deplace ici depuis test:fuite, aurait donc mesure des profils qui
// gardent LEGITIMEMENT leurs prix — et accuse le code a tort.
// ⭐⭐ « Zero parce que c'est casse » et « zero parce qu'il n'y a rien ici » :
// premiere version de ce deplacement, le banc criait sur un comportement juste.
const COTE_FERMEE = `${ENTETE}\naccess:\n  tiers: [visitor, member, crevette]\n  gates:\n    cote:\n      binaire: true\n      tier: crevette\n    price_history:\n      tier: crevette\n      public_max: 30\n      public_days: 3\n`;
const AMBIGU = `${ENTETE}\n  public_points_max: 30\naccess:\n  tiers: [visitor, member]\n`;
// Trois paliers, porte exigeant seulement `free` : le seul scenario ou l'ORDRE
// des paliers change quelque chose (un membre franchit une porte `free`).
const TROIS = `${ENTETE}\naccess:\n  tiers: [visitor, free, member]\n  gates:\n    price_history:\n      tier: free\n      public_max: 30\n      public_days: 90\n`;

// --- Lot 34 : la session de DEMONSTRATION ---------------------------------
// ⭐ Trois scenarios, dont DEUX QUI DOIVENT ECHOUER. Un test de validation qui
// ne fait passer que des cas valides ne prouve rien : il prouve que le code
// n'explose pas, pas qu'il refuse. C'est la lecon du 18/07 (« aucun lien
// casse » sur un repertoire vide) appliquee a une configuration d'acces.
const DEMO_OK = `${ENTETE}\naccess:\n  tiers: [visitor, member]\n  demo: member\n  gates:\n    price_history:\n      tier: member\n      public_max: 30\n      public_days: 90\n`;
const DEMO_INCONNUE = `${ENTETE}\naccess:\n  tiers: [visitor, member]\n  demo: baleine\n`;
const DEMO_HORS_TIERS = `${ENTETE}\naccess:\n  tiers: [visitor, member]\n  demo: whale\n`;

try {
  // =========================================================================
  // 1. RETRO-COMPATIBILITE : le manifeste d'AVANT donne EXACTEMENT le meme
  //    resultat que le manifeste migre. C'est la preuve du comportement
  //    constant, et la seule raison pour laquelle ce lot est sur a livrer.
  // =========================================================================
  console.log('\n1. retro-compatibilite (publication: ...) vs manifeste migre (access: ...)');
  const ancien = scenario('ancien', ANCIEN);
  const nouveau = scenario('nouveau', NOUVEAU);
  if (!ancien.ok || !nouveau.ok) {
    console.error(`   ! un scenario n'a rien produit :\n${(ancien.err || nouveau.err || '').slice(-1500)}`);
    process.exit(1);
  }

  // Garde-fou anti-faux-negatif : conclure sur un echantillon vide ou sans
  // aucune fiche tronquee ne prouverait rien du tout.
  if (ancien.items < 10) {
    console.error(`   ! echantillon insuffisant (${ancien.items} fiches) : test invalide`);
    process.exit(1);
  }
  if (ancien.cachees === 0) {
    console.error(`   ! aucune fiche tronquee dans l'echantillon : le test ne peut rien prouver`);
    process.exit(1);
  }

  const cles = ['items', 'sommePoints', 'sommeTotal', 'maxPoints', 'cachees', 'afficherait'];
  const identique = cles.every((k) => ancien[k] === nouveau[k])
    && ancien.premiers.join(',') === nouveau.premiers.join(',');
  verifie('la migration ne change RIEN au jeu de donnees', identique,
    cles.map((k) => `${k} ${ancien[k]}/${nouveau[k]}`).join(' · '));

  // ⭐ auto-controle : la comparaison ci-dessus sait-elle seulement echouer ?
  // On la rejoue sur un manifeste volontairement different (10 points au lieu
  // de 30). Si elle declarait « identique » ici, elle ne vaudrait rien.
  const different = scenario('defectueux', NOUVEAU.replace('public_max: 30', 'public_max: 10'));
  const detecte = !cles.every((k) => ancien[k] === different[k]);
  verifie('auto-controle : la comparaison detecte bien un ecart', detecte,
    `sommePoints ${ancien.sommePoints} vs ${different.sommePoints} avec public_max=10`);

  // =========================================================================
  // 2. LA PORTE EST LUE DANS LA MATRICE, PAS DEVINEE
  // =========================================================================
  console.log('\n2. lecture de la porte price_history');
  verifie('retro-compat : plafonds herites de publication',
    ancien.porte.max === 30 && ancien.porte.jours === 90 && ancien.porte.actif === true,
    JSON.stringify(ancien.porte));
  verifie('manifeste migre : memes plafonds, meme palier',
    nouveau.porte.tier === 'member' && nouveau.porte.max === 30 && nouveau.porte.jours === 90,
    JSON.stringify(nouveau.porte));

  // =========================================================================
  // 3. UN SITE ENTIEREMENT GRATUIT : la porte se DESACTIVE.
  //    C'est la promesse « meme code, gratuit ou payant » ; sans ce test elle
  //    resterait, elle aussi, une intention.
  // =========================================================================
  console.log('\n3. site gratuit (tiers: [visitor]) — la porte se desactive');
  const gratuit = scenario('gratuit', GRATUIT);
  if (!gratuit.ok) {
    console.error(`   ! le scenario gratuit a echoue :\n${gratuit.err.slice(-1500)}`);
    process.exit(1);
  }
  verifie('la porte est inactive', gratuit.porte.actif === false,
    `tier=${gratuit.porte.tier} actif=${gratuit.porte.actif} (plafonds leves)`);
  verifie('aucun appel a l\'action ne s\'afficherait sur le site gratuit',
    gratuit.afficherait === 0, `${gratuit.afficherait} <Gate> rendu(s) (attendu 0)`);
  verifie('...alors que le site a paliers en affiche, lui',
    ancien.afficherait > 0, `${ancien.afficherait} <Gate> rendu(s) sur ${ancien.items} fiches`);
  verifie('l\'historique est PLUS riche qu\'en mode paliers',
    gratuit.sommePoints > ancien.sommePoints,
    `${gratuit.sommePoints} points au total contre ${ancien.sommePoints}`);
  // 🔴 Le piege exact ferme par la branche BORNE de dataset.mjs : (Inf / Inf)
  // rend NaN, et une cle de seau NaN ne leve AUCUNE erreur — elle ecrase
  // silencieusement tous les releves dans une seule tranche. Le site serait
  // valide, rapide, et faux.
  verifie('aucun NaN ne s\'est glisse dans les courbes', gratuit.nan === 0,
    `${gratuit.nan} fiche(s) avec une valeur non finie`);
  verifie('les courbes ne s\'effondrent pas sur un seul point',
    gratuit.maxPoints >= ancien.maxPoints, `max ${gratuit.maxPoints} contre ${ancien.maxPoints}`);

  // 🔴 LOT 104 — VENU DE test:fuite, ET LE DEPLACEMENT EST LE CORRECTIF.
  // « `projeter()` a-t-il bien retire floor/ath/atl/prixMedian/history du jeu
  // public ? » est une question de CODE : n'importe quel dataset y repond.
  // Elle vivait dans un banc joue APRES le build, ou l'appel a `dataset()`
  // recalculait sur l'echantillon local et VIDAIT la reserve du vrai build —
  // 1 201 fichiers de cote a 0, mesure le 07/08. Le controle etait juste,
  // l'endroit le rendait destructeur.
  // ⚠️ `ancien` ET `gratuit` : la projection ne doit pas dependre du manifeste.
  // Un site qui ne ferme pas sa cote garde ses champs — c'est `porte('cote')`
  // qui decide — donc on ne l'exige QUE du profil qui la ferme.
  const cotee = scenario('cote fermee', COTE_FERMEE);
  verifie('la projection retire tous les champs de cote quand la porte est ACTIVE',
    cotee.encorePrix === 0,
    cotee.encorePrix === 0 ? `${cotee.items} fiches, aucun champ de cote`
      : `${cotee.encorePrix} fiche(s) portent encore floor/ath/atl/history`);
  // ⭐⭐⭐ ET LA CONTRE-EPREUVE, SANS LAQUELLE LA LIGNE AU-DESSUS NE PROUVE
  // RIEN. Un `projeter()` qui retirerait les champs TOUJOURS — porte active ou
  // non — passerait le premier controle et casserait le classement de la
  // vitrine en silence, sur tous les sites gratuits. On exige donc aussi que
  // les prix RESTENT la ou la porte est inactive.
  verifie('et elle ne retire RIEN quand la porte est inactive',
    ancien.encorePrix > 0,
    ancien.encorePrix > 0 ? `${ancien.encorePrix} fiche(s) gardent leurs prix, comme prevu`
      : 'AUCUNE fiche ne porte de prix alors que la porte est inactive — projeter() s\'applique trop largement');

  // =========================================================================
  // 4. LE GARDE-FOU DU MANIFESTE AMBIGU
  //    « Un reglage pose a un endroit, silencieusement ecrase par un autre » :
  //    quatre occurrences sur ce projet, aucune n'a plante. Celle-ci plantera.
  // =========================================================================
  console.log('\n4. manifeste ambigu (access: ET publication.public_points_max)');
  const ambigu = scenario('ambigu', AMBIGU);
  verifie('le build ECHOUE au lieu de choisir en silence', ambigu.ok === false,
    ambigu.ok ? 'le build a reussi — le reglage aurait ete ignore sans un mot' : 'build interrompu');
  verifie('le message dit quoi faire', !ambigu.ok && /public_points_max/.test(ambigu.err) && /access\.gates/.test(ambigu.err),
    !ambigu.ok ? (ambigu.err.split('\n').find((l) => l.includes('[acces]')) || '').slice(0, 160) : '—');

  // =========================================================================
  // 5. AUCUNE PAGE NE LIT UN PLAFOND EN DUR
  //    Le garde-fou structurel : la regle « le palier est une donnee » ne tient
  //    que si personne ne la contourne. On l'ecrit une fois, la machine la
  //    fait respecter ensuite.
  // =========================================================================
  console.log('\n5. garde-fou : aucun plafond lu hors de la matrice');
  const INTERDITS = /public_points_max|public_history_days/;
  const AUTORISES = new Set(['engine/lib/access.mjs', 'engine/tools/test_access.mjs', 'engine/tools/test_quotas.mjs']);

  function fichiers(dir, acc = []) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) fichiers(p, acc);
      else if (/\.(mjs|js|astro)$/.test(e)) acc.push(p);
    }
    return acc;
  }
  function coupables(racine) {
    return fichiers(racine)
      .map((p) => relative(racine, p).split('\\').join('/'))
      .filter((rel) => !AUTORISES.has(rel))
      .filter((rel) => INTERDITS.test(readFileSync(join(racine, rel), 'utf8')));
  }

  const fautifs = coupables(RACINE);
  verifie('aucun fichier hors matrice ne lit les anciennes cles', fautifs.length === 0,
    fautifs.length ? fautifs.join(', ') : 'moteur, composants et pages sont propres');

  // ⭐ auto-controle : on fabrique le defaut et on verifie que le garde-fou le
  // voit. Sans ce bloc, un garde-fou casse passerait au vert pour toujours.
  const piege = join(base, 'piege');
  mkdirSync(join(piege, 'src'), { recursive: true });
  writeFileSync(join(piege, 'src', 'Fautif.astro'), 'const n = m.publication.public_points_max ?? 30;\n');
  verifie('auto-controle : le garde-fou detecte bien une lecture en dur',
    coupables(piege).length === 1, `${coupables(piege).length} fichier(s) signale(s) (attendu 1)`);

  // =========================================================================
  // 6. LOT 2b — LE PALIER DU VISITEUR
  //    Deux notions a ne jamais confondre : ce que le SITE exige (manifeste)
  //    et ce que la PERSONNE porte (session). Ce bloc verifie qu'elles se
  //    rencontrent au bon endroit, et seulement la.
  // =========================================================================
  console.log('\n6. le palier du visiteur (lot 2b)');

  // ⚠️ L'assertion qui rend ce lot sur a livrer : sans systeme de comptes,
  // personne ne franchit rien, donc rien ne change a l'ecran.
  verifie('sans compte, le visiteur est « visitor » et ne franchit pas',
    ancien.visiteur.defaut === 'visitor' && ancien.visiteur.sansSession === false,
    `defaut=${ancien.visiteur.defaut} franchit=${ancien.visiteur.sansSession}`);
  verifie('une session « member » franchit une porte member',
    ancien.visiteur.membre === true, `franchit=${ancien.visiteur.membre}`);

  // 🔴 Un vieux cookie « free » sur un site qui ne declare PAS ce palier ne
  // doit rien ouvrir. En cas de doute on FERME : ouvrir par defaut
  // transformerait une faute de frappe en fuite de donnees payantes.
  verifie('un palier absent de access.tiers n\'ouvre rien',
    ancien.visiteur.gratuit === false, `session « free » sur un site visitor+member : franchit=${ancien.visiteur.gratuit}`);
  verifie('un palier inconnu n\'ouvre rien', ancien.visiteur.inconnu === false,
    `session « nawak » : franchit=${ancien.visiteur.inconnu}`);

  // L'ordre des paliers : comparaison par RANG, pas par egalite.
  const [mSurF, fSurM, vSurF, fSurF] = ancien.visiteur.ordre;
  verifie('l\'ordre des paliers est respecte (member > free > visitor)',
    mSurF === true && fSurM === false && vSurF === false && fSurF === true,
    `member/free=${mSurF} free/member=${fSurM} visitor/free=${vSurF} free/free=${fSurF}`);

  // Le seul scenario ou l'ordre change vraiment quelque chose.
  console.log('\n   trois paliers, porte exigeant seulement « free »');
  const trois = scenario('trois', TROIS);
  if (!trois.ok) {
    console.error(`   ! le scenario a trois paliers a echoue :\n${trois.err.slice(-1500)}`);
    process.exit(1);
  }
  verifie('un membre franchit une porte qui n\'exige que « free »',
    trois.visiteur.membre === true, `franchit=${trois.visiteur.membre}`);
  verifie('un inscrit gratuit la franchit aussi',
    trois.visiteur.gratuit === true, `franchit=${trois.visiteur.gratuit}`);
  verifie('un visiteur anonyme, non', trois.visiteur.sansSession === false,
    `franchit=${trois.visiteur.sansSession}`);
  // ⭐ auto-controle : ce scenario sait-il distinguer quoi que ce soit ? Si
  // « free » passait partout, les trois lignes ci-dessus seraient vraies pour
  // de mauvaises raisons.
  verifie('auto-controle : le meme palier « free » NE passe PAS la porte member',
    ancien.visiteur.gratuit === false && trois.visiteur.gratuit === true,
    'meme session, deux manifestes, deux reponses');

  // 3. Sur un site gratuit, la porte est inactive : tout le monde franchit.
  verifie('site gratuit : tout le monde franchit, sans session',
    gratuit.visiteur.sansSession === true, `franchit=${gratuit.visiteur.sansSession}`);

  // =========================================================================
  // 7. 🔴 LA DONNEE CACHEE N'A JAMAIS ETE PRODUITE
  //    Le flou CSS et les blocs masques ne sont pas des verrous : la seule
  //    protection reelle est que la donnee ne soit pas dans la page. On le
  //    verifie au niveau du jeu de donnees, en amont du rendu.
  // =========================================================================
  console.log('\n7. anti-fuite : la courbe ne contient que ce qui est annonce');
  verifie('aucune fiche ne transporte plus de points qu\'elle n\'en annonce',
    ancien.fuite === 0, `${ancien.fuite} fiche(s) en ecart`);
  verifie('aucune fiche ne depasse le plafond de la porte',
    ancien.depassement === 0, `${ancien.depassement} fiche(s) au-dessus de ${ancien.porte.max}`);
  verifie('le site gratuit non plus (plafond leve, mais pas de fuite)',
    gratuit.fuite === 0, `${gratuit.fuite} fiche(s) en ecart`);

  // =========================================================================
  // 8. 🔴 LA SESSION DE DEMONSTRATION (lot 34, 03/08/2026)
  //    Porte ouverte assumee. Ce qui se teste n'est donc PAS « est-elle
  //    fermee », mais : (a) le manifeste la declare-t-il sans ambiguite,
  //    (b) REFUSE-T-ELLE une declaration fausse, (c) s'efface-t-elle devant
  //    un vrai service de session.
  //    ⭐⭐ (c) EST LA SEULE QUI PROTEGE DE L'ARGENT. Une demo qui ecraserait
  //    `SESSION_API` transformerait une panne reseau en abonnements gratuits —
  //    le meme bug que le `catch` qui rendrait « member », ecrit ailleurs.
  // =========================================================================
  console.log('\n8. la session de demonstration');

  const demoOk = scenario('demo-ok', DEMO_OK);
  verifie('un manifeste avec « demo: member » expose bien ce palier',
    demoOk.ok && demoOk.demo === 'member', `demo=${demoOk.demo}`);

  // ⭐ auto-controle : sans la cle, la demo doit valoir null — sinon la ligne
  // ci-dessus serait vraie meme si `demo` etait cable en dur.
  verifie('auto-controle : sans « demo: », le manifeste n\'ouvre rien',
    nouveau.demo === null || nouveau.demo === undefined, `demo=${nouveau.demo}`);

  const demoInconnue = scenario('demo-inconnue', DEMO_INCONNUE);
  verifie('un palier de demo INCONNU fait ECHOUER le build',
    !demoInconnue.ok && /access\.demo/.test(demoInconnue.err || ''),
    demoInconnue.ok ? 'le build a passe — la faute de frappe serait silencieuse' : 'refus bruyant');

  const demoHorsTiers = scenario('demo-hors-tiers', DEMO_HORS_TIERS);
  verifie('un palier de demo ABSENT de access.tiers fait ECHOUER le build',
    !demoHorsTiers.ok && /access\.tiers/.test(demoHorsTiers.err || ''),
    demoHorsTiers.ok ? 'le build a passe — la demo serait un mensonge silencieux' : 'refus bruyant');

  // --- (c) l'effacement devant un vrai service de session ------------------
  // On appelle la condition du middleware DIRECTEMENT, dans deux processus,
  // avec et sans SESSION_API. C'est la seule assertion de ce fichier qui
  // touche au middleware, et elle vaut les autres reunies.
  //
  // 🔴🔴 CORRIGE LE 06/08/2026, APRES UN DEPLOIEMENT ARRETE PAR CE BANC.
  // Il exigeait `sansApi === 'crevette'` — la valeur ECRITE DANS LE MANIFESTE
  // DE PRODUCTION. Le jour ou Preda a eteint la demo (et il a bien fait : elle
  // servait la reserve a n'importe qui), ce banc est tombe. Il n'avait rien
  // trouve : il a signale que la POLITIQUE avait change, en croyant parler du
  // MECANISME.
  // ⭐⭐⭐ UN BANC QUI CABLE UNE DECISION DANS SON ATTENTE FAIT ECHOUER LE
  // DEPLOIEMENT LE JOUR OU LA DECISION EST PRISE — c'est-a-dire exactement au
  // pire moment, et en accusant l'innocent. `test:routes` porte deja la regle
  // en tete : « son attente vient du manifeste, pas d'une liste ».
  // ⛔ ET ON NE LE REPARE PAS EN ECRIVANT `sansApi === null` : on aurait juste
  // cable la decision SUIVANTE, et le banc retomberait le jour ou la demo se
  // rallume. Deux fautes de plus a chaque changement d'avis.
  //
  // LA FORME JUSTE, EN DEUX MOITIES :
  //   (a) sur un manifeste QUI DECLARE une demo, le middleware la relaie —
  //       assertion NETTE, non nulle, insensible a la politique de veveprice ;
  //   (b) sur le manifeste REEL, le middleware rend ce que le manifeste
  //       DECLARE, quel qu'il soit — l'attente est LUE, jamais ecrite.
  const sondeMw = (avecApi, root) => {
    const r = spawnSync(process.execPath, ['-e',
      `import(${JSON.stringify(join(RACINE, 'src', 'middleware.js'))})`
      + `.then((m) => process.stdout.write('###' + JSON.stringify(m.palierDeDemonstration({}))))`
      + `.catch((e) => process.stdout.write('###"ERREUR:' + e.message + '"'))`],
      { cwd: RACINE, encoding: 'utf8',
        env: { ...process.env, WAREHOUSE_OFFLINE: '1',
               ...(root ? { PROJECT_ROOT: root, SITE: 'test' } : { SITE: 'veveprice' }),
               ...(avecApi ? { SESSION_API: 'https://id.example/api' } : { SESSION_API: '' }) } });
    const m = (r.stdout || '').split('###')[1];
    return m ? JSON.parse(m) : `PAS DE SORTIE: ${(r.stderr || '').slice(-400)}`;
  };

  // --- (a) le MECANISME, sur un manifeste qui declare « demo: member » ------
  const racineDemo = preparer('demo-middleware', DEMO_OK);
  const relais = sondeMw(false, racineDemo);
  verifie('sans SESSION_API, le middleware RELAIE la demo declaree',
    relais === 'member',
    `palier rendu = ${JSON.stringify(relais)} (manifeste declarant « demo: member »)`);
  verifie('🔴 avec SESSION_API configure, la demo s\'EFFACE',
    sondeMw(true, racineDemo) === null,
    'null — le vrai service decide seul, meme quand le manifeste declare une demo');

  // --- (b) le manifeste REEL : l'attente est LUE, pas ecrite ----------------
  // ⭐ On demande au moteur ce que le site declare, et on exige que le
  // middleware rende CA. Eteindre ou rallumer la demo ne casse plus rien ;
  // seul un middleware qui cesserait de relayer ferait tomber le banc.
  const declaree = (() => {
    const r = spawnSync(process.execPath, ['-e',
      `import(${JSON.stringify(join(RACINE, 'engine', 'lib', 'access.mjs'))})`
      + `.then((m) => process.stdout.write('###' + JSON.stringify(m.palierDemo() ?? null)))`
      + `.catch((e) => process.stdout.write('###"ERREUR:' + e.message + '"'))`],
      { cwd: RACINE, encoding: 'utf8',
        env: { ...process.env, SITE: 'veveprice', WAREHOUSE_OFFLINE: '1', SESSION_API: '' } });
    const m = (r.stdout || '').split('###')[1];
    return m ? JSON.parse(m) : `PAS DE SORTIE: ${(r.stderr || '').slice(-400)}`;
  })();
  const sansApi = sondeMw(false);
  verifie('sur le manifeste reel, le middleware rend ce que le site DECLARE',
    sansApi === declaree,
    `declare = ${JSON.stringify(declaree)} · rendu = ${JSON.stringify(sansApi)}`
    + (declaree === null ? ' — veveprice a eteint sa demo le 06/08, et c\'est une DECISION, pas une panne' : ''));
  verifie('🔴 sur le manifeste reel aussi, SESSION_API efface tout',
    sondeMw(true) === null, 'null — le vrai service decide seul');

} finally {
  console.log(`\n${echecs === 0 ? '✅ tout est vert' : `❌ ${echecs} echec(s)`}`);
  process.exit(echecs === 0 ? 0 : 1);
}
