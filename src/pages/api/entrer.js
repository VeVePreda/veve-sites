// ⚠️ VeVePreda/veve-sites — src/pages/api/entrer.js  (FICHIER NEUF, lot 90)
// ═══════════════════════════════════════════════════════════════════════════
// LE POINT D'ARRIVÉE — celui qui pose enfin `vp_session`.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ CE FICHIER FERME UN TROU QU'ON AVAIT PRIS POUR UN DÉTAIL. Le middleware
// lit `vp_session` depuis le lot 42 ; `api/deconnexion.js` l'efface depuis le
// même lot. Entre les deux, PERSONNE NE LE POSAIT — mesuré le 06/08 : un
// `grep vp_session` sur tout le dépôt ne rendait que ces deux endroits, plus
// une ligne de test. La session n'était pas « à adapter », elle n'existait pas.
//
// LE PARCOURS, EN ENTIER :
//   1. /inscription/   → POST /api/inscription → veveid envoie un courriel
//   2. la personne clique le lien du courriel  → veveid consomme le lien
//   3. veveid redirige ICI avec ?code=…        → 60 s, usage unique
//   4. on échange le code CÔTÉ SERVEUR         → on reçoit le sid
//   5. on pose `vp_session` et on nettoie l'URL par une redirection
//
// 🔴 POURQUOI UN CODE PUIS UN ÉCHANGE, ET PAS LE `sid` DIRECTEMENT DANS L'URL.
// Le `sid` vit trente jours. Une valeur qui vit trente jours ne doit jamais
// traverser une barre d'adresse : elle se dépose dans l'historique du
// navigateur, dans les journaux du serveur ET du proxy, et dans l'en-tête
// `Referer` envoyé à tout site vers lequel on cliquerait ensuite. Le code, lui,
// vit soixante secondes et ne sert qu'une fois — et il est échangé d'ici,
// depuis le serveur, contre un `sid` qui n'arrive au navigateur que dans un
// cookie `HttpOnly`.
//
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
import { retourSur, COOKIE_RETOUR, RETOUR_DEFAUT } from '../../../engine/lib/retour.mjs';
// 🌍 LOT 154-B — la langue du COMPTE reprend la main sur le cookie du NAVIGATEUR.
// ⭐ Ces trois imports ne servent qu'au bloc de la fin du `GET` ; ils sont ici
//   parce qu'Astro n'a pas d'import paresseux analysable, et le coût est nul :
//   `prefs.mjs` n'ouvre sa base qu'au premier appel (ouverture paresseuse).
import { compteDeLaSession } from '../../../engine/lib/compte.mjs';
import { lirePref } from '../../../engine/lib/prefs.mjs';
import { COOKIE_LANGUE, languesInterface } from '../../../engine/lib/i18n.mjs';
import { CLE_THEME, COOKIE_THEME, THEME_DUREE, themeValide } from '../../../engine/lib/theme.mjs';
import {
  CLE_PREF as TB_CLE, COOKIE as TB_COOKIE, COOKIE_DUREE as TB_DUREE,
  lireAgencement, ecrireAgencement,
} from '../../../engine/lib/tableau.mjs';

export const prerender = true;

// ⭐⭐ DEUX NOMS POUR LE MEME SECRET — corrige au lot 94.
// `veveid` lit `ID_SERVICE`, ce depot lisait `VEVEID_SERVICE`. C'est la MEME
// valeur, et rien ne le disait : recopier la variable sous son nom d'origine
// — le geste evident — laissait `x-service` vide, veveid repondait 401, et la
// page affichait « nous n'avons pas pu envoyer le lien ».
// ⭐⭐⭐ UN SECRET PARTAGE QUI PORTE DEUX NOMS SELON LE COTE EST UNE ERREUR DE
//   RECOPIE EN ATTENTE. On accepte donc les deux, et `VEVEID_SERVICE` reste
//   le nom recommande — celui qui dit A QUI on parle.
const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';


// ⚠️ MÊMES ATTRIBUTS QUE `api/deconnexion.js`, AU CARACTÈRE PRÈS. Un cookie
// posé avec `path:'/'` et effacé avec un autre chemin n'est pas effacé : le
// navigateur considère que ce sont deux cookies. C'est la raison n°1 des
// « déconnexions qui ne déconnectent pas », et elle se paie ici, à la pose.
const ATTRIBUTS = { path: '/', sameSite: 'lax', secure: true, httpOnly: true };

