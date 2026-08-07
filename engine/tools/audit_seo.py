#!/usr/bin/env python3
# ⚠️ CE FICHIER VA DANS LE DEPOT VeVePreda/veve-sites, dans engine/tools/
"""Audit SEO du site construit.

RACINE A PASSER EN ARGUMENT : `dist` en mode static, `dist/client` en mode
serveur (cf. `rendering:` dans sites/<SITE>/manifest.yml). Se tromper de
racine ne provoquait aucune erreur jusqu'au 29/07/2026 : voir le controle
de l'accueil plus bas.

    python3 engine/tools/audit_seo.py [dist]

Sort en code 1 si un defaut BLOQUANT est trouve, pour pouvoir etre branche
sur la CI. Concu pour servir a TOUS les sites du reseau, pas au seul pilote.
"""
import html as _html
import json
import pathlib
import re
import sys
from collections import Counter, defaultdict

D = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist')
if not D.is_dir():
    sys.exit(f"dossier introuvable : {D}")

# ── chargement ──────────────────────────────────────────────────────────────
H = {}
for f in D.rglob('*.html'):
    rel = '/' + str(f.relative_to(D)).replace('\\', '/')
    url = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    H[url] = f.read_text(encoding='utf-8', errors='ignore')

# Un controle qui passe sur zero page est un FAUX NEGATIF, pas une reussite.
if len(H) < 20:
    sys.exit(f"AUDIT INVALIDE : {len(H)} pages seulement — la construction a echoue ?")

# ⭐⭐ VERIFIER L'INSTRUMENT (29/07/2026) — LE CONTROLE QUI MANQUAIT.
# Vecu en production : le Dockerfile lancait cet audit sur `dist` alors que le
# mode serveur pose les pages dans `dist/client`. Toutes les cles prenaient un
# prefixe `/client/`, et l'audit n'a pas bronche : il a lu 7 805 pages, donc il
# s'est cru valide. Il a ensuite imprime `profondeur max : 0 clics` — plausible,
# faux — et qualifie de « casses » 7 933 liens parfaitement valides.
# ➡️ Trois choses ne peuvent PAS etre vraies sur un site construit : pas de page
#    d'accueil, aucun lien interne qui joigne sa cible, aucune URL sous `/xx/`
#    alors que le site est multilingue. Chacune signe une racine mal choisie,
#    AUCUNE ne demande de seuil. On refuse de produire des chiffres plutot que
#    d'en produire des faux — un audit muet se remarque, un audit qui ment, non.
if '/' not in H:
    sys.exit("AUDIT INVALIDE : aucune page d'accueil '/' dans "
             f"{D} — mauvaise racine ? En mode serveur, les pages sont dans "
             f"dist/client, pas dist. Cles lues : {sorted(H)[:3]}")

g = lambda h, pat: (re.search(pat, h, re.S).group(1).strip() if re.search(pat, h, re.S) else '')

# ⭐ VERIFIER L'INSTRUMENT (27/07/2026) : le HTML est ENCODE. Mesurer la longueur
# de la source, c'est compter « Black &amp; White » pour 17 caracteres quand le
# lecteur — et Google — en voient 13. L'audit signalait ainsi des titres trop
# longs qui ne l'etaient pas, et manquait ceux qui l'etaient vraiment.
# On DECODE avant toute mesure ou comparaison de texte.
txt = lambda s: _html.unescape(s)
titles = {u: txt(g(h, r'<title>(.*?)</title>')) for u, h in H.items()}
descs = {u: txt(g(h, r'<meta name="description" content="(.*?)"')) for u, h in H.items()}
erreurs, avertissements = [], []

# ── cibles existantes (pages + fichiers) ────────────────────────────────────
targets = set(H)

