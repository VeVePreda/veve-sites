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
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = mkdtempSync(join(tmpdir(), 'acces-'));
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
import { acces, porte, restant } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'access.mjs'))};
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
  nan: ds.items.filter((i) => !Number.isFinite(i.points) || (i.history || []).some((h) => !Number.isFinite(h.floor))).length,
  paliers: acces().tiers,
  porte: { tier: p.tier, actif: p.actif, max: p.public_max, jours: p.public_days },
  premiers: ds.items.slice(0, 5).map((i) => i.path + '|' + i.points),
}));
`);

function scenario(nom, manifesteYml) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test'), { recursive: true });
  mkdirSync(join(root, 'engine', 'data'), { recursive: true });
  cpSync(join(RACINE, 'engine', 'data', 'sample'), join(root, 'engine', 'data', 'sample'), { recursive: true });
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'), manifesteYml);
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
const AMBIGU = `${ENTETE}\n  public_points_max: 30\naccess:\n  tiers: [visitor, member]\n`;

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

} finally {
  console.log(`\n${echecs === 0 ? '✅ tout est vert' : `❌ ${echecs} echec(s)`}`);
  process.exit(echecs === 0 ? 0 : 1);
}