// ═══════════════════════════════════════════════════════════════════════════
// 🍪 LE COOKIE D'AFFICHAGE — lot 97, demande de Preda du 06/08/2026.
// ═══════════════════════════════════════════════════════════════════════════
// LE SYMPTÔME : un membre connecté voyait « Inscription » dès qu'il quittait
// les 9 routes dynamiques.
// ⛔ CE N'ÉTAIT PAS UN BUG. `src/middleware.js` sort sur `isPrerendered` : les
// ~8 500 pages sont des FICHIERS, identiques pour tout le monde et pour
// Google — et c'est exactement ce qui fait le référencement. Les rendre à la
// demande pour personnaliser un bouton coûterait le SEO et la vitesse.
//
// ⭐⭐⭐ CE COOKIE N'ACCORDE AUCUN DROIT, ET C'EST LA SEULE CHOSE QUI REND LE
// DISPOSITIF ACCEPTABLE. Il ne porte QUE `1` : ni palier, ni identifiant, ni
// date. Il est falsifiable depuis la console du navigateur — quelqu'un qui le
// pose à la main verra « Mon compte » au lieu de « Inscription », ET RIEN
// D'AUTRE : chaque donnée réservée passe par `/api/historique/`,
// `/api/analytics/` ou une route dynamique, qui lisent toutes `vp_session`
// côté serveur. ⛔ LE JOUR OÙ CE COOKIE DÉCIDERAIT D'UN CONTENU, IL FAUDRAIT
// LE SIGNER — et à ce moment-là ce ne serait plus un cookie d'affichage.
//
// 🔴 `httpOnly: false` EST LE POINT, PAS UN OUBLI. C'est un script de page qui
// doit le lire ; un cookie d'affichage `httpOnly` serait un cookie que
// personne ne peut afficher. C'est aussi la raison pour laquelle il ne peut
// RIEN porter d'autre que ce `1`.
//
// ⚠️ MÊMES ATTRIBUTS QU'À L'EFFACEMENT, AU CARACTÈRE PRÈS — même règle que
// `vp_session` juste au-dessus, et `test:session` la vérifie maintenant pour
// LES DEUX cookies.
// ⚠️ LE NOM EST ÉCRIT EN TOUTES LETTRES DANS LES TROIS FICHIERS QUI LE
// TOUCHENT (ici, `api/deconnexion.js`, `layouts/Base.astro`) — exactement
// comme `vp_session` depuis le lot 42. Un identifiant partagé se lirait mieux,
// mais il rendrait le `grep vp_membre` MUET : c'est ce grep-là qui a fini par
// dire, le 06/08, que personne ne posait `vp_session`. On garde la chaîne
// cherchable, et `test:session` compte les trois bouts.
const ATTRIBUTS_MEMBRE = { path: '/', sameSite: 'lax', secure: true, httpOnly: false };