# ⭐⭐ LES ROUTES RENDUES A LA DEMANDE EXISTENT, MEME SANS FICHIER (03/08/2026).
# Depuis le lot 24, `engine/lib/astro_routes_compte.mjs` bascule quatre routes
# en rendu a la demande quand le site est en mode `server` : elles sont servies
# par Node, pas par nginx, donc elles ne laissent AUCUN fichier dans
# `dist/client`. L'audit, qui juge en lisant le disque, les comptait comme des
# liens morts : au 03/08 il annoncait
#     [DEFAUT] 2 liens <a> casses : {'/compte/': 922, '/connexion/': 368}
# soit 1 290 faux positifs sur des pages qui repondent parfaitement.
#
# ⭐ ENCORE « VERIFIER L'INSTRUMENT ». C'est la deuxieme fois que cet audit se
# trompe pour la meme raison : il avait deja lu `dist` au lieu de `dist/client`
# et invente 7 933 liens casses. Un instrument qui ne suit pas un changement de
# MODE ne se tait pas, il MENT — et un chiffre plausible ne se relit jamais.
# ⛔⛔ ET C'EST CRITIQUE MAINTENANT QU'IL A UN LECTEUR (workflow nocturne) : un
# rapport qui crie 1 290 fois a tort cesse d'etre lu des la premiere nuit,
# exactement comme les 172 griefs de `css-mort` sur encyclopedie.
#
# ⚠️ ON NE LES INVENTE PAS : la liste est LUE dans le moteur, pas recopiee ici.
# Deux listes pour la meme verite finissent toujours par diverger.
def _langues_publiees():
    """Les prefixes de langue REELLEMENT produits par ce build.

    ⭐ Un dossier de premier niveau de deux ou trois lettres qui contient un
    `index.html` est une langue. ⛔ On ne devine pas une liste de codes ISO :
    on regarde ce qui a ete publie, comme tout le reste de cet audit.
    ⚠️ Si la liste sort vide, on ne remplace RIEN et l'audit redira ses faux
    positifs — bruyamment, donc visiblement. Un repli silencieux vers une liste
    en dur serait la panne suivante, deguisee en correction.
    """
    out = []
    for d in D.iterdir():
        if d.is_dir() and 2 <= len(d.name) <= 3 and d.name.isalpha() and (d / 'index.html').exists():
            out.append(d.name)
    return out


_routes = pathlib.Path(__file__).resolve().parent.parent / 'lib' / 'astro_routes_compte.mjs'
_a_la_demande = set()
_mode_server = (D.parent / 'server' / 'entry.mjs').exists()
if _mode_server and _routes.exists():
    for m in re.finditer(r"'pages/([^']+)'", _routes.read_text(encoding='utf-8')):
        chemin = m.group(1)
        # 🔴 LOT 104 — `[locale]` N'EST PAS `[uuid]`, ET LES CONFONDRE COUTE
        # 1 320 FAUX POSITIFS. La version precedente sautait tout chemin
        # contenant un crochet, avec ce motif : « route dynamique : pas
        # d'adresse fixe a declarer ». C'etait vrai de `[uuid]` — on ne peut
        # pas enumerer 19 242 pieces — et FAUX de `[locale]`, dont les valeurs
        # sont EXACTEMENT les langues du site, ecrites dans le manifeste.
        # ⭐⭐⭐ TROISIEME FOIS QUE CET AUDIT SE TROMPE POUR LA MEME RAISON :
        # `dist` au lieu de `dist/client` (7 933 liens inventes), puis le mode
        # server ignore (1 290), maintenant le prefixe de langue. Et le
        # commentaire du dessus l'annonce : « un rapport qui crie a tort cesse
        # d'etre lu des la premiere nuit ». Il a un lecteur — le workflow
        # nocturne — donc chaque faux positif coute la lecture des vrais.
        # ⚠️ LES LANGUES SE LISENT DANS LE DISQUE PUBLIE, PAS DANS LE
        # MANIFESTE : ce script est deja lance sans `SITE` dans le workflow, et
        # importer le manifeste ici le rendrait dependant d'une variable
        # d'environnement qu'il n'a jamais eue. Les dossiers de langue de
        # `dist/client` sont ce que le build a REELLEMENT produit — c'est la
        # meme source que le reste de l'audit.
        if '[uuid]' in chemin or '[module]' in chemin:
            continue
        base = '/' + chemin.replace('/index.astro', '/').replace('.js', '')
        if '[locale]' in base:
            for lg in _langues_publiees():
                _a_la_demande.add(base.replace('[locale]', lg))
            continue
        _a_la_demande.add(base)
    if _a_la_demande:
        targets |= _a_la_demande
        print(f"  (mode server : {len(_a_la_demande)} route(s) rendue(s) a la demande, "
              f"sans fichier mais bien servies : {' '.join(sorted(_a_la_demande))})")
for f in D.rglob('*'):
    if f.is_file():
        targets.add('/' + str(f.relative_to(D)).replace('\\', '/'))

