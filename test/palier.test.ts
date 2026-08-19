// ⚠️ DEPOT : VeVePreda/veveid   ·   CHEMIN : test/palier.test.ts   (FICHIER NEUF)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Server } from 'node:http';

/**
 * 🔴🔴🔴 LOT 163-A — LE PALIER DEVIENT UNE PROPRIÉTÉ DU COMPTE.
 *
 * ⭐⭐⭐ CE QUE CE BANC GARDE, ET POURQUOI IL EST HTTP COMME `admin.test.ts`.
 * Le défaut réparé n'était pas dans une fonction : `accorderAbonnement`
 * marchait très bien, et `paliDe()` ne savait dire que `member` ou
 * `crevette`. Résultat : `langouste` et `whale` étaient DÉCLARÉS dans le
 * manifeste de veveprice, VENDUS sur `/offre/` (historique 30 j / 90 j / Max,
 * module `wallet_watch`) et atteignables par PERSONNE. C'est mot pour mot la
 * panne du lot 122, un cran plus haut — et de l'extérieur « très strict » et
 * « cassé » se ressemblent exactement.
 * ⇒ Ce banc mesure donc les DEUX bouts : la loi (`paliDe`) et la chaîne (la
 *   route qui la pose), parce que réparer l'une sans l'autre laisse la panne
 *   entière et l'air réparée.
 *
 * ⚠️ LA BASE EST CRÉÉE À L'ANCIENNE FORME, SANS LES DEUX COLONNES NEUVES.
 *   C'est délibéré : c'est la seule façon de mesurer la migration sur ce
 *   qu'elle rencontrera vraiment en production — une base qui existe déjà.
 *   Une base créée à la bonne forme rendrait le contrôle de migration VERT
 *   sans avoir rien migré.
 */

const dossier = mkdtempSync(join(tmpdir(), 'veveid-palier-'));
const JETON = 'jeton-de-banc-palier-7b2e';
const W = '0x' + 'cd'.repeat(20);
const EMAIL = 'palier@exemple.net';

let serveur: Server;
let racine = '';
let avoirs: typeof import('../src/avoirs.ts');