export async function GET({ url, cookies, redirect }) {
  const code = url.searchParams.get('code') || '';
  const base = process.env.SESSION_API || '';

  // ⛔ SANS SERVICE DE SESSION, ON NE POSE RIEN ET ON LE DIT. Le repli tentant
  // — « pose un cookie quand même, on verra plus tard » — donnerait un cookie
  // que `GET /session/<sid>` ne saurait pas résoudre : le middleware échouerait
  // fermé, et la personne serait « connectée » sans aucun droit, sans rien
  // comprendre. Une panne qui se nomme vaut mieux qu'une demi-session.
  if (!base) {
    return new Response(
      "Le service de session n'est pas configuré (SESSION_API).\n"
      + "Rien n'a été posé — vous n'êtes pas connecté.\n",
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }
  if (!code) return redirect('/connexion/?e=1', 303);

  let sid = null;
  try {
    const r = await fetch(`${base}/api/echange`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // ⭐ Le secret partagé ne sert QU'À LIRE et à échanger : il ne signe
        // rien. Un site compromis ne peut usurper personne.
        'x-service': secretDeService(),
      },
      body: JSON.stringify({ code }),
      // ⚠️ Sans délai maximum, un service muet retient la requête du visiteur
      // jusqu'au bout du timeout système — deux minutes de page blanche, au
      // moment exact où il vient de cliquer le lien de son courriel.
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json();
      if (typeof j?.sid === 'string' && j.sid) sid = j.sid;
    }
  } catch {
    // ⚠️ ÉCHOUER FERMÉ, comme le middleware. Un `catch` qui poserait un cookie
    // au hasard serait exactement le défaut que `palierDeLaSession()` refuse.
    sid = null;
  }

  // Un code périmé ou déjà servi n'est pas une panne : c'est un lien rouvert
  // deux fois, ou une heure plus tard. On le dit sans accuser la personne.
  if (!sid) return redirect('/connexion/?e=2', 303);

  // ⭐ LES DEUX COOKIES ONT LA MÊME DURÉE DE VIE, ET C'EST OBLIGATOIRE. S'ils
  // divergent, le navigateur oublie l'un avant l'autre : soit un membre
  // parfaitement connecté se voit proposer de s'inscrire (durée d'affichage
  // trop courte), soit un ex-membre garde « Mon compte » vers une page qui le
  // renvoie à la connexion (durée trop longue). Une seule constante décide.
  const DUREE = 30 * 24 * 3600;
  cookies.set('vp_session', sid, { ...ATTRIBUTS, maxAge: DUREE });
  cookies.set('vp_membre', '1', { ...ATTRIBUTS_MEMBRE, maxAge: DUREE });

  // ═════════════════════════════════════════════════════════════════════════
  // 🌍 LOT 154-B — LA LANGUE DU COMPTE REPREND LA MAIN, ET C'EST ICI, PAS AILLEURS
  // ═════════════════════════════════════════════════════════════════════════
  // LE DÉFAUT SIGNALÉ PAR PREDA (10/08) : « je règle sur français, la
  // navigation me remet en anglais ». Le lot 123 avait posé le cookie ; il
  // restait qu'un cookie appartient à UN navigateur. Changer de téléphone, ou
  // vider ses cookies, et la préférence disparaît sans que rien ne le dise.
  //
  // ⭐⭐⭐ POURQUOI CE BLOC EST DANS `/api/entrer` ET NULLE PART AILLEURS.
  // Résoudre le compte demande `${SESSION_API}/api/session?sid=…` — un endpoint
  // DIFFÉRENT de celui du middleware, avec le secret de service et un délai de
  // 4 s. Le placer dans le middleware ajouterait cet aller-retour à CHAQUE page
  // rendue à la demande, dont `/market/` qui est `no-store` et donc repayée à
  // chaque visite — pour choisir un dictionnaire.
  // ⛔ Et ça ne suffirait même pas : les ~3 000 pages publiques sont
  //   pré-générées, le middleware sort avant elles, il n'y a aucun serveur à
  //   qui demander. Elles ne lisent QUE le cookie (`src/socle/55-langue.js`).
  // ⇒ La base est la VÉRITÉ, le cookie est le PORTEUR. La connexion est le seul
  //   moment où l'aller-retour est DÉJÀ payé, et c'est aussi exactement le
  //   moment où « je change d'appareil » se pose.
  //
  // 🔴 CE BLOC NE PEUT PAS FAIRE ÉCHOUER LA CONNEXION, ET C'EST DÉLIBÉRÉ.
  // Une préférence d'affichage n'est pas un droit d'accès. Si veveid est muet,
  // si `/data` n'est pas monté, si la base est illisible — on se connecte quand
  // même, avec la langue du navigateur. ⛔ Le `catch` qui « échoue fermé » est
  // la bonne règle pour une SESSION (middleware l. 48) ; l'appliquer à un choix
  // de dictionnaire refuserait l'entrée pour une raison décorative.
  try {
    const compte = await compteDeLaSession(sid);
    if (compte) {
      const voulue = lirePref(compte, 'langue');
      // ⛔ ON REVALIDE CONTRE LE MANIFESTE. La valeur vient de notre base, donc
      //   d'une écriture passée — mais `languesInterface()` peut avoir CHANGÉ
      //   depuis (une langue retirée du site). Poser un code que le site ne
      //   sert plus composerait un chemin de dictionnaire absent dans `dict()`,
      //   et l'interface retomberait en anglais sans que rien ne l'explique.
      //   ⭐ Le magasin ne juge pas ses valeurs — `prefs.mjs` borne la forme,
      //   c'est ici qu'on borne le SENS. Un seul juge, celui qui sait.
      if (voulue && languesInterface().includes(voulue)) {
        // ⭐ MÊMES ATTRIBUTS QUE `/compte/` (l. 71) — `httpOnly: false`, parce
        //   que `55-langue.js` doit pouvoir le lire depuis le navigateur sur
        //   les 3 000 pages pré-générées. Un cookie `HttpOnly` ici rendrait la
        //   préférence invisible là où elle sert le plus.
        cookies.set(COOKIE_LANGUE, voulue, {
          path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: true, httpOnly: false,
        });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 📊 LOT 202 — L'AGENCEMENT DU TABLEAU DE BORD SUIT LE COMPTE, PAS LE
      //    NAVIGATEUR. Même dispositif que la langue, ligne pour ligne, et pour
      //    la même raison mesurée : `/dashboard/` ne connaît PAS le compte.
      // ⭐ IL EST POSÉ MÊME QUAND RIEN N'EST RANGÉ, et c'est ce qui le distingue
      //    de la langue. `lireAgencement(null)` rend l'ordre par défaut au
      //    complet ; l'écrire dans le cookie fait qu'un membre qui vient de
      //    changer d'appareil, ou qui n'a jamais ouvert le réglage, part d'un
      //    état EXPLICITE au lieu d'un cookie absent. La page saurait s'en
      //    passer — mais le jour où le défaut du site changera, un cookie vide
      //    et un cookie « je veux le défaut d'alors » deviendraient deux choses
      //    différentes, et on ne pourrait plus les distinguer après coup.
      // ⛔ `httpOnly: true`, contrairement au cookie de langue : personne ne le
      //    lit côté navigateur. La différence est expliquée dans `tableau.mjs`.
      const range = lirePref(compte, TB_CLE);
      cookies.set(TB_COOKIE, ecrireAgencement(lireAgencement(range)), {
        path: '/', maxAge: TB_DUREE, sameSite: 'lax', secure: true, httpOnly: true,
      });

      // ═══════════════════════════════════════════════════════════════════════
      // 🎨 LOT 217 — LE THÈME SUIT LE COMPTE, ET C'EST LE TROISIÈME ET DERNIER.
      //    Langue (154-B), tableau de bord (202), thème (217) : `/compte/`
      //    disait « ils suivent ce navigateur » des trois. Ce n'est plus vrai
      //    d'aucun, et la phrase change dans le même commit.
      // ⭐⭐ IL N'EST POSÉ QUE S'IL EST RANGÉ, et c'est L'INVERSE du bloc
      //    au-dessus. Un thème absent n'a pas de « défaut explicite » à
      //    fabriquer : le site est clair, et poser `vp_theme=jour` sur un
      //    compte qui n'a jamais touché au réglage écraserait le choix fait
      //    dans CE navigateur (`localStorage`) par un choix que personne n'a
      //    fait. *Un défaut posé comme une décision efface les vraies.*
      // ⛔ Et on ne RETIRE pas le cookie quand la base est muette : la personne
      //    a peut-être choisi dans ce navigateur avant d'avoir un compte.
      const teinte = themeValide(lirePref(compte, CLE_THEME));
      if (teinte) {
        cookies.set(COOKIE_THEME, teinte, {
          path: '/', maxAge: THEME_DUREE, sameSite: 'lax', secure: true, httpOnly: false,
        });
      }
    }
  } catch { /* ⭐ silence VOLONTAIRE — voir le paragraphe ci-dessus */ }

  // ⭐ ON NETTOIE L'URL PAR UNE REDIRECTION. Sans elle, `?code=…` resterait
  // dans la barre d'adresse, dans l'historique, et partirait dans le `Referer`
  // du premier lien cliqué depuis la page. Le code est déjà consommé, mais on
  // ne laisse pas traîner un secret usagé : la prochaine version pourrait
  // l'être moins.
  // 🔴🔴🔴 LOT 126 — ON RESTITUE LA DESTINATION, ET LE DÉFAUT DEVIENT
  // `/dashboard/`. Cette ligne rendait `/compte/` sans condition : les quatre
  // `?suite=…` écrits par `/market/` et `/favoris/` mouraient ici, en silence.
  // ⭐ On REVALIDE au retour, alors que `/connexion/` avait déjà validé à
  // l'aller. Ce n'est pas de la superstition : entre les deux il y a un cookie,
  // c'est-à-dire quelque chose que le navigateur porte et qu'un autre script de
  // la même origine peut avoir écrit. « Validé une fois, quelque part » n'est
  // pas « valide ici ».
  // ⛔ ET ON L'EFFACE. Un cookie de retour qui survit ramènerait quelqu'un sur
  // `/market/` trois connexions plus tard, sans qu'il comprenne pourquoi.
  const _brut = cookies.get(COOKIE_RETOUR)?.value || '';
  cookies.delete(COOKIE_RETOUR, { path: '/' });
  return redirect(retourSur(_brut) || RETOUR_DEFAUT, 303);
}

// Un POST ici n'est pas une entrée. Un 405 explicite plutôt qu'un 404, qui
// ferait croire à une route absente et enverrait quelqu'un la réécrire.
export const POST = () => new Response('Méthode non autorisée — utiliser GET.',
  { status: 405, headers: { allow: 'GET' } });