# Les liens internes peuvent etre relatifs (/fr/) OU absolus
# (https://veveprice.com/fr/) : le selecteur de langue utilise la forme absolue.
# ⭐⭐ VERIFIER L'INSTRUMENT (29/07/2026) : l'hote etait pris sur le PREMIER
# canonical rencontre. Un seul canonical fautif — vers un autre domaine, ou
# vers un domaine de recette — et TOUS les liens absolus du site passaient pour
# externes, donc n'etaient plus verifies du tout. L'outil dependait de la
# donnee qu'il mesure. On prend desormais l'hote MAJORITAIRE : une anomalie
# isolee ne peut plus desarmer le controle, elle se fait au contraire attraper
# par le controle du canonical, plus bas.
hotes = Counter(m.group(1) for h in H.values()
                for m in [re.search(r'<link rel="canonical" href="(https?://[^/]+)', h)] if m)
HOTE = hotes.most_common(1)[0][0] if hotes else ''
if len(hotes) > 1:
    erreurs.append(f"canonicals vers {len(hotes)} hotes differents : {dict(hotes)}")

def _internes(paires):
    out = []
    for href in paires:
        if HOTE and href.startswith(HOTE):
            href = href[len(HOTE):] or '/'
        if href.startswith('/'):
            out.append(href)
    return out


def liens_internes(h):
    """TOUS les href internes — pour le maillage et la profondeur de clic."""
    return _internes(re.findall(r'href="([^"#?]+)"', h))


# ⭐⭐ SEPARER LES <a> DES <link> (29/07/2026) — ET C'EST CE MELANGE QUI A COUTE
# UNE JOURNEE. `href="..."` attrape aussi bien un lien de navigation qu'un
# <link rel="canonical"> ou un <link rel="alternate">. Le 29/07 l'audit a donc
# annonce « 1 252 liens internes casses » pour un defaut de CANONICAL, et on a
# cherche des <a> fautifs dans les gabarits pendant des heures.
# ⭐ Ce ne sont pas les memes degats, donc ce ne sont pas les memes lignes :
#   · un <a> casse est un cul-de-sac pour le LECTEUR ;
#   · un <link> casse fait abandonner la page par le MOTEUR.
def liens_ancres(h):
    """Uniquement les <a href> — ce qu'un lecteur peut reellement suivre."""
    return _internes(re.findall(r'<a[^>]+href="([^"#?]+)"', h))

# ── 1. liens internes ───────────────────────────────────────────────────────
casses, casses_meta = Counter(), Counter()
for u, h in H.items():
    ancres = set(liens_ancres(h))
    for href in liens_internes(h):
        cible = href if href.endswith('/') else href + '/'
        if cible not in targets and href not in targets:
            (casses if href in ancres else casses_meta)[href] += 1
if casses:
    erreurs.append(f"{len(casses)} liens <a> casses (cul-de-sac pour le lecteur) : "
                   f"{dict(list(casses.items())[:5])}")
if casses_meta:
    erreurs.append(f"{len(casses_meta)} href de <link> vers une page absente "
                   f"(canonical / hreflang — la page se saborde) : "
                   f"{dict(list(casses_meta.items())[:5])}")

# ── 2. balises indispensables ───────────────────────────────────────────────
manque = Counter()
for u, h in H.items():
    if not titles[u]:
        manque['title'] += 1
    if not descs[u]:
        manque['description'] += 1
    if 'rel="canonical"' not in h:
        manque['canonical'] += 1
    if len(re.findall(r'<h1[ >]', h)) != 1:
        manque['h1 unique'] += 1
    if not re.search(r'<html[^>]+lang=', h):
        manque['html lang'] += 1
    if 'name="viewport"' not in h:
        manque['viewport'] += 1
if manque:
    erreurs.append(f"balises manquantes : {dict(manque)}")

# ── 3. unicite titres / descriptions ────────────────────────────────────────
def langue(u):
    m = re.match(r'^/([a-z]{2})/', u)
    return m.group(1) if m else 'def'

par_langue = defaultdict(list)
for u in H:
    par_langue[langue(u)].append(u)
dup_t, dup_d = [], []
for lg, urls in par_langue.items():
    for v, n in Counter(titles[u] for u in urls).most_common():
        if n > 1:
            dup_t.append((f'[{lg}] {v}', n))
    for v, n in Counter(descs[u] for u in urls if descs[u]).most_common():
        if n > 1:
            dup_d.append((f'[{lg}] {v}', n))
