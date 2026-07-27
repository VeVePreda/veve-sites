#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tient à jour `engine/data/lastmod.json` — la date de dernier CHANGEMENT
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
SORTIE = RACINE / 'engine' / 'data' / 'lastmod.json'

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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', required=True)
    ap.add_argument('--jour', default=date.today().isoformat(),
                    help='pour les tests : force la date du jour')
    a = ap.parse_args()

    etat = {}
    if SORTIE.exists():
        etat = json.loads(SORTIE.read_text(encoding='utf-8')).get('sections', {})

    neuf, change = {}, []
    for cle, motifs in SURVEILLE.items():
        h = hashlib.sha256('|'.join(
            empreinte(RACINE / m.format(site=a.site)) for m in motifs
        ).encode()).hexdigest()
        ancien = etat.get(cle) or {}
        if ancien.get('h') == h:
            neuf[cle] = ancien                      # inchangé : on GARDE la date
        else:
            neuf[cle] = {'h': h, 'd': a.jour}
            change.append(cle)

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps({
        '_note': ("Date du dernier changement RÉEL de chaque famille de pages. "
                  "Produit par engine/tools/lastmod.py, lu par src/pages/sitemap.xml.js. "
                  "Ne pas éditer à la main : la date suivrait le fichier, pas le contenu."),
        'sections': neuf,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    if change:
        print(f"lastmod : {len(change)} section(s) modifiée(s) -> {', '.join(sorted(change))}")
    else:
        print("lastmod : aucun changement de contenu — toutes les dates sont conservées.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
