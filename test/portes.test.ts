// ⚠️ DEPOT : VeVePreda/veveid   ·   CHEMIN : test/portes.test.ts   (FICHIER NEUF)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Server } from 'node:http';

/**
 * 🔴🔴🔴 LOT 163-B① — LA SURCHARGE DES PORTES.
 *
 * ⭐⭐⭐ CE QUE CE BANC GARDE VRAIMENT, ET CE N'EST PAS « ça marche ».
 * Ce module fait la chose qu'`access.mjs` interdit par écrit : ouvrir une
 * porte SANS redéployer, donc sans laisser dans le dépôt la moindre trace qui
 * rappellera de refermer. Il n'est acceptable qu'à une condition — **la date
 * de fin est obligatoire, courte, et elle mord**.
 * ⇒ LE CONTRÔLE LE PLUS IMPORTANT DE CE FICHIER N'EST PAS QU'UNE SURCHARGE
 *   S'APPLIQUE : c'est qu'elle DISPARAÎT toute seule, et qu'aucun chemin ne
 *   permet d'en poser une sans fin. Un banc qui ne vérifierait que
 *   l'ouverture validerait exactement le défaut qu'on cherche à éviter.
 */

const dossier = mkdtempSync(join(tmpdir(), 'veveid-portes-'));
const JETON = 'jeton-de-banc-portes-4d9a';
const SERVICE = 'secret-de-service-de-banc-91f3';
const SITE = 'veveprice';

let serveur: Server;
let racine = '';
let portes: typeof import('../src/portes.ts');
let base: typeof import('../src/db.ts');

before(async () => {
  const f = join(dossier, 'portes.db');
  const db = new DatabaseSync(f);
  db.exec(`CREATE TABLE comptes (
    id TEXT PRIMARY KEY, wallet TEXT, email TEXT, verifie INTEGER NOT NULL DEFAULT 0,
    verifie_le TEXT, cree_le TEXT NOT NULL, abonne_jusqu_a TEXT, supprime_le TEXT);`);
  db.close();

  process.env.DB_PATH = f;
  process.env.SITE_DEFAUT = SITE;
  process.env.SESSION_SECRET = 'secret-de-banc-portes-0123456789';
  process.env.ADMIN_TOKEN = JETON;
  process.env.ID_SERVICE = SERVICE;
  process.env.JEUX = `${SITE}=https://veveprice.com`;
  process.env.URL_PUBLIQUE = 'https://id.exemple.net';

  const s = await import('../server.ts');
  serveur = s.serveur;
  portes = await import('../src/portes.ts');
  base = await import('../src/db.ts');
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const a = serveur.address() as { port: number };
  racine = `http://127.0.0.1:${a.port}`;
});

after(async () => {
  await new Promise<void>((r) => serveur.close(() => r()));
  base.fermer();
  rmSync(dossier, { recursive: true, force: true });
});

const va = (chemin: string, entetes?: Record<string, string>) =>
  fetch(racine + chemin, { redirect: 'manual', headers: entetes ?? {} });
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
const netto = () => base.run('DELETE FROM reglages WHERE cle LIKE ?', 'porte.%');

// ═══════════════════════════════════════════════════════════════════════
// §1 — LA LOI
// ═══════════════════════════════════════════════════════════════════════
test('⭐ une surcharge posée se relit, avec son palier et sa date', () => {
  netto();
  const msg = portes.poserSurcharge(SITE, 'modules', 'member', 7);
  assert.match(msg, /modules/);
  const v = portes.lireSurcharges(SITE);
  assert.equal(v.length, 1);
  assert.equal(v[0].porte, 'modules');
  assert.equal(v[0].tier, 'member');
  assert.ok(v[0].jusqu_a > new Date().toISOString(), 'la date de fin doit être dans le futur');
});

test('🔴🔴 ELLE SE REFERME SEULE — le contrôle qui rend ce module acceptable', () => {
  netto();
  portes.poserSurcharge(SITE, 'modules', 'member', 7);
  assert.equal(portes.lireSurcharges(SITE).length, 1, 'témoin : elle est bien là AVANT');
  const dans8jours = new Date(Date.now() + 8 * 86_400_000).toISOString();
  assert.equal(portes.lireSurcharges(SITE, dans8jours).length, 0,
    'passé sa date, elle ne doit plus rien ouvrir — sans que personne n\'intervienne');
});