if dup_t:
    erreurs.append(f"{sum(n for _, n in dup_t)} pages partagent {len(dup_t)} titres : "
                   + '; '.join(f'"{v[:45]}" x{n}' for v, n in dup_t[:3]))
if dup_d:
    erreurs.append(f"{sum(n for _, n in dup_d)} pages partagent {len(dup_d)} descriptions : "
                   + '; '.join(f'"{v[:45]}" x{n}' for v, n in dup_d[:3]))

# ── 4. longueurs ────────────────────────────────────────────────────────────
# Fenetres utiles : titre <= 60, description 70..160 (cf. DESC_MIN/DESC_MAX dans
# engine/lib/editorial_pages.mjs). Longueurs mesurees sur le texte DECODE.
longs = [u for u, v in titles.items() if len(v) > 60]
courts = [u for u, v in descs.items() if v and len(v) < 70]
bavards = [u for u, v in descs.items() if v and len(v) > 160]
if longs:
    avertissements.append(f"{len(longs)} titres > 60 caracteres (tronques par Google) — "
                          + ', '.join(f'{u} ({len(titles[u])})' for u in longs[:3]))
if courts:
    avertissements.append(f"{len(courts)} descriptions < 70 caracteres (trop maigres) — "
                          + ', '.join(f'{u} ({len(descs[u])})' for u in courts[:3]))
if bavards:
    avertissements.append(f"{len(bavards)} descriptions > 160 caracteres (coupees) — "
                          + ', '.join(f'{u} ({len(descs[u])})' for u in bavards[:3]))

# ── 4bis. l'accueil parle-t-il DE CE SITE ? ─────────────────────────────────
# ⭐ Defaut paye le 27/07/2026 : le gabarit, faute de titre d'accueil propre,
# retombait sur le libelle RESEAU (ecrit pour un site de prix). vevewiki.com
# titrait « VeVe Wiki — VeVe price history & floor tracker » sur ses deux
# accueils. Rien n'echouait, rien n'etait vide : la page disait juste autre
# chose. On verifie donc qu'un site SANS page de prix ne vend pas du prix.
mots_prix = ('price', 'floor', 'prix', 'plancher', 'precio', 'preis')
accueils = [u for u in H if u == '/' or re.fullmatch(r'/[a-z]{2}/', u)]
a_des_prix = any(re.match(r'^(/[a-z]{2})?/(collectibles|comics|collection|movers)/', u) for u in H)
if not a_des_prix:
    ment = [u for u in accueils if any(w in titles[u].lower() for w in mots_prix)]
    if ment:
        erreurs.append("accueil qui annonce du PRIX sur un site sans page de prix : "
                       + '; '.join(f'{u} -> "{titles[u]}"' for u in ment))

# ── 4ter. donnees structurees tenables ──────────────────────────────────────
# Un SearchAction est une PROMESSE : il declare a Google une boite de recherche
# interne. Si aucune page ne rend de champ de recherche, la promesse est fausse.
a_une_recherche = any(re.search(r'<input[^>]+type="search"', h) for h in H.values())
declare_recherche = [u for u, h in H.items() if 'SearchAction' in h]
if declare_recherche and not a_une_recherche:
    erreurs.append(f"{len(declare_recherche)} pages declarent un SearchAction alors "
                   "qu'AUCUNE page ne rend de champ de recherche")

# ── 4quater. les figures restent attribuables ───────────────────────────────
# Une figure de donnees part se faire partager SANS sa page : son cartouche
# (marque, domaine, source, date de COLLECTE) est trace DANS le SVG pour qu'elle
# reste attribuable une fois seule. Si un jour un gabarit sort une figure sans
# cartouche, ca ne casse rien — l'image circule juste anonymement avec nos
# chiffres. On le verifie donc, plutot que d'y croire.
# 🔴 FAUX POSITIF CORRIGE LE 29/07/2026 — ON CHERCHAIT UN MOT *ANGLAIS*.
# Le test etait `'collect' not in figure`. Or le cartouche est TRADUIT
# (engine/lib/figures.mjs, MOT.collecte) : « data collected on » et « donnees
# collectees le » contiennent bien « collect », mais « datos recogidos el »,
# « Daten erhoben am » et « dati raccolti il » ne le contiennent pas. Toute
# figure espagnole, allemande ou italienne etait donc declaree fautive alors
# qu'elle etait parfaitement conforme — 9 fausses alertes sur vevewiki.
# ⭐ Et le defaut ne pouvait meme pas exister : figures.mjs l.76-77 REFUSE un
# descripteur sans `collecte`. L'audit contredisait un garde-fou en amont.
# ➡️ On cherche desormais la DATE elle-meme, qui ne se traduit pas. Elle est
# presente deux fois : dans le texte du cartouche et dans `data-fig-nom`
# (figures.mjs l.196-197, suffixe `-AAAA-MM-JJ`).
figs = re.findall(r'<figure class="fig".*?</figure>', ' '.join(H.values()), re.S)
sans_cartouche = [f for f in figs if not re.search(r'\d{4}-\d{2}-\d{2}', _html.unescape(f))]
if figs and sans_cartouche:
    erreurs.append(f"{len(sans_cartouche)} figure(s) sur {len(figs)} sans date de collecte "
                   "dans le SVG — une image partagee doit rester datable")

