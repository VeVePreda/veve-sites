// ⚠️ VeVePreda/veve-sites — engine/tools/_dom_banc.mjs   (FICHIER NEUF — lot 133)
// ═══════════════════════════════════════════════════════════════════════════
//  LE DOM DES BANCS — les correctifs d'instrument, écrits UNE fois
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 POURQUOI CE FICHIER EXISTE, ET IL N'EST PAS UN CONFORT.
// Trois bancs exécutent désormais le script d'une page dans un DOM : `test:tuiles`
// (lot 127), `test:i18n` (lot 129), `test:plages` (lot 132) — et `test:series`
// (lot 133) est le quatrième. Tous montent `linkedom`, et `linkedom` a des
// manques connus qu'il faut compenser AVANT d'exécuter quoi que ce soit.
//
// ⭐⭐⭐ LE CORRECTIF ÉTAIT DÉJÀ ÉCRIT DANS `test_tuiles.mjs`, ET JE VENAIS DE LE
// REDÉCOUVRIR À L'IDENTIQUE. Le pilote des filtres lève
// `Cannot read properties of undefined (reading 'trim')` — c'est `val('s-tri')`
// sur un `<select>` dont `linkedom` ne définit pas `.value`. Exactement la
// panne, exactement la cause, exactement le remède : à 60 lignes d'écart dans un
// autre fichier.
// ⛔ RECOPIER LE CORRECTIF AURAIT ÉTÉ LA QUATRIÈME OCCURRENCE DE « deux
//    endroits qui font la même chose divergent en silence » — et la troisième
//    fois que je l'écris dans le même dépôt en deux jours. *Le tag est une
//    variable, le corps s'écrit une fois* vaut aussi pour les instruments.
//
// ⚠️ CE MODULE NE JUGE RIEN. Il monte un DOM utilisable et rend la main. Un
// helper qui déciderait à la place du banc rendrait tous les bancs d'accord
// entre eux — c'est-à-dire aveugles ensemble.

/** Monte le HTML dans un DOM et applique les correctifs d'instrument connus.
 *  Rend `null` si linkedom est absent — le banc appelant doit alors sortir en
 *  INDÉCIDABLE, ⛔ jamais en vert : « le comportement n'a pas été mesuré » et
 *  « le comportement est correct » sont deux phrases différentes. */
export async function monterDOM(html) {
  let parseHTML = null;
  try { ({ parseHTML } = await import('linkedom')); } catch { /* absent */ }
  if (!parseHTML) return null;

  const { document, window } = parseHTML(html);

  // ⚠️ CORRECTIF 1 — `<select>.value`. linkedom ne le rend pas : toute page qui
  // lit un sélecteur (`val('s-tri')`, les tris du Marché et des Séries) lève sur
  // `undefined.trim()`. On rend la valeur de l'option marquée `selected`, à
  // défaut la première — ce que fait un navigateur.
  //
  // 🔴🔴🔴 ET LA CONDITION SE MESURE, ELLE NE SE DEVINE PAS — payé en écrivant
  // ce fichier, dans le fichier même qui existe pour éviter ça.
  // Ma première version testait `!Object.getOwnPropertyDescriptor(proto, 'value')`
  // — « la propriété est-elle absente ? ». Or **le descripteur EXISTE** chez
  // linkedom : il rend simplement `undefined`. Le correctif ne s'appliquait donc
  // jamais, le banc levait exactement comme avant, et le module partagé qui
  // devait régler le problème le laissait passer en silence.
  // ⭐⭐⭐ « EST-CE LÀ ? » N'EST PAS « EST-CE QUE ÇA MARCHE ? » — la première des
  // sept règles du CSS de ce dépôt, appliquée à du JavaScript. ⇒ On MONTE un
  // témoin et on LIT ce qu'il rend. Un contrôle de présence sur une propriété
  // définie-mais-inerte est un contrôle qui répond « oui » à la mauvaise question.
  const temoin = document.createElement('select');
  temoin.innerHTML = '<option value="_t">t</option>';
  const selectCasse = temoin.value !== '_t';
  if (window.HTMLSelectElement && selectCasse) {
    Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
      get() {
        const o = this.querySelector('option[selected]') || this.querySelector('option');
        return o ? (o.getAttribute('value') ?? o.textContent) : '';
      },
      set(v) {
        for (const o of this.querySelectorAll('option')) {
          if ((o.getAttribute('value') ?? o.textContent) === v) o.setAttribute('selected', '');
          else o.removeAttribute('selected');
        }
      },
      configurable: true,
    });
  }

  return { document, window };
}

/** Coche une case ET prévient la page.
 *  🔴🔴 CORRECTIF 2 — payé le 10/08 en écrivant `test:series`, et il est
 *  invisible : chez linkedom, le sélecteur CSS `:checked` suit **l'ATTRIBUT**,
 *  pas la propriété. `input.checked = true` ne change donc RIEN pour un pilote
 *  qui lit `querySelectorAll('input:checked')` — et c'est ce que font les deux
 *  pilotes de ce dépôt.
 *  ⭐⭐⭐ LE BANC PASSAIT QUAND MÊME, ET C'EST LE PLUS GRAVE : ma contre-épreuve
 *  (« décocher rend tout ») comparait à un nombre calculé depuis le HTML, pas au
 *  nombre mesuré juste avant. Elle voyait donc « 37 après » ≠ « 28 attendus » et
 *  se déclarait verte — alors que rien n'avait jamais été coché.
 *  *Un banc qui ne compare pas un AVANT à un APRÈS mesurés ne prouve pas un
 *  changement, il constate un état.*
 *  ⛔ Mesurer les deux bornes, toujours. Vérifié : `.checked` seul → 0 case vue,
 *  `setAttribute('checked','')` → 1. On pose les DEUX (l'attribut pour les
 *  sélecteurs, la propriété pour le code qui la lit). */
export function cocher(input, window, formulaire, valeur = true) {
  if (valeur) input.setAttribute('checked', '');
  else input.removeAttribute('checked');
  input.checked = valeur;
  (formulaire || input).dispatchEvent(new window.Event('change', { bubbles: true }));
}

/** Change la valeur d'un `<select>` ET prévient la page, comme un humain.
 *  ⛔ Poser `.value` sans émettre l'évènement ne déclencherait rien : le pilote
 *  écoute `change` sur le formulaire. Un banc qui change l'état sans le notifier
 *  mesure un écran que personne ne verra jamais. */
export function choisir(select, valeur, window, formulaire) {
  select.value = valeur;
  (formulaire || select).dispatchEvent(new window.Event('change', { bubbles: true }));
}
