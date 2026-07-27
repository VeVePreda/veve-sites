#!/usr/bin/env python3
"""Audit SEO du site construit (dossier dist/).

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
for f in D.rglob('*'):
    if f.is_file():
        targets.add('/' + str(f.relative_to(D)).replace('\\', '/'))

# Les liens internes peuvent etre relatifs (/fr/) OU absolus
# (https://veveprice.com/fr/) : le selecteur de langue utilise la forme absolue.
HOTE = ''
for h in H.values():
    m = re.search(r'<link rel="canonical" href="(https?://[^/]+)', h)
    if m:
        HOTE = m.group(1)
        break

def liens_internes(h):
    out = []
    for href in re.findall(r'href="([^"#?]+)"', h):
        if HOTE and href.startswith(HOTE):
            href = href[len(HOTE):] or '/'
        if href.startswith('/'):
            out.append(href)
    return out

# ── 1. liens internes ───────────────────────────────────────────────────────
casses = Counter()
for u, h in H.items():
    for href in liens_internes(h):
        cible = href if href.endswith('/') else href + '/'
        if cible not in targets and href not in targets:
            casses[href] += 1
if casses:
    erreurs.append(f"{len(casses)} liens internes casses : {dict(list(casses.items())[:5])}")

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
a_des_prix = any(re.match(r'^(/[a-z]{2})?/(collectibles|comics|collection|movers|rarity)/', u) for u in H)
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
figs = re.findall(r'<figure class="fig".*?</figure>', ' '.join(H.values()), re.S)
sans_cartouche = [f for f in figs if 'collect' not in _html.unescape(f).lower()]
if figs and sans_cartouche:
    erreurs.append(f"{len(sans_cartouche)} figure(s) sur {len(figs)} sans date de collecte "
                   "dans le SVG — une image partagee doit rester datable")

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

# ── 9. fuite de donnees ─────────────────────────────────────────────────────
idx = D / 'search-index.json'
if idx.exists():
    ech = json.loads(idx.read_text(encoding='utf-8'))
    if ech and set(ech[0]) - {'s', 'n'}:
        erreurs.append(f"l'index de recherche expose des champs en trop : {sorted(set(ech[0]))}")

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