# Le bouton de telechargement d'une figure ne doit pas dependre d'une recherche
# de DOM faite au moment ou le script s'execute : servi dans le <head>, il ne
# trouverait rien. On verifie que la reveleation passe par la classe `.js`.
pages_fig = [u for u, h in H.items() if 'fig-dl' in h]
if pages_fig:
    sans_regle = [u for u in pages_fig if '.js .fig .fig-dl' not in H[u]]
    if sans_regle:
        erreurs.append(f"{len(sans_regle)} pages ont un bouton de figure sans la regle "
                       "`.js .fig .fig-dl` : il resterait invisible")
    avec_hidden = [u for u in pages_fig if re.search(r'<button[^>]*class="fig-dl"[^>]*hidden', H[u])]
    if avec_hidden:
        erreurs.append(f"{len(avec_hidden)} pages masquent le bouton par `hidden` — "
                       "il faudrait du JS pour le retirer, et ce JS tourne avant le <body>")

# ── 5. noindex vs sitemap ───────────────────────────────────────────────────
sm_txt = (D / 'sitemap.xml').read_text(encoding='utf-8') if (D / 'sitemap.xml').exists() else ''
sm = set(re.sub(r'^https?://[^/]+', '', u) for u in re.findall(r'<loc>([^<]+)</loc>', sm_txt))
noidx = {u for u, h in H.items() if re.search(r'name="robots"[^>]*noindex', h)}
if noidx & sm:
    erreurs.append(f"pages a la fois en noindex ET dans le sitemap : {sorted(noidx & sm)}")
if sm and (sm - set(H)):
    erreurs.append(f"{len(sm - set(H))} URL du sitemap sans page : {sorted(sm - set(H))[:3]}")
orphelines = set(H) - sm - noidx
if sm and orphelines:
    avertissements.append(f"{len(orphelines)} pages absentes du sitemap : {sorted(orphelines)[:3]}")

# ── 5bis. LE CANONICAL POINTE-T-IL SUR LUI-MEME ? ───────────────────────────
# ⭐⭐ LE CONTROLE QUI MANQUAIT, ET QUI AURAIT TOUT ATTRAPE EN UNE LIGNE.
# Jusqu'ici on verifiait seulement que `rel="canonical"` etait PRESENT (§2),
# jamais ou il pointait. Le defaut du 29/07/2026 se decrit pourtant exactement
# comme ca : « 1 128 fiches construites a une adresse et declarees a une autre »
# (cf. l'en-tete de src/pages/[locale]/comics/[serie]/[numero]/[rarete].astro).
# Il a fallu le deduire de TROIS symptomes indirects — URL de sitemap sans page,
# hreflang sans retour, pages inatteignables. Le voici mesure directement.
# ⭐ Aucun seuil : `Base.astro` l.53 construit `canon = root + localize(lang,
# path)`. Le canonical est auto-referent PAR CONSTRUCTION. Toute deviation
# signifie que la page n'est pas la ou elle se declare — jamais un choix
# editorial. Un canonical vers un 404 fait abandonner la page qui le porte.
canon_absent, canon_fantome, canon_ailleurs = [], [], []
for u, h in H.items():
    m = re.search(r'<link rel="canonical" href="([^"]+)"', h)
    if not m:
        canon_absent.append(u)
        continue
    cible = re.sub(r'^https?://[^/]+', '', _html.unescape(m.group(1))) or '/'
    if cible == u:
        continue
    (canon_fantome if cible not in H else canon_ailleurs).append(f"{u} -> {cible}")