before(async () => {
  const f = join(dossier, 'palier.db');
  const db = new DatabaseSync(f);
  db.exec(`CREATE TABLE comptes (
    id TEXT PRIMARY KEY, wallet TEXT, email TEXT, verifie INTEGER NOT NULL DEFAULT 0,
    verifie_le TEXT, cree_le TEXT NOT NULL, abonne_jusqu_a TEXT, supprime_le TEXT);
  CREATE UNIQUE INDEX idx_comptes_wallet ON comptes(wallet) WHERE wallet IS NOT NULL;`);
  db.prepare('INSERT INTO comptes (id, wallet, email, verifie, verifie_le, cree_le) VALUES (?,?,?,?,?,?)')
    .run('sujet', W, EMAIL, 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  db.close();

  process.env.DB_PATH = f;
  process.env.SITE_DEFAUT = 'veveprice';
  process.env.SESSION_SECRET = 'secret-de-banc-palier-0123456789';
  process.env.ADMIN_TOKEN = JETON;
  process.env.JEUX = 'veveprice=https://veveprice.com';
  process.env.URL_PUBLIQUE = 'https://id.exemple.net';

  const s = await import('../server.ts');
  serveur = s.serveur;
  avoirs = await import('../src/avoirs.ts');
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const a = serveur.address() as { port: number };
  racine = `http://127.0.0.1:${a.port}`;
});

after(async () => {
  await new Promise<void>((r) => serveur.close(() => r()));
  const m = await import('../src/db.ts');
  m.fermer();
  rmSync(dossier, { recursive: true, force: true });
});

const va = (chemin: string, cookie?: string) =>
  fetch(racine + chemin, { redirect: 'manual', headers: cookie ? { cookie } : {} });
const poste = (chemin: string, corps: string, cookie?: string) =>
  fetch(racine + chemin, {
    method: 'POST', redirect: 'manual', body: corps,
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  });

async function ouvrirSession(): Promise<string> {
  const r = await va(`/admin?k=${JETON}`);
  const brut = r.headers.getSetCookie().find((c) => c.startsWith('veveid_adm='));
  assert.ok(brut, 'l\'échange doit poser le cookie d\'exploitation');
  return brut.split(';')[0];
}

/** Le compte du banc, relu depuis la base. ⛔ Jamais un objet fabriqué à la main. */
const sujet = () => {
  const c = avoirs.lireCompte('sujet');
  assert.ok(c, 'le compte du banc doit exister');
  return c!;
};
const poser = (palier: string | null, jusqu: string | null) => {
  const m = require_run();
  m('UPDATE comptes SET palier=?, palier_jusqu_a=? WHERE id=?', palier, jusqu, 'sujet');
};
/** ⭐ On passe par le `run` du module, pas par une seconde connexion SQLite :
 *   deux connexions sur le même fichier liraient deux instantanés. */
let _run: ((sql: string, ...a: unknown[]) => unknown) | null = null;
function require_run() {
  if (!_run) throw new Error('run non chargé');
  return _run;
}

test('⚙️ amorçage : on récupère le `run` du module de base', async () => {
  const db = await import('../src/db.ts');
  _run = db.run as never;
  assert.ok(_run);
});

// ═══════════════════════════════════════════════════════════════════════
// §1 — LA MIGRATION, MESURÉE SUR UNE BASE QUI N'AVAIT PAS LES COLONNES
// ═══════════════════════════════════════════════════════════════════════
test('🧱 la migration ajoute palier ET palier_jusqu_a à une base ancienne', async () => {
  const { forme } = await import('../src/admin.ts');
  const noms = forme().colonnes.map((c) => c.nom);
  assert.ok(noms.includes('palier'), 'colonne palier absente — la migration ne s\'est pas appliquée');
  assert.ok(noms.includes('palier_jusqu_a'), 'colonne palier_jusqu_a absente');
  // ⭐ Les DEUX, et pas « au moins une » : le code les ajoute par deux `if`
  //   séparés précisément pour qu'un arrêt entre les deux soit rattrapable.
});

// ═══════════════════════════════════════════════════════════════════════
// §2 — LA LOI : `paliDe()` SAIT MAINTENANT DIRE LES QUATRE PALIERS
// ═══════════════════════════════════════════════════════════════════════
test('🔴 sans rien, un compte vaut « member » — et c\'était déjà vrai', () => {
  poser(null, null);
  assert.equal(avoirs.paliDe(sujet()), 'member');
});

test('🔴🔴 UN PALIER POSÉ REND « whale » — le cas que personne ne pouvait atteindre', () => {
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  poser('whale', demain);
  assert.equal(avoirs.paliDe(sujet()), 'whale',
    'c\'est LE défaut du lot : whale était vendu et inatteignable');
  assert.equal(avoirs.palierPose(sujet()), 'whale');
});

test('⏳ un palier EXPIRÉ ne vaut plus rien — la surcharge se referme seule', () => {
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  poser('whale', hier);
  assert.equal(avoirs.palierPose(sujet()), null, 'la date passée doit l\'annuler');
  assert.equal(avoirs.paliDe(sujet()), 'member',
    'c\'est la propriété qui rend ce lot acceptable : rien ne reste ouvert par oubli');
});

test('🔒 un palier SANS date ne vaut rien non plus — les deux ou rien', () => {
  poser('whale', null);
  assert.equal(avoirs.palierPose(sujet()), null,
    'une surcharge à moitié écrite ne doit pas ouvrir de porte');
  assert.equal(avoirs.paliDe(sujet()), 'member');
});

test('🚪 un palier INCONNU en base échoue FERMÉ, il n\'ouvre rien', () => {
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  poser('kraken', demain);
  assert.equal(avoirs.palierPose(sujet()), null, 'hors PALIERS ⇒ null');
  assert.equal(avoirs.paliDe(sujet()), 'member',
    'un palier inventé d\'un côté ne doit jamais ouvrir de l\'autre');
});

test('🛡️ LE MAXIMUM, JAMAIS LE DERNIER ÉCRIT : une surcharge basse ne retire pas un droit payé', () => {
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  require_run()('UPDATE comptes SET abonne_jusqu_a=? WHERE id=?', demain, 'sujet');
  poser('free', demain);
  assert.equal(avoirs.paliDe(sujet()), 'crevette',
    'l\'abonnement l\'emporte — une surcharge d\'exploitation ne peut QU\'AJOUTER');
  poser('whale', demain);
  assert.equal(avoirs.paliDe(sujet()), 'whale', 'et au-dessus, elle ajoute bien');
  require_run()('UPDATE comptes SET abonne_jusqu_a=NULL WHERE id=?', 'sujet');
  poser(null, null);
});

// ═══════════════════════════════════════════════════════════════════════
// §3 — LA CHAÎNE : LA ROUTE QUI POSE, ET SES BORNES
// ═══════════════════════════════════════════════════════════════════════
test('🔴 sans cookie, /admin/palier est indiscernable d\'une adresse inconnue', async () => {
  const r = await poste('/admin/palier', 'ref=sujet&palier=whale&jours=30');
  const nimporte = await va('/cette-adresse-nexiste-pas');
  assert.equal(r.status, nimporte.status, 'aucun indice que cette route existe');
  assert.equal(avoirs.palierPose(sujet()), null, 'et SURTOUT : rien n\'a été écrit');
});

test('⭐ avec le cookie, poser « whale » 30 jours écrit vraiment', async () => {
  const c = await ouvrirSession();
  const r = await poste('/admin/palier', 'ref=sujet&palier=whale&jours=30', c);
  assert.equal(r.status, 200);
  assert.equal(avoirs.palierPose(sujet()), 'whale');
  assert.equal(avoirs.paliDe(sujet()), 'whale');
  const j = sujet().palier_jusqu_a!;
  assert.ok(j > new Date().toISOString(), 'la date de fin doit être dans le futur');
});

test('🗑️ jours=0 RETIRE la surcharge — sinon « me donner whale pour regarder » coûte 400 jours', async () => {
  const c = await ouvrirSession();
  await poste('/admin/palier', 'ref=sujet&palier=whale&jours=30', c);
  assert.equal(avoirs.palierPose(sujet()), 'whale', 'témoin posé AVANT le retrait');
  const r = await poste('/admin/palier', 'ref=sujet&jours=0', c);
  assert.equal(r.status, 200);
  assert.equal(sujet().palier, null, 'la colonne palier doit être vidée');
  assert.equal(sujet().palier_jusqu_a, null, 'et sa date AVEC — jamais l\'une sans l\'autre');
});

test('⛔ 401 jours est refusé, et rien n\'est écrit', async () => {
  const c = await ouvrirSession();
  const r = await poste('/admin/palier', 'ref=sujet&palier=whale&jours=401', c);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Dur.e refus.e/, 'la page doit DIRE pourquoi');
  assert.equal(avoirs.palierPose(sujet()), null, 'aucune écriture sur une durée refusée');
});

