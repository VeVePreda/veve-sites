#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cartes de partage PAR ARTICLE — `public/og/<langue>/<slug>.png`, 1200x630.

⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/tools/
   (chemin exact : engine/tools/make_article_cards.py)

    SITE=vevewiki python3 engine/tools/make_article_cards.py

================================================================================
LE DÉFAUT CORRIGÉ
================================================================================
Les 83 pages du site partageaient la MÊME vignette générique (`/og.png`).
Un article publié sur X, Discord ou LinkedIn s'affichait donc exactement comme
la page d'accueil : même image, même impression de « lien quelconque ». La
vignette est pourtant la seule chose qu'un lecteur voit avant de décider s'il
clique.

⭐ La carte reprend le TITRE de l'article, sa catégorie et la marque. Elle sert
   d'`og:image`, PAS d'illustration en tête d'article : à l'intérieur, elle ne
   ferait que répéter le <h1> juste au-dessus. Une image qui redit le texte
   qu'elle surmonte n'est pas une illustration, c'est du remplissage.

================================================================================
POURQUOI C'EST ICI, ET PAS DANS LE BUILD ASTRO
================================================================================
La construction du site tourne dans une image Docker `node:22-alpine` : ni
Python, ni PIL. Les cartes sont donc produites par le WORKFLOW, qui a déjà
Python (il fait la récolte éditoriale), et COMMITTÉES avec les snapshots.
Le build les trouve toutes faites.

⭐ D'où une exigence : ce script doit être IDEMPOTENT. S'il réécrivait les PNG à
   chaque passage, le workflow committerait 26 fichiers binaires par jour pour
   rien, et l'historique du dépôt deviendrait illisible en un mois. Un fichier
   n'est réécrit QUE si ses octets changent.

Deux sources d'articles, comme partout dans ce moteur :
  · l'onglet Blog du Sheet -> sites/<site>/editorial/blog.json
  · les .md du dépôt       -> sites/<site>/blog/<langue>/<slug>.md