if canon_fantome:
    erreurs.append(f"{len(canon_fantome)} canonical(s) vers une page INEXISTANTE "
                   f"— la page se saborde : {canon_fantome[:3]}")
if canon_ailleurs:
    erreurs.append(f"{len(canon_ailleurs)} canonical(s) vers une AUTRE page du site "
                   f"— construite ici, declaree ailleurs : {canon_ailleurs[:3]}")

# ── 6. reciprocite hreflang ─────────────────────────────────────────────────
def alternates(h):
    out = {}
    for tag in re.findall(r'<link[^>]+rel="alternate"[^>]*>', h):
        lg = g(tag, r'hreflang="([^"]+)"')
        hr = g(tag, r'href="([^"]+)"')
        if lg and hr:
            out[lg] = re.sub(r'^https?://[^/]+', '', hr)
    return out

anomalies = []
for u, h in H.items():
    for lg, cible in alternates(h).items():
        if lg == 'x-default':
            # ⭐ AVANT LE 29/07/2026 ON SAUTAIT PUREMENT ET SIMPLEMENT x-default.
            # Or `Base.astro` l.114 l'emet SANS CONDITION vers la langue pivot :
            # une page qui n'existe pas dans le pivot pointait donc vers un 404,
            # et l'audit ne pouvait pas le voir. Il n'a pas de reciproque a
            # verifier (c'est un repli, pas une paire), mais sa cible doit
            # exister comme n'importe quelle autre.
            if cible not in H:
                anomalies.append(f"{u} -> {cible} (x-default inexistant)")
            continue
        if cible not in H:
            anomalies.append(f"{u} -> {cible} (inexistante)")
        elif u not in set(alternates(H[cible]).values()):
            anomalies.append(f"{u} -> {cible} (pas de retour)")
if anomalies:
    erreurs.append(f"{len(anomalies)} anomalies hreflang : {anomalies[:3]}")

# ── 7. profondeur de clic ───────────────────────────────────────────────────
liens = defaultdict(set)
for u, h in H.items():
    for href in liens_internes(h):
        cible = href if href.endswith('/') else href + '/'
        if cible in H:
            liens[u].add(cible)
vu, file = {'/': 0}, ['/']
while file:
    cur = file.pop(0)
    for n in liens[cur]:
        if n not in vu:
            vu[n] = vu[cur] + 1
            file.append(n)
inatteignables = sorted(set(H) - set(vu) - noidx)
if inatteignables:
    erreurs.append(f"{len(inatteignables)} pages inatteignables par lien interne : {inatteignables[:3]}")
# ⭐ Liens ENTRANTS distincts : la profondeur de clic ne dit pas tout. Une page
# atteignable par un seul lien, depuis une seule page, ne recoit presque rien —
# et six liens identiques vers la meme cible n'en font qu'un.
entrants = defaultdict(set)
for u, h in H.items():
    for href in set(liens_internes(h)):
        cible = href if href.endswith('/') else href + '/'
        if cible in H and cible != u:
            entrants[cible].add(u)
isoles = sorted(u for u in H if u not in noidx and u != '/' and len(entrants[u]) < 2)
if isoles:
    avertissements.append(f"{len(isoles)} pages avec moins de 2 pages qui y menent — "
                          + ', '.join(isoles[:3]))

profond = [u for u, d in vu.items() if d > 4]
if profond:
    avertissements.append(f"{len(profond)} pages a plus de 4 clics de l'accueil")

# ── 8. donnees structurees ──────────────────────────────────────────────────
types = Counter()
for u, h in H.items():
    for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
        try:
            data = json.loads(bloc)
        except json.JSONDecodeError as e:
            erreurs.append(f"JSON-LD invalide sur {u} : {e}")
            continue
        for node in (data if isinstance(data, list) else [data]):
            types[node.get('@type', '?')] += 1

