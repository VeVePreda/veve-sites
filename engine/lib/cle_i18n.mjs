// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 139 — « QU'EST-CE QU'UNE CLÉ ? », DÉCLARÉ **UNE SEULE FOIS**
// ═══════════════════════════════════════════════════════════════════════════
// Ce module existe pour une raison mesurée : **P30, 1 199 libellés restés en
// anglais chez les visiteurs fr/es/de** — et le diagnostic écrit dans
// `SUIVI.md` était FAUX.
//
// ## CE QUE DISAIT LA NOTE, ET CE QUE DIT LA MESURE
//
// La note : « un gabarit transforme le résultat de `t()` » — la famille du
// lot 129, où `{t(lang,'analytics.title').toUpperCase()}` met LA CLÉ en
// capitales avec le texte.
//
// La mesure : les quatre clés incriminées — `item.drop.RESERVATION`,
// `.WAITLIST`, `.CRAFT`, `.AUCTION` — **existent, et sont traduites dans les
// CINQ dictionnaires** (en, fr, es, de, it). Aucun gabarit ne les déforme :
// `Item.astro` écrit `t(lang, \`item.drop.\${v}\`)` avec `v` déjà en capitales
// depuis `dataset.mjs` (`drop_method` normalisé en majuscules, lot ancien).
// **La clé est correcte. C'est le CONTRÔLE qui la refuse.**
//
//     FORME_CLE = /^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$/
//                    ↑ chaque segment doit COMMENCER par une minuscule
//
// `item.drop.RESERVATION` a un segment qui commence par une majuscule ⇒ refusé
// ⇒ non marqué ⇒ jamais échangé ⇒ **anglais chez 100 % des visiteurs fr/es/de**,
// sur 1 199 fiches. Et la page s'affiche parfaitement.
//
// ⭐⭐⭐ **TREIZIÈME NOTE PERSONNELLE DÉMENTIE PAR LA MESURE**, et celle-ci
// accusait un gabarit innocent pendant que l'instrument était en cause. C'est
// la deuxième fois exactement pour ce même contrôle : `marquer_i18n.mjs`
// porte déjà, écrit à la main, « ⚠️ Le `_` EST LÉGITIME : la première version
// de cette forme refusait huit clés parfaitement valides ». La leçon avait été
// écrite ; elle n'avait pas été GÉNÉRALISÉE. *Un contrôle trop strict produit
// exactement le même symptôme qu'une vraie panne — et le corriger d'un cas
// particulier laisse le cas particulier suivant.*
//
// ## LE REMÈDE — LA SOURCE DE VÉRITÉ, PAS L'APPARENCE
//
// ⭐⭐⭐ **UNE CLÉ N'EST PAS UNE CHAÎNE QUI RESSEMBLE À UNE CLÉ : C'EST UNE
// ENTRÉE DU DICTIONNAIRE.** La forme était une DEVINETTE sur ce qu'est une
// clé, faite à côté du fichier qui le sait. On interroge donc le dictionnaire
// de référence, qui est déjà chargé deux lignes plus loin dans les deux
// appelants.
//
// | chaîne rencontrée | au dictionnaire ? | verdict | pourquoi |
// |---|---|---|---|
// | `item.drop.RESERVATION` | ✅ | **clé** | traduite dans les 5 langues |
// | `mod.price_history`     | ✅ | **clé** | le `_` cesse d'être un cas spécial |
// | `ANALYTICS.TITLE`       | ❌ | **déformée** | un `.toUpperCase()` l'a mangée |
// | `home.titreNeuf`        | ❌ | **clé** (forme valide) | pas encore traduite — |
//
// ⛔ **ET LA DERNIÈRE LIGNE EST LE POINT DÉLICAT.** Une clé bien formée mais
// absente du dictionnaire n'est PAS une déformation : c'est une traduction
// manquante. Les confondre remettrait exactement la faute qu'on répare — un
// contrôle qui accuse la mauvaise cause. ⇒ la forme SURVIT, mais comme
// deuxième chance et non comme juge : `estUneCle` accepte ce que le
// dictionnaire connaît **ou** ce qui a la forme d'une clé. Ne reste refusé que
// ce qui échoue aux DEUX — et c'est très exactement le profil d'un `t()`
// transformé par un gabarit.
// ⭐ La traduction manquante, elle, a déjà son lecteur : `test:i18n` §3
// (« les dictionnaires servis couvrent-ils ce qui est marqué ? »).
//
// ## ⛔ POURQUOI CE FICHIER EXISTE PLUTÔT QUE DEUX COPIES DU PRÉDICAT
//
// 🔴 **LE MARQUEUR ÉCRIT `data-i18n=`, LE BANC LE RELIT.** `marquer_i18n.mjs`
// décide ce qui est marqué ; `test_i18n_client.mjs` §2 refuse toute clé marquée
// qui n'a pas la forme d'une clé — **avec sa PROPRE copie de la regexp**.
// Élargir l'un sans l'autre fait rougir le banc sur ce que le marqueur vient
// d'accepter : le déploiement s'arrête, et le message accuse un gabarit qui
// n'a rien fait. C'est `regle-chaine-a-cinq-morceaux` en deux fichiers.
// ⇒ Le prédicat est déclaré ICI, les deux l'importent. Même geste que les
// budgets de nom de `engine/lib/vignette.mjs` au même lot.
// ═══════════════════════════════════════════════════════════════════════════

