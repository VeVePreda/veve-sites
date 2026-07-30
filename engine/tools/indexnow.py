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

    # ⭐⭐ L'ÉTAT N'ENREGISTRE QUE CE QUI A VRAIMENT ÉTÉ SOUMIS.
    #
    # LE DÉFAUT CORRIGÉ ICI (constaté en production le 30/07/2026). L'écriture
    # de l'état était UNIQUE, INCONDITIONNELLE, et placée AVANT l'envoi. Trois
    # conséquences, toutes silencieuses, toutes avec un run vert :
    #
    #  1. `IndexNow : échec (403)` — et l'état committé quand même, les 7 864 URL
    #     du premier vrai passage marquées « soumises » sans l'avoir été. Le
    #     lendemain `changees` est vide : elles ne repartent JAMAIS.
    #  2. `--essai` annonçait « rien n'a été envoyé » APRÈS avoir déjà avancé
    #     l'état : une simulation détruisait le différentiel qu'elle prétendait
    #     seulement observer.
    #  3. En cas de troncature au plafond, on soumettait les N premières et on
    #     enregistrait les 7 864 : la queue passait pour envoyée.
    #
    # ⭐ La règle : un checkpoint ne doit jamais avancer plus loin que ce qui a
    # réussi. Ici il suffisait de déplacer l'écriture APRÈS l'envoi et de ne lui
    # donner que les URL réellement acceptées.
    # ⭐ Effet de bord voulu : le 403 devient AUTO-RÉPARABLE. Le jour où il cesse,
    # l'arriéré repart tout seul — sans avoir eu besoin d'en comprendre la cause.
    def ecrire_etat(urls: dict[str, str]) -> None:
        etat_f.parent.mkdir(parents=True, exist_ok=True)
        etat_f.write_text(json.dumps({
            '_note': ("lastmod des URL SOUMISES AVEC SUCCÈS à IndexNow (pas "
                      "« vues » : une soumission échouée ne s'enregistre pas, "
                      "sinon l'URL ne repartirait jamais). Produit par "
                      "engine/tools/indexnow.py."),
            'urls': urls,
        }, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')

    # Périmètre = le sitemap tel qu'il est servi (les URL disparues sortent de
    # l'état), mais chaque URL garde sa valeur CONNUE tant qu'elle n'a pas été
    # soumise avec succès. Une URL neuve reste donc absente, donc « changée ».
    retenu = {u: ancien[u] for u in actuel if u in ancien}

    if premier:
        ecrire_etat(actuel)
        print(f'Premier passage : {len(actuel)} URL mémorisées, rien soumis '
              f'(tout paraîtrait neuf). La prochaine fois dira vrai.')
        return 0
    if not changees:
        ecrire_etat(retenu)
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
        # ⛔ AUCUNE écriture : un essai qui consomme le différentiel n'est pas un
        #    essai. C'était le cas avant le 30/07/2026.
        print('(--essai : rien n’a été envoyé, l’état n’a pas bougé)')
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
        # ⛔ MAIS ON N'AVANCE PAS L'ÉTAT : sinon « on réessaiera demain » est une
        #    promesse que le fichier qu'on vient d'écrire rend impossible.
        code = getattr(e, 'code', None)
        print(f'IndexNow : échec ({code or e}). '
              f'{"429 = quota, on réessaiera demain." if code == 429 else ""}')
        print(f'⛔ état NON avancé — les {len(changees)} URL repartiront au '
              f'prochain passage. C’est voulu : rien ne les rattraperait sinon.')
        return 0

    # Succès (urlopen ne lève pas pour un 2xx) : SEULES les URL envoyées entrent
    # dans l'état. Celles écartées par le plafond restent « changées ».
    for u in changees:
        retenu[u] = actuel[u]
    ecrire_etat(retenu)
    print(f'état : {len(changees)} URL enregistrée(s) comme soumise(s) '
          f'({len(actuel) - len(retenu)} encore en attente).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