# ── 8bis. « PAGE RECOPIEE » — CONTROLE TENTE, MESURE, ET REFUSE (28/07/2026) ─
# ⚠️ NE PAS LE REECRIRE ICI SANS LIRE CECI. Le defaut est reel : `resolveLang()`
# recopie la langue pivot des qu'une traduction manque, et la page obtenue passe
# TOUS les autres controles — titre, description, canonical, hreflang, poids.
# Elle dit simplement autre chose que ce que son <html lang> promet.
# J'ai essaye de l'attraper ici, en comparant le <main> d'une page localisee a
# celui de son pivot. Deux versions, deux echecs, tous deux MESURES :
#   1. comparaison a l'IDENTIQUE  -> ne voit RIEN. Verifie par l'echec : garde-fou
#      desarme, 205 pages construites dont /es/brands/ en anglais, audit vert.
#      Motif : le titre et le chapeau d'une section viennent de la table reseau
#      (traduite). Une page recopiee ne lui est jamais EGALE, elle lui RESSEMBLE.
#   2. seuil de SIMILITUDE (0.85, choisi dans le fosse mesure sur vevewiki :
#      pages vraiment traduites 0.40-0.72, pages recopiees 0.88-0.98)
#      -> 43 FAUSSES ALERTES sur veveprice. Ses pages de collection et de rarete
#      sont des tableaux de chiffres et de titres d'objets (« Return of the Jedi
#      #1: Poster Series - Alex Ross Main Cover ») : identiques dans toutes les
#      langues PAR NATURE, et c'est correct. Restreindre aux longues phrases n'y
#      change rien — ces titres FONT de longues phrases.
# ➡️ Un seuil regle sur un site editorial ne transporte pas sur un site de
#    donnees, et cet audit sert les 15 sites. Un controle qui crie au loup sur un
#    site entier finit desarme, et ne garde alors plus rien (cf. test_slugs).
# ➡️ LE CONTROLE VIT DONC LA OU IL EST EXACT, PAS APPROXIMATIF : `test:langues`
#    interroge le MOTEUR, qui sait champ par champ ce qui est retombe sur le
#    repli (`__repli`, engine/lib/editorial.mjs). Mesurer le HTML obligeait a
#    deviner ; interroger la source ne demande aucun seuil.

# ── 9. fuite de donnees ─────────────────────────────────────────────────────
idx = D / 'search-index.json'
# ⭐ CHAMPS AUTORISES DANS L'INDEX — liste blanche, pas liste noire.
#   s = adresse    n = libelle affiche
#   t = section d'origine (glossary, brands, blog…)   ⟵ ajoute le 30/07/2026
#   l = langue de l'entree                           ⟵ ajoute le 30/07/2026
# ⚠️ CE CONTROLE A FAIT SON TRAVAIL : en indexant l'editorial de vevewiki,
# `search-index.json.js` a commence a emettre `t` et `l`, et cet audit l'a
# signale comme une fuite. Il avait raison de crier — c'est la liste qui devait
# etre etendue, DELIBEREMENT, et non le controle contourne.
# Pourquoi ces deux champs ne sont pas une fuite : ni l'un ni l'autre n'est une
# donnee. `t` est le premier segment de l'adresse deja presente dans `s`, `l`
# est le prefixe de langue de cette meme adresse. Ils ne font que rendre lisible
# ce que `s` contient deja — et ils sont indispensables cote client : `t` pour
# distinguer deux homonymes de sections differentes, `l` pour ne pas proposer a
# un lecteur francais une entree qui n'existe qu'en anglais.
# 🔴 TOUT AUTRE CHAMP RESTE UN DEFAUT. En particulier : jamais de prix, jamais
# de definition, jamais de corps d'article — l'index doit rester pauvre.
CHAMPS_INDEX = {'s', 'n', 't', 'l'}
if idx.exists():
    ech = json.loads(idx.read_text(encoding='utf-8'))
    if ech and set(ech[0]) - CHAMPS_INDEX:
        erreurs.append(f"l'index de recherche expose des champs en trop : "
                       f"{sorted(set(ech[0]) - CHAMPS_INDEX)} "
                       f"(autorises : {sorted(CHAMPS_INDEX)})")

# ── rapport ─────────────────────────────────────────────────────────────────
print(f"AUDIT SEO — {len(H)} pages, {len(sm)} URL au sitemap")
print(f"  titres uniques      : {len(set(titles.values()))}/{len(H)}")
print(f"  descriptions uniques: {len(set(d for d in descs.values() if d))}/{len(H)}")
print(f"  profondeur max      : {max(vu.values()) if vu else '-'} clics")
print(f"  donnees structurees : {dict(types)}")
print()
for e in erreurs:
    print("  [DEFAUT]", e)
for a in avertissements:
    print("  [a surveiller]", a)
if not erreurs:
    print("  aucun defaut bloquant.")
sys.exit(1 if erreurs else 0)
