#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tient à jour `engine/data/lastmod.<site>.json` — la date de dernier CHANGEMENT
RÉEL de chaque famille de pages.

    python3 engine/tools/lastmod.py --site vevewiki

À lancer DANS LE WORKFLOW, après la récolte éditoriale et AVANT le commit :
le build, lui, se contente de lire le fichier produit ici.

================================================================================
POURQUOI CE FICHIER EXISTE
================================================================================
Le sitemap datait ses 82 URL du jour du build. Les mentions légales, inchangées
depuis des mois, se déclaraient modifiées chaque matin. Un `lastmod` qui bouge
partout tous les jours est un `lastmod` qu'un moteur apprend à ignorer — et il
ne vaut alors plus rien les jours où il dirait vrai.

⚠️ LE PIÈGE, ET IL EST SUBTIL : on ne peut PAS dater le contenu avec la date de
   récolte. `pulled_at` change à chaque passage du workflow, même quand le Sheet
   n'a pas bougé d'une virgule. Utiliser `pulled_at` aurait reproduit exactement
   le défaut qu'on corrige, en ayant l'air de le corriger.
➡️ On date donc par EMPREINTE DU CONTENU : on hache les enregistrements, en
   IGNORANT les champs de récolte. Tant que l'empreinte ne bouge pas, la date
   ne bouge pas — quel que soit le nombre de passages.

⭐ GRANULARITÉ : par SECTION, pas par entité. Une fiche de marque change quand
   `brands.json` ou les agrégats changent ; la dater à la section est déjà
   infiniment plus juste que « aujourd'hui », et surtout cela n'oblige PAS à
   reproduire ici la fabrication des slugs, qui vit dans le JavaScript. Deux
   implémentations d'une même règle finissent toujours par diverger.
   Les ARTICLES font exception : ils portent déjà leur propre date dans le
   Sheet, et le sitemap l'utilise déjà. On n'y touche pas.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
from datetime import date

RACINE = pathlib.Path(__file__).resolve().parent.parent.parent

# 🔴🔴 UN FICHIER PAR SITE, ET CE N'EST PAS UN DETAIL DE RANGEMENT.
# Jusqu'au 29/07/2026 il n'existait qu'un seul `engine/data/lastmod.json` pour
# TOUT le depot, alors que `SURVEILLE` pointe des chemins `sites/{site}/...`.
# Tant qu'un seul site lancait cet outil, personne ne pouvait s'en apercevoir.
# Le jour ou on l'aurait lance pour un DEUXIEME site, voici ce qui serait
# arrive, sans une ligne d'erreur :
#   - les chemins `sites/veveprice/editorial/*.json` n'existent pas ;
#   - `empreinte()` rend '' pour chacun -> une empreinte parfaitement valide ;
#   - elle differe de celle de vevewiki -> « la section a change » ;
#   - toutes les dates de vevewiki sont REECRITES a aujourd'hui.
# Le correctif aurait detruit ce qu'il venait reparer, et le seul symptome
# aurait ete un sitemap qui redate tout — exactement le defaut d'origine.
# ➡️ La sortie porte donc le nom du site, et le fichier declare a QUI il
#    appartient (cle `site`) : lire celui d'un autre est refuse, bruyamment.
LEGACY = RACINE / 'engine' / 'data' / 'lastmod.json'


def sortie(site: str) -> pathlib.Path:
    return RACINE / 'engine' / 'data' / f'lastmod.{site}.json'

# Les champs que la RÉCOLTE ajoute, et qui ne disent rien du contenu.
# ⚠️ Oublier d'en exclure un suffit à faire « changer » le contenu chaque jour.
CHAMPS_DE_RECOLTE = {'pulled_at', 'count', 'generated_at', 'collecte'}

# Ce qui fait vraiment changer chaque famille de pages.
#   clé  ->  (chemins relatifs à surveiller)
SURVEILLE = {
    'glossary': ['sites/{site}/editorial/glossary.json'],
    'acronyms': ['sites/{site}/editorial/acronyms.json'],
    'annuaire': ['sites/{site}/editorial/annuaire.json'],
    'history':  ['sites/{site}/editorial/history.json'],
    'brands':   ['sites/{site}/editorial/brands.json'],
    # Les fiches d'entité affichent des chiffres calculés : elles changent
    # aussi quand les agrégats ou les figures changent.
    'donnees':  ['engine/data/licence_agregats.json', 'engine/data/figures'],
    # Le texte légal vit dans le code, pas dans le Sheet.
    # ⚠️ CORRIGÉ le 28/07 : seul `legal.mjs` était surveillé — le MOTEUR, pas les
    # TEXTES. Conséquence exacte : ajouter `engine/legal/it.json` (des mentions
    # légales entières, dans une langue de plus) ne changeait pas la date, tandis
    # qu'un simple remaniement de code la changeait. Le défaut s'est vu parce que
    # les deux sont arrivés le même jour et que la date a bougé pour la MAUVAISE
    # raison. On surveille désormais les deux : le gabarit et ce qu'il rend.
    'legal':    ['engine/lib/legal.mjs', 'engine/legal'],
}


