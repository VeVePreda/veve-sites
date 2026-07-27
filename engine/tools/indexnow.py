#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prévient IndexNow des URL RÉELLEMENT modifiées, et d'elles seules.

    python3 engine/tools/indexnow.py --site vevewiki --cle <clé> [--essai]

À lancer APRÈS le déploiement : ce script lit le sitemap tel qu'il est SERVI,
compare chaque `lastmod` à ce qu'il valait au passage précédent, et ne soumet
que ce qui a bougé.

================================================================================
CE QUI ÉTAIT FAIT AVANT, ET POURQUOI ÇA NE MARCHAIT PAS
================================================================================
Le workflow soumettait `https://<site>/sitemap.xml` comme URL, tous les jours.
Deux erreurs superposées :

  1. IndexNow attend des **URL DE PAGES** ajoutées, modifiées ou supprimées.
     Soumettre l'adresse du sitemap ne demande d'explorer aucune page. La
     documentation officielle recommande d'utiliser sitemap ET IndexNow côte à
     côte — l'un n'est pas un véhicule pour l'autre.

  2. Le commentaire disait : « soumettre 32 URL une par une serait vu comme du
     spam ». L'intuition était juste, la conclusion fausse : le protocole
     accepte **jusqu'à 10 000 URL dans UNE SEULE requête POST**. C'est l'usage
     prévu, pas un contournement. Ce qui EST une faute, en revanche, c'est de
     resoumettre des URL inchangées — la documentation le range parmi les
     erreurs courantes, avec un risque de HTTP 429.

⭐ Ce script ne pouvait pas exister avant : tant que le sitemap datait ses 82 URL
   du jour du build, « ce qui a changé » valait « tout », tous les jours. Il
   fallait d'abord rendre les `lastmod` honnêtes (`engine/tools/lastmod.py`).
   Les deux correctifs n'en font qu'un.

⚠️ Le premier passage n'envoie RIEN : sans état antérieur, tout paraîtrait neuf
   et on soumettrait le site entier. On mémorise, et on parlera demain.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent.parent
POINT = 'https://api.indexnow.org/indexnow'
PLAFOND = 10_000            # limite du protocole, une requête


def sitemap_servi(domaine: str) -> dict[str, str]:
    """{url: lastmod} lu sur le sitemap RÉELLEMENT en ligne.

    ⭐ On lit le site déployé, pas le dist local : c'est la seule façon de
    n'annoncer que ce qu'un moteur peut effectivement aller chercher.
    """
    url = f'https://{domaine}/sitemap.xml?cb=indexnow'
    req = urllib.request.Request(url, headers={'User-Agent': 'veve-sites/indexnow'})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml = r.read().decode('utf-8', 'replace')
    couples = re.findall(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>', xml)
    if not couples:
        sys.exit('ABANDON : aucun couple <loc>/<lastmod> — le sitemap a-t-il changé de forme ?')
    return dict(couples)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', required=True)
    ap.add_argument('--domaine')
    ap.add_argument('--cle', required=True)
    ap.add_argument('--essai', action='store_true', help='calcule et affiche, sans rien envoyer')
    a = ap.parse_args()

    domaine = a.domaine or f'{a.site}.com'
    etat_f = RACINE / 'engine' / 'data' / f'indexnow_{a.site}.json'
    ancien = {}
    premier = not etat_f.exists()
    if not premier:
        ancien = json.loads(etat_f.read_text(encoding='utf-8')).get('urls', {})

    actuel = sitemap_servi(domaine)
    changees = sorted(u for u, d in actuel.items() if ancien.get(u) != d)

    etat_f.parent.mkdir(parents=True, exist_ok=True)
    etat_f.write_text(json.dumps({
        '_note': ("Dernier lastmod vu sur le sitemap servi. Sert à ne soumettre "
                  "à IndexNow que ce qui a bougé. Produit par engine/tools/indexnow.py."),
        'urls': actuel,
    }, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')

    if premier:
        print(f'Premier passage : {len(actuel)} URL mémorisées, rien soumis '
              f'(tout paraîtrait neuf). La prochaine fois dira vrai.')
        return 0
    if not changees:
        print('Aucune URL modifiée — rien à soumettre. '
              'Resoumettre de l’inchangé gaspille le quota d’exploration.')
        return 0
    if len(changees) > PLAFOND:
        print(f'{len(changees)} URL : au-delà du plafond de {PLAFOND}, on tronque.')
        changees = changees[:PLAFOND]

    print(f'{len(changees)} URL modifiée(s) :')
    for u in changees[:20]:
        print(f'   {u}')
    if len(changees) > 20:
        print(f'   … et {len(changees) - 20} autres')
    if a.essai:
        print('(--essai : rien n’a été envoyé)')
        return 0

    charge = json.dumps({
        'host': domaine,
        'key': a.cle,
        'keyLocation': f'https://{domaine}/{a.cle}.txt',
        'urlList': changees,
    }).encode('utf-8')
    req = urllib.request.Request(POINT, data=charge, method='POST',
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f'IndexNow : HTTP {r.status}')
    except Exception as e:                        # noqa: BLE001
        # ⚠️ Un moteur indisponible ne doit JAMAIS faire échouer un déploiement
        #    par ailleurs réussi. On le dit, et on sort proprement.
        code = getattr(e, 'code', None)
        print(f'IndexNow : échec ({code or e}). '
              f'{"429 = quota, on réessaiera demain." if code == 429 else ""}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