/** La forme d'une clé : des segments en minuscule initiale, séparés par des
 *  points. Le `_` est légitime (`mod.price_history`, `mod.wallet_watch`).
 *  ⛔ Ce n'est plus le juge — voir `estUneCle`. C'est le repêchage des clés
 *  neuves, pas encore présentes au dictionnaire de référence. */
export const FORME_CLE = /^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$/;

/**
 * Une chaîne est-elle une clé i18n, ou le résidu d'un `t()` transformé ?
 *
 * @param {string} cle       la chaîne trouvée entre les sentinelles
 * @param {object} [dictRef] le dictionnaire de référence (`engine/i18n/<def>.json`)
 * @returns {boolean}
 *
 * ⚠️ `dictRef` ABSENT ⇒ on retombe sur la forme SEULE. C'est volontaire et
 * c'est le comportement d'avant ce lot : un appelant qui n'a pas de
 * dictionnaire sous la main ne doit pas se mettre à tout accepter. ⛔ Mais il
 * ne doit pas non plus se croire complet — les deux appelants du dépôt le
 * passent, et `test:i18n` vérifie qu'ils le passent (§2 bis).
 */
export const estUneCle = (cle, dictRef) => {
  const c = String(cle || '');
  if (!c) return false;
  if (dictRef && Object.prototype.hasOwnProperty.call(dictRef, c)) return true;
  return FORME_CLE.test(c);
};

/**
 * Le dictionnaire de référence, chargé une fois. ⭐ C'est la langue PIVOT
 * (`locales().def`) : c'est elle qui est écrite en dur dans le HTML servi, donc
 * c'est elle qui définit l'ensemble des clés que le marqueur peut rencontrer.
 * ⛔ Renvoie `null` plutôt que `{}` si le fichier manque : `{}` ferait taire le
 * dictionnaire en le faisant passer pour vide, et `estUneCle` retomberait sur
 * la forme sans que personne ne le sache. *Un repli silencieux est un repli
 * qu'on découvre trois lots plus tard.*
 */
export const chargerDictRef = async (readFileSync, join, racineEngine) => {
  const { locales } = await import(join(racineEngine, 'lib', 'i18n.mjs'));
  const { def } = locales();
  try {
    return JSON.parse(readFileSync(join(racineEngine, 'i18n', `${def}.json`), 'utf8'));
  } catch {
    return null;
  }
};