À (langue, slug) identique, le .md gagne — même arbitrage que engine/lib/blog.mjs.
"""
from __future__ import annotations

import os
import pathlib
import re
import sys

try:
    import yaml
    from PIL import Image, ImageDraw, ImageFont
except ImportError as e:                      # pragma: no cover
    sys.exit(f"dépendance manquante ({e}) — pip install pyyaml pillow")

SITE = os.environ.get('SITE', 'veveprice')
ROOT = pathlib.Path(__file__).resolve().parents[2]
# ⚠️ NAMESPACÉ PAR SITE, et ce n'est pas de la coquetterie : `public/` est
# PARTAGÉ par les 15 sites du dépôt. Sans le nom du site dans le chemin, deux
# articles homonymes sur deux sites écraseraient mutuellement leur carte, et
# chaque site embarquerait les cartes de tous les autres. Aujourd'hui aucun slug
# n'entre en collision (vérifié : 13 contre 1) — c'est exactement le moment de
# poser la règle, avant que ça n'arrive.
SORTIE = ROOT / 'public' / 'og' / SITE

GRAS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
NORMAL = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
L, H = 1200, 630


def hexa(c, defaut):
    return tuple(int((c or defaut).lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))


def lignes(dessin, texte, police, largeur, maxi):
    """Découpe `texte` en au plus `maxi` lignes tenant dans `largeur`."""
    mots, ligne, out = str(texte).split(), '', []
    for mot in mots:
        essai = (ligne + ' ' + mot).strip()
        if dessin.textlength(essai, font=police) > largeur and ligne:
            out.append(ligne)
            ligne = mot
            if len(out) == maxi:
                break
        else:
            ligne = essai
    if len(out) < maxi and ligne:
        out.append(ligne)
    # Le titre coupé se termine par une ellipse : mieux vaut l'assumer que
    # laisser croire que c'est le titre entier.
    if len(out) == maxi and dessin.textlength(' '.join(mots), font=police) > largeur * maxi:
        out[-1] = out[-1].rstrip(' ,;:.') + '…'
    return out


def frontmatter(chemin: pathlib.Path) -> dict:
    txt = chemin.read_text(encoding='utf-8')
    m = re.match(r'^---\n(.*?)\n---\n', txt, re.S)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def articles(manifeste) -> dict[tuple[str, str], dict]:
    """`{(langue, slug): {titre, categorie}}`. Le .md du dépôt gagne sur le Sheet."""
    langues = (manifeste.get('languages') or {}).get('active') or ['en']
    out: dict[tuple[str, str], dict] = {}

    # 1) le Sheet
    import json
    p = ROOT / 'sites' / SITE / 'editorial' / 'blog.json'
    if p.exists():
        d = json.loads(p.read_text(encoding='utf-8'))
        for r in (d.get('records') if isinstance(d, dict) else d) or []:
            slug = str(r.get('slug', '')).strip()
            if not slug:
                continue
            for lg in langues:
                titre = str(r.get(f'titre_{lg}') or r.get('titre') or '').strip()
                # ⚠️ MÊME RÈGLE QUE engine/lib/blog.mjs : c'est le CORPS qui fait
                # l'article, pas le titre. Sans cette condition, une colonne
                # `titre_es` remplie avant sa traduction ferait fabriquer — et
                # committer chaque jour — une carte de partage pour une page qui
                # n'est pas construite. Un binaire orphelin par langue et par
                # article, que rien ne signalerait.
                corps = str(r.get(f'body_{lg}') or r.get('body') or '').strip()
                if titre and corps:
                    out[(lg, slug)] = {'titre': titre,
                                       'categorie': str(r.get('categorie') or r.get('etiquette') or '').strip()}

    # 2) les .md — ils l'emportent
    for lg in langues:
        dossier = ROOT / 'sites' / SITE / 'blog' / lg
        if not dossier.is_dir():
            continue
        for f in sorted(dossier.glob('*.md')):
            fm = frontmatter(f)
            titre = str(fm.get('title') or '').strip()
            if not titre:
                continue
            tags = fm.get('tags') or []
            out[(lg, f.stem)] = {'titre': titre,
                                 'categorie': str(tags[0]).strip() if tags else ''}
    return out


def carte(titre, categorie, pal, marque, domaine) -> bytes:
    import io
    BG = hexa(pal.get('surface'), '#16181d')
    PRI = hexa(pal.get('primary'), '#d4af37')
    TXT = hexa(pal.get('text'), '#e7e9ee')
    MUT = hexa(pal.get('muted'), '#9aa0ab')
    ACC = hexa(pal.get('accent'), '#c0c5ce')

    im = Image.new('RGB', (L, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, L, 9], fill=PRI)                        # bandeau de marque

    # En-tête : pastille + marque + catégorie
    d.rounded_rectangle([70, 70, 138, 138], radius=17, fill=PRI)
    ini = ''.join(w[0] for w in str(marque).split())[:2].upper()
    fi = ImageFont.truetype(GRAS, 32)
    b = d.textbbox((0, 0), ini, font=fi)
    d.text((104 - (b[2] - b[0]) / 2, 104 - (b[3] - b[1]) / 2 - 4), ini, font=fi, fill=(255, 255, 255))
    d.text((158, 92), str(marque).upper(), font=ImageFont.truetype(NORMAL, 24), fill=ACC)
    if categorie:
        fc = ImageFont.truetype(NORMAL, 20)
        lc = d.textlength(categorie.upper(), font=fc)
        d.rounded_rectangle([L - 70 - lc - 34, 88, L - 70, 130], radius=21, outline=MUT, width=1)
        d.text((L - 70 - lc - 17, 99), categorie.upper(), font=fc, fill=MUT)

    # Le titre : la seule chose qui compte vraiment.
    # La taille s'adapte au titre : un titre court en grand, un titre long
    # reste lisible plutôt que d'être coupé.
    for taille in (60, 54, 48, 42):
        ft = ImageFont.truetype(GRAS, taille)
        ls = lignes(d, titre, ft, L - 140, 4)
        if len(ls) <= 3:
            break
    interligne = int(taille * 1.26)
    # Bloc de titre CENTRÉ dans la bande libre (sous l'en-tête, au-dessus du
    # filet de pied) : sans ça, un titre de deux lignes laissait un grand vide.
    haut, bas = 178, H - 116
    y = haut + max(0, (bas - haut - len(ls) * interligne) // 2)
    for ligne in ls:
        d.text((70, y), ligne, font=ft, fill=TXT)
        y += interligne

    d.line([70, H - 96, L - 70, H - 96], fill=MUT, width=1)
    d.text((70, H - 74), str(domaine), font=ImageFont.truetype(NORMAL, 26), fill=MUT)

    tampon = io.BytesIO()
    im.save(tampon, format='PNG', optimize=True)
    return tampon.getvalue()


def main() -> int:
    mf = ROOT / 'sites' / SITE / 'manifest.yml'
    if not mf.exists():
        sys.exit(f"manifeste introuvable : {mf}")
    m = yaml.safe_load(mf.read_text(encoding='utf-8'))
    pal = (m.get('identity') or {}).get('palette') or {}
    marque = (m.get('site') or {}).get('brand', SITE)
    domaine = (m.get('site') or {}).get('domain', '')

    arts = articles(m)
    if not arts:
        print(f"{SITE} : aucun article — aucune carte à produire.")
        return 0

    ecrits = inchanges = 0
    for (lg, slug), a in sorted(arts.items()):
        dossier = SORTIE / lg
        dossier.mkdir(parents=True, exist_ok=True)
        cible = dossier / f'{slug}.png'
        octets = carte(a['titre'], a['categorie'], pal, marque, domaine)
        # ⭐ Idempotence : sans cette comparaison, le workflow committerait
        #    chaque jour des PNG identiques et noierait l'historique du dépôt.
        if cible.exists() and cible.read_bytes() == octets:
            inchanges += 1
            continue
        cible.write_bytes(octets)
        ecrits += 1

    print(f"{SITE} : {len(arts)} cartes · {ecrits} écrite(s), {inchanges} inchangée(s) -> public/og/")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