test('⛔ un champ jours VIDE ne retire rien par la bande', async () => {
  const c = await ouvrirSession();
  await poste('/admin/palier', 'ref=sujet&palier=whale&jours=30', c);
  const r = await poste('/admin/palier', 'ref=sujet&palier=whale&jours=', c);
  assert.equal(r.status, 200);
  assert.equal(avoirs.palierPose(sujet()), 'whale',
    'Number("") vaut 0, qui est maintenant « retirer » — la forme doit être exigée, pas devinée');
  await poste('/admin/palier', 'ref=sujet&jours=0', c);
});

test('⛔ un palier INCONNU est refusé par la route', async () => {
  const c = await ouvrirSession();
  const r = await poste('/admin/palier', 'ref=sujet&palier=kraken&jours=30', c);
  assert.match(await r.text(), /Palier inconnu/);
  assert.equal(avoirs.palierPose(sujet()), null);
});

test('⛔ « member » est refusé parce qu\'il serait SANS EFFET, et la page le dit', async () => {
  const c = await ouvrirSession();
  const r = await poste('/admin/palier', 'ref=sujet&palier=member&jours=30', c);
  const corps = await r.text();
  assert.match(corps, /Sans effet/, 'un geste qui ne ferait rien doit être refusé À VOIX HAUTE');
  assert.equal(avoirs.palierPose(sujet()), null);
});

test('⛔ un compte inconnu ne crée rien', async () => {
  const c = await ouvrirSession();
  const r = await poste('/admin/palier', 'ref=personne&palier=whale&jours=30', c);
  assert.match(await r.text(), /Compte inconnu/);
});

// ═══════════════════════════════════════════════════════════════════════
// §4 — LA RÈGLE DU LOT 122 TIENT TOUJOURS : AUCUNE IDENTITÉ EN CLAIR
// ═══════════════════════════════════════════════════════════════════════
test('🔴🔴 la page qui affiche le palier ne laisse fuir NI e-mail NI portefeuille', async () => {
  const c = await ouvrirSession();
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  poser('whale', demain);
  const r = await poste('/admin/chercher', `q=${encodeURIComponent(EMAIL)}`, c);
  const corps = await r.text();
  assert.match(corps, /whale/, 'le palier effectif doit bien s\'afficher');
  assert.ok(!corps.includes(EMAIL), 'l\'e-mail cherché ne doit JAMAIS revenir dans le HTML');
  assert.ok(!corps.includes(W), 'ni le portefeuille en entier');
  poser(null, null);
});