def empreinte(chemin: pathlib.Path) -> str:
    """Empreinte du CONTENU, insensible aux champs de récolte et à l'ordre."""
    if chemin.is_dir():
        parts = [empreinte(p) for p in sorted(chemin.glob('*.json'))]
        return hashlib.sha256('|'.join(parts).encode()).hexdigest()
    if not chemin.exists():
        return ''
    brut = chemin.read_bytes()
    if chemin.suffix == '.json':
        try:
            d = json.loads(brut)
        except json.JSONDecodeError:
            return hashlib.sha256(brut).hexdigest()
        if isinstance(d, dict):
            d = {k: v for k, v in d.items() if k not in CHAMPS_DE_RECOLTE}
        # `sort_keys` : deux exports du même contenu dans un ordre de clés
        # différent ne doivent pas compter comme un changement.
        brut = json.dumps(d, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(brut).hexdigest()


def charger(site: str) -> dict:
    """Lit le fichier du site, avec reprise unique de l'ancien fichier commun.

    ⚠️ La reprise ne vaut QUE pour vevewiki : c'est le seul site qui ait jamais
    lance cet outil, donc le seul dont l'ancien `lastmod.json` porte vraiment
    les dates. Reprendre ce fichier pour un autre site lui attribuerait des
    dates qui ne sont pas les siennes — un mensonge plus difficile a voir que
    l'absence de dates.
    """
    f = sortie(site)
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        proprio = d.get('site')
        if proprio and proprio != site:
            sys.exit(f"ABANDON : {f.name} appartient a « {proprio} », pas a "
                     f"« {site} ». Ecrire dedans effacerait les dates d'un autre site.")
        return d
    if site == 'vevewiki' and LEGACY.exists():
        print(f'reprise de {LEGACY.name} (ancien fichier commun) -> {f.name}')
        return json.loads(LEGACY.read_text(encoding='utf-8'))
    return {}


NOTE = ("Date du dernier changement REEL de chaque famille de pages, et de "
        "chaque fiche pour un site a prix. Produit par engine/tools/lastmod.py "
        "et engine/tools/lastmod-prix.mjs, lu par src/pages/sitemap.xml.js. "
        "Ne pas editer a la main : la date suivrait le fichier, pas le contenu.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', required=True)
    ap.add_argument('--jour', default=date.today().isoformat(),
                    help='pour les tests : force la date du jour')
    a = ap.parse_args()

    fichier = charger(a.site)
    etat = fichier.get('sections', {})

    neuf, change, absentes = dict(etat), [], []
    for cle, motifs in SURVEILLE.items():
        parts = [empreinte(RACINE / m.format(site=a.site)) for m in motifs]
        # ⭐ UNE FAMILLE DONT AUCUNE SOURCE N'EXISTE N'A PAS D'ETAT — elle n'a
        #   pas « change ». Sans cette porte, un site sans pages editoriales
        #   (veveprice) recevrait une entree `glossary` datee d'aujourd'hui,
        #   calculee sur le hachage de RIEN. Une date parfaitement formee,
        #   parfaitement fausse, et que rien ne distingue d'une vraie.
        if not any(parts):
            absentes.append(cle)
            neuf.pop(cle, None)
            continue
        h = hashlib.sha256('|'.join(parts).encode()).hexdigest()
        ancien = etat.get(cle) or {}
        if ancien.get('h') == h:
            neuf[cle] = ancien                      # inchange : on GARDE la date
        else:
            neuf[cle] = {'h': h, 'd': a.jour}
            change.append(cle)

    f = sortie(a.site)
    f.parent.mkdir(parents=True, exist_ok=True)
    # ⭐ On REECRIT le fichier entier mais on ne POSSEDE que `sections` : la
    #   carte `items` est tenue par lastmod-prix.mjs. Les deux outils ecrivent
    #   dans le meme fichier ; chacun preserve ce qui ne lui appartient pas.
    f.write_text(json.dumps({
        '_note': NOTE,
        'site': a.site,
        'passages': fichier.get('passages', 0),
        'sections': neuf,
        'items': fichier.get('items', {}),
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    if change:
        print(f"lastmod : {len(change)} section(s) modifiee(s) -> {', '.join(sorted(change))}")
    else:
        print("lastmod : aucun changement de contenu — toutes les dates sont conservees.")
    if absentes:
        print(f"lastmod : {len(absentes)} famille(s) sans source sur ce site, "
              f"non datee(s) -> {', '.join(sorted(absentes))}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