test('⛔ aucun chemin ne permet de poser une surcharge SANS FIN', () => {
  netto();
  // ⭐ On essaie les trois formes qui, dans d'autres écritures, auraient donné
  //   « pas de date » : durée nulle, durée hors bornes, durée non entière.
  portes.poserSurcharge(SITE, 'modules', 'member', 0);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
  assert.match(portes.poserSurcharge(SITE, 'modules', 'member', portes.JOURS_MAX + 1), /Dur.e refus.e/);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
  assert.match(portes.poserSurcharge(SITE, 'modules', 'member', 1.5), /Dur.e refus.e/);
  assert.equal(portes.lireSurcharges(SITE).length, 0, 'aucune des trois n\'a écrit');
});

test('⛔ une porte hors liste blanche est refusée', () => {
  netto();
  assert.match(portes.poserSurcharge(SITE, 'inventee', 'member', 7), /Porte inconnue/);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
});

test('⛔ un palier inconnu est refusé', () => {
  netto();
  assert.match(portes.poserSurcharge(SITE, 'modules', 'kraken', 7), /Palier inconnu/);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
});

test('⭐ RESSERRER est permis — l\'outil doit savoir refermer vite, pas seulement ouvrir', () => {
  netto();
  portes.poserSurcharge(SITE, 'cote', 'whale', 3);
  const v = portes.lireSurcharges(SITE);
  assert.equal(v[0].tier, 'whale', 'une surcharge à sens unique serait inutile le jour d\'un incident');
});

test('🛡️ une ligne ABÎMÉE est ignorée, elle ne fait pas tomber les autres', () => {
  netto();
  portes.poserSurcharge(SITE, 'modules', 'member', 7);
  base.run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?)',
    `porte.${SITE}.extremes`, 'ceci n\'est pas du json', new Date().toISOString());
  const v = portes.lireSurcharges(SITE);
  assert.equal(v.length, 1, 'les six autres portes doivent rester lisibles');
  assert.equal(v[0].porte, 'modules');
});

/**
 * 🔴🔴🔴 CES DEUX CONTRÔLES SONT NÉS D'UN TROU DANS CE BANC, PAS DANS LE CODE.
 * Jugé par injection, il restait MUET quand on retirait la liste blanche des
 * portes et la validation du palier À LA LECTURE. La cause : mes contrôles
 * passaient tous par `poserSurcharge()`, qui refuse déjà ces deux cas — donc
 * la lecture n'était jamais mise à l'épreuve. ⭐⭐ *Un contrôle vert sur un
 * corpus qui ne contient pas son cas ne garde rien.*
 * ⇒ On ÉCRIT DIRECTEMENT EN BASE ce qu'aucune écriture propre ne produirait :
 *   une ligne importée, une porte renommée, une migration à moitié faite.
 *   C'est exactement ce que la lecture doit savoir écarter toute seule.
 */
test('🛡️ une porte HORS liste blanche, écrite directement en base, n\'ouvre rien', () => {
  netto();
  base.run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?)',
    `porte.${SITE}.porte_disparue`,
    JSON.stringify({ tier: 'member', jusqu_a: new Date(Date.now() + 86_400_000).toISOString() }),
    new Date().toISOString());
  assert.equal(portes.lireSurcharges(SITE).length, 0,
    'la lecture doit refermer ce que l\'écriture n\'aurait jamais laissé passer');
});

test('🛡️ un palier INCONNU, écrit directement en base, n\'ouvre rien', () => {
  netto();
  base.run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?)',
    `porte.${SITE}.modules`,
    JSON.stringify({ tier: 'kraken', jusqu_a: new Date(Date.now() + 86_400_000).toISOString() }),
    new Date().toISOString());
  assert.equal(portes.lireSurcharges(SITE).length, 0,
    'un palier inventé ne doit jamais ouvrir — ici comme côté veve-sites');
});

test('🛡️ une surcharge sans « jusqu_a » n\'ouvre rien — même si le JSON est valide', () => {
  netto();
  base.run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?)',
    `porte.${SITE}.modules`, JSON.stringify({ tier: 'member' }), new Date().toISOString());
  assert.equal(portes.lireSurcharges(SITE).length, 0,
    'une surcharge sans date est exactement ce que ce lot existe pour rendre impossible');
});

test('📋 le tableau montre les SEPT portes, surchargées ou non', () => {
  netto();
  portes.poserSurcharge(SITE, 'modules', 'member', 7);
  const t = portes.tableauPortes(SITE);
  assert.equal(t.length, portes.PORTES.length, 'un écran qui ne montre que le surchargé cache ce qu\'on vient poser');
  assert.equal(t.filter((x) => x.active).length, 1);
  assert.ok(t.some((x) => x.porte === 'wallet_watch' && !x.active), 'les non surchargées se montrent aussi');
});

