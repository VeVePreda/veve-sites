// ⚠️ VeVePreda/veve-sites — src/pages/api/reglages.js  (FICHIER NEUF — lot 160-A)
// ═══════════════════════════════════════════════════════════════════════════
// LES RÉGLAGES DU MEMBRE — pour l'instant, un seul : la newsletter
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 CE QUE PREDA A DEMANDÉ (point `ae` de l'audit du 14/08) : « réglages
//    Emails — ne pas recevoir la newsletter ».
//
// 🔴🔴🔴 ET CE QUE CETTE ROUTE NE FAIT PAS, ÉCRIT ICI POUR QUE PERSONNE NE LE
//    DÉCOUVRE DANS SIX MOIS : elle range une préférence QUE RIEN NE LIT
//    AUJOURD'HUI. Mesuré le 19/08/2026 — aucun envoyeur de courriel dans ce
//    dépôt (douze routes `api/`, zéro mail), ni dans `scrapeur-veve`,
//    `jetonveve` ou `veveid`. Et le verrou est structurel : la préférence vit
//    dans `/data/veve-favoris.db`, monté sur LE CONTENEUR veveprice — un envoi
//    parti d'ailleurs ne peut pas l'ouvrir.
//    ⇒ Arbitré avec Preda : on l'écrit, et `/compte/` LE DIT
//    (`account.mail.none`). Un réglage muet qui a l'air de marcher est le motif
//    `langouste`/`whale`, et ce projet l'a déjà payé une fois.
//
// ⭐⭐ POURQUOI UNE ROUTE ET PAS UN POST SUR `/compte/` — même raison qu'au lot
//    164, et elle n'a pas changé : AUCUNE page `.astro` de ce dépôt ne traite
//    de POST, et le contrôle d'origine d'Astro dépend de `X-Forwarded-Proto`,
//    donc de Cloudflare, donc d'une chose que je ne peux pas éprouver ici.
//    `api/supprimer.js` et `api/portes.js` font déjà exactement ça — formulaire
//    de `/compte/` → route → redirection — et les deux sont en production.
//    ⛔ On copie le patron éprouvé, on n'en invente pas un qu'on ne peut pas
//    mesurer. ⭐ Et ça marche sans JavaScript, comme le reste du site.
//
// ⛔ SURTOUT PAS UN GET : un geste qui écrit derrière un GET s'exécute depuis
//    n'importe quel site par une balise `<img src="…">`.
//
// 🔑 UN SEUL DES QUATRE ENDROITS À TOUCHER, et ce n'est pas une économie : une
//    route `pages/api/` est routée par nginx via `location ^~ /api/`, qui est
//    GÉNÉRIQUE, et `cache_attendu.mjs` la couvre par la famille `pages/api/`
//    (l. 217). Reste `astro_routes_compte.mjs` — sans lui, la route serait
//    PRÉ-GÉNÉRÉE en silence, c'est-à-dire un fichier figé incapable de lire une
//    session ou d'écrire dans `/data`. C'est la panne du lot 24, la cinquième
//    fois qu'on l'écrit.
//
// ⭐ LITTÉRAL, ET C'EST LE POINT. `prerender` doit être statiquement
//    analysable ; la valeur réelle est posée par l'intégration
//    `veve:routes-compte` selon le mode du manifeste. (Même formule que
//    `api/supprimer.js` et `api/portes.js` — ⛔ ne pas la « simplifier ».)
export const prerender = true;

import { compteDeLaSession } from '../../../engine/lib/compte.mjs';
import { poserPref, retirerPref } from '../../../engine/lib/prefs.mjs';

export async function POST({ request, cookies, redirect }) {
  const sid = cookies.get('vp_session')?.value || null;
  // ⛔ ÉCHOUER FERMÉ. Pas de session : on ne règle rien, et on renvoie sur
  //    `/compte/` — qui redirigera vers `/connexion/` si la session est
  //    vraiment absente. ⚠️ Sans code d'erreur : dire « vous n'êtes pas
  //    connecté » sur une route d'écriture apprend à un inconnu qu'elle existe.
  if (!sid) return redirect('/compte/', 303);

  let f;
  try { f = await request.formData(); } catch { return redirect('/compte/?m=err', 303); }

  // 🔴🔴 LE TÉMOIN DE FORMULAIRE, ET IL N'EST PAS DÉCORATIF.
  //   Une case à cocher NON COCHÉE n'est pas envoyée par le navigateur — c'est
  //   la règle HTML. `f.get('news')` vaut donc `null` dans DEUX situations
  //   opposées : « la personne a décoché » et « la requête ne vient pas de ce
  //   formulaire ». Sans témoin, un POST vide — une page tierce, un robot, un
  //   rejeu — DÉSABONNERAIT, en rendant une redirection de succès.
  //   ⭐ C'est la même faute que `Number('') === 0` au lot 164 : une valeur
  //   absente qui se lit comme une valeur significative. La sentinelle est ici
  //   un champ caché, et elle tombe hors du chemin d'écriture.
  if (String(f.get('poste') ?? '') !== '1') return redirect('/compte/?m=err', 303);

  // ⭐ ON RÉSOUT LE COMPTE ICI, ET SEULEMENT ICI. C'est un aller-retour de 4 s
  //   vers veveid — acceptable AU CLIC, jamais à chaque affichage. C'est
  //   exactement le dimensionnement du lot 154-B (`_ch.aPoser`), et c'est la
  //   raison pour laquelle `/compte/` lit la préférence dans `dossier`, qu'il
  //   possède déjà, au lieu d'appeler cette fonction.
  // ⛔ ON DEMANDE AVEC LE `sid`, JAMAIS AVEC UN IDENTIFIANT DE COMPTE : ce site
  //   ne détient pas l'identité, il a un cookie. Lui laisser DÉSIGNER un compte,
  //   le secret de service en main, reviendrait à le laisser tous les lire.
  let compte = null;
  try {
    compte = await compteDeLaSession(sid);
  } catch {
    // ⭐⭐ « JE NE SAIS PAS » N'EST PAS « IL N'Y A PERSONNE », et les deux ne
    //   sortent pas par la même porte. `compteDeLaSession()` LÈVE quand veveid
    //   est muet et rend `null` quand il répond « non ». Écrire une préférence
    //   sous un compte qu'on n'a pas pu identifier serait l'écrire sous le
    //   mauvais ; on le dit, et on n'écrit rien.
    return redirect('/compte/?m=err', 303);
  }
  if (!compte) return redirect('/compte/', 303);

  const veutNews = String(f.get('news') ?? '') === '1';

  try {
    // ⭐⭐⭐ ABSENT ≠ VIDE, ET C'EST POURQUOI ON RETIRE AU LIEU D'ÉCRIRE `'1'`.
    //   `prefs.mjs` le dit en toutes lettres : « retirer une préférence n'est
    //   pas la mettre à vide — une clé absente retombe sur le DÉFAUT DU SITE ».
    //   Le défaut est « recevoir ». Ranger `'1'` figerait donc le défaut
    //   d'aujourd'hui sous le compte : le jour où le site changerait d'avis,
    //   tous ceux qui n'ont jamais touché au réglage suivraient, et tous ceux
    //   qui l'ont explicitement remis à « oui » resteraient sur l'ancien —
    //   deux populations indiscernables, et aucune trace de la différence.
    //   ⭐ En prime, cela économise une ligne par compte sur le plafond de 30
    //   clés de `poserPref()`.
    const r = veutNews ? retirerPref(compte, 'mail_news')
                       : poserPref(compte, 'mail_news', '0');
    if (!r?.ok) return redirect('/compte/?m=err', 303);
  } catch {
    // ⭐ ICI ON NE SE TAIT PAS. `/data` non monté, disque plein : un réglage
    //   qu'on croit posé et qui ne l'est pas envoie chercher le défaut ailleurs
    //   pendant une heure. La page le dira (`account.mail.err`).
    return redirect('/compte/?m=err', 303);
  }

  // ⛔ LA TRACE DIT LE GESTE, JAMAIS QUI L'A FAIT — même règle que les autres
  //    routes de compte : le journal du serveur n'a pas à porter d'identité.
  //    ⚠️ Ni l'identifiant de compte, qui EST une identité chez veveid.
  console.log(`[reglages] mail_news → ${veutNews ? 'defaut (recevoir)' : 'refus'}`);
  return redirect('/compte/?m=ok', 303);
}

// ⭐ MÊME FORME QUE `api/supprimer.js`, `api/portes.js` ET `api/inscription.js` :
//   un GET sur une route qui écrit est une erreur d'appel, pas une page. On le
//   dit en 405 plutôt qu'en 404, qui enverrait chercher un fichier manquant.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