test('📋 une surcharge EXPIRÉE se montre encore, marquée expirée', () => {
  netto();
  portes.poserSurcharge(SITE, 'modules', 'member', 7);
  const dans8jours = new Date(Date.now() + 8 * 86_400_000).toISOString();
  const l = portes.tableauPortes(SITE, dans8jours).find((x) => x.porte === 'modules')!;
  assert.equal(l.active, false);
  assert.equal(l.expiree, true, '« rien » et « ouvert jusqu\'à hier » sont deux états différents');
});

// ═══════════════════════════════════════════════════════════════════════
// §2 — LA CHAÎNE : LA ROUTE DE SERVICE ET LE GESTE D'ADMIN
// ═══════════════════════════════════════════════════════════════════════
test('🔴 /api/portes SANS le secret de service est refusée', async () => {
  const r = await va('/api/portes?site=' + SITE);
  assert.equal(r.status, 401, 'la carte des serrures n\'a rien à faire en public');
});

test('⭐ /api/portes AVEC le secret rend les surcharges vivantes', async () => {
  netto();
  portes.poserSurcharge(SITE, 'modules', 'member', 7);
  const r = await va('/api/portes?site=' + SITE, { 'x-service': SERVICE });
  assert.equal(r.status, 200);
  const j = await r.json() as { portes: { porte: string; tier: string }[] };
  assert.equal(j.portes.length, 1);
  assert.equal(j.portes[0].porte, 'modules');
  assert.equal(j.portes[0].tier, 'member');
});

test('🔴 /api/portes ne rend JAMAIS une surcharge expirée', async () => {
  netto();
  base.run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?)',
    `porte.${SITE}.modules`,
    JSON.stringify({ tier: 'member', jusqu_a: new Date(Date.now() - 1000).toISOString() }),
    new Date().toISOString());
  const r = await va('/api/portes?site=' + SITE, { 'x-service': SERVICE });
  const j = await r.json() as { portes: unknown[] };
  assert.equal(j.portes.length, 0, 'sinon la date de fin ne serait qu\'une décoration');
});

test('🔴 POST /admin/porte sans cookie n\'écrit RIEN', async () => {
  netto();
  const r = await poste('/admin/porte', 'porte=modules&tier=member&jours=7');
  const nimporte = await va('/cette-adresse-nexiste-pas');
  assert.equal(r.status, nimporte.status);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
});

test('⭐ avec le cookie, le geste écrit vraiment', async () => {
  netto();
  const c = await ouvrirSession();
  const r = await poste('/admin/porte', 'porte=modules&tier=member&jours=7', c);
  assert.equal(r.status, 200);
  assert.equal(portes.lireSurcharges(SITE).length, 1);
});

test('🗑️ jours=0 retire la surcharge', async () => {
  netto();
  const c = await ouvrirSession();
  await poste('/admin/porte', 'porte=modules&tier=member&jours=7', c);
  assert.equal(portes.lireSurcharges(SITE).length, 1, 'témoin posé AVANT');
  await poste('/admin/porte', 'porte=modules&jours=0', c);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
});

test('⛔ un champ jours VIDE ne retire rien par la bande — le piège du 163-A', async () => {
  netto();
  const c = await ouvrirSession();
  await poste('/admin/porte', 'porte=modules&tier=member&jours=7', c);
  const r = await poste('/admin/porte', 'porte=modules&tier=member&jours=', c);
  assert.match(await r.text(), /Dur.e refus.e/);
  assert.equal(portes.lireSurcharges(SITE).length, 1,
    'Number("") vaut 0, qui est « retirer » : la forme doit être exigée, pas devinée');
});

test('⛔ au-delà de JOURS_MAX, la route refuse — et sa borne est plus courte qu\'un abonnement', async () => {
  netto();
  const c = await ouvrirSession();
  const r = await poste('/admin/porte', `porte=modules&tier=member&jours=${portes.JOURS_MAX + 1}`, c);
  assert.match(await r.text(), /Dur.e refus.e/);
  assert.equal(portes.lireSurcharges(SITE).length, 0);
  assert.ok(portes.JOURS_MAX < 400,
    'une surcharge ouvre à TOUT LE MONDE, un abonnement à UNE personne : pas la même borne');
});

test('📋 la page /admin affiche bien le bloc des portes', async () => {
  const c = await ouvrirSession();
  const r = await va('/admin', { cookie: c });
  const corps = await r.text();
  assert.match(corps, /Portes du site/);
  assert.match(corps, /wallet_watch/, 'les sept portes doivent être listées');
  assert.match(corps, /adresses/, 'l\'avertissement sur wallet_watch doit être visible');
});
