#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  VEVE PRICE — INSTALLATEUR
#  À lancer depuis la RACINE de veve-sites :   python3 installer.py
# ═══════════════════════════════════════════════════════════════════════════
#  Il fait les TROIS choses qui ne peuvent pas être un fichier posé :
#    1. patche engine/lib/access.mjs      (4 endroits)
#    2. fusionne 37 clés dans les 4 fichiers de langue
#    3. remplace 3 blocs de sites/veveprice/manifest.yml
#
#  ⭐ IDEMPOTENT : le relancer ne double rien, il dit « déjà fait ».
#  ⛔ IL S'ARRÊTE AU LIEU DE DEVINER. Si un ancrage a bougé depuis le 30/07,
#     il refuse et dit lequel. Un fichier d'accès à moitié patché est pire
#     qu'un fichier pas patché du tout.
import json, pathlib, re, sys, shutil, datetime

RACINE = pathlib.Path('.')
def stop(m): print(f"\n⛔ {m}"); sys.exit(1)
if not (RACINE/'engine'/'lib'/'access.mjs').exists():
    stop("engine/lib/access.mjs introuvable — lancer depuis la racine de veve-sites.")

# ⭐ On sauvegarde AVANT de toucher quoi que ce soit. Un installateur qui ne
# laisse pas de marche arrière demande à l'utilisateur de lui faire confiance ;
# celui-ci lui laisse le droit de se raviser.
HORO = datetime.datetime.now().strftime('%d%m-%H%M')
SAUVE = RACINE/f'.sauvegarde-{HORO}'
CIBLES = ['engine/lib/access.mjs', 'sites/veveprice/manifest.yml',
          'engine/i18n/fr.json', 'engine/i18n/en.json',
          'engine/i18n/es.json', 'engine/i18n/de.json']
SAUVE.mkdir(exist_ok=True)
for c in CIBLES:
    p = RACINE/c
    if p.exists():
        d = SAUVE/c; d.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, d)
print(f"↩  sauvegarde dans {SAUVE}/  (à supprimer une fois le build vert)\n")

# ═══ 1 · access.mjs ════════════════════════════════════════════════════════
print("1 · engine/lib/access.mjs")
P = RACINE/'engine'/'lib'/'access.mjs'; s = P.read_text(encoding='utf-8'); avant1 = s

def rempl(a, b, etq, marqueur):
    # `marqueur` : une chaîne qui n'existe QU'APRÈS ce remplacement précis.
    # ⛔ Ne jamais déduire l'idempotence de la 1re ligne du remplacement :
    #    c'est souvent un commentaire, et un commentaire ne prouve rien.
    #    Cette erreur a fait déclarer une variable deux fois lors d'un essai.
    global s
    if marqueur in s: print(f"   = {etq} — déjà fait"); return
    if a not in s: stop(f"{etq} : ancrage introuvable. access.mjs a changé.\n"
                        f"   Ne pas forcer : reporter le patch à la main.")
    s = s.replace(a, b, 1); print(f"   ✓ {etq}")

rempl("export const PALIERS = ['visitor', 'free', 'member'];",
 "// ⚠️ L'ORDRE EST LA SEULE CHOSE QUI COMPTE : `auMoins()` compare des RANGS.\n"
 "// Inserer un palier au milieu deplace tous les suivants et change\n"
 "// SILENCIEUSEMENT qui franchit quoi. On ajoute a la fin, jamais au milieu.\n"
 "// ⭐ `member` est GRATUIT (compte sans paiement) : il est sous `crevette`.\n"
 "export const PALIERS = ['visitor', 'free', 'member', 'crevette', 'langouste', 'whale'];",
 "les 6 paliers", "'langouste', 'whale']")

rempl("  price_history: { tier: 'member', public_max: 30, public_days: 90 },\n};",
 "  price_history: { tier: 'member', public_max: 30, public_days: 90 },\n"
 "  // ⭐ Ces portes ne se TRONQUENT pas : elles s'ouvrent ou non, pas de plafond.\n"
 "  extremes:     { tier: 'crevette' },\n"
 "  modules:      { tier: 'crevette' },\n"
 "  alerts:       { tier: 'crevette', caps: { member: 0, crevette: 2, langouste: 10, whale: -1 } },\n"
 "  wallet_watch: { tier: 'whale' },\n};",
 "les 4 portes", "wallet_watch: { tier: 'whale' }")

rempl("const PORTES_CONNUES = new Set(['price_history']);",
 "const PORTES_CONNUES = new Set(['price_history', 'extremes', 'modules', 'alerts', 'wallet_watch']);",
 "portes connues", "new Set(['price_history', 'extremes'")

rempl("  const portes = {};\n  for (const nom of PORTES_CONNUES) {",
 "  // ⛔ Ce fichier promettait « on prefere l'erreur bruyante », mais la boucle\n"
 "  // itere PORTES_CONNUES : une porte inventee dans le manifeste etait ignoree\n"
 "  // EN SILENCE. Un manifeste qui ne fait rien et ne dit rien est pire qu'un\n"
 "  // manifeste qui echoue. On tient la promesse ici.\n"
 "  const inconnues = Object.keys(brut.gates || {}).filter((n) => !PORTES_CONNUES.has(n));\n"
 "  if (inconnues.length) {\n"
 "    throw new Error(`[acces] porte inconnue dans access.gates : ${inconnues.join(', ')} `\n"
 "      + `(connues : ${[...PORTES_CONNUES].join(', ')})`);\n"
 "  }\n\n  const portes = {};\n  for (const nom of PORTES_CONNUES) {",
 "porte inconnue = erreur", "const inconnues = Object.keys(brut.gates")

rempl("      public_days: actif ? Number(dit.public_days ?? heriteFenetre ?? def.public_days) : Infinity,\n    };",
 "      public_days: actif ? Number(dit.public_days ?? heriteFenetre ?? def.public_days) : Infinity,\n"
 "      // ⚠️ `-1` = illimite, et il faut le DIRE : `Infinity` ne survit pas a un\n"
 "      // aller-retour JSON, il en revient en `null`. Le sentinelle entier est le\n"
 "      // seul qui traverse une serialisation sans se faire effacer.\n"
 "      caps: { ...(def.caps || {}), ...(dit.caps || {}) },\n    };",
 "champ caps", "caps: { ...(def.caps || {})")

if 'export function plafond(' not in s:
    s += ("\n// Combien d'unites ce palier a-t-il droit sur cette porte ?\n"
          "//   -1 = illimite · 0 = aucune (il voit le NOM du module, pas son contenu)\n"
          "export function plafond(nomPorte, locals) {\n"
          "  const p = porte(nomPorte);\n"
          "  if (!p.actif) return -1;\n"
          "  const v = p.caps?.[palierVisiteur(locals)];\n"
          "  return v === undefined ? 0 : Number(v);\n}\n")
    print("   ✓ export plafond()")
else: print("   = export plafond() — déjà fait")
if s != avant1: P.write_text(s, encoding='utf-8')

# ═══ 2 · i18n ══════════════════════════════════════════════════════════════
print("\n2 · engine/i18n/ — 38 clés × 4 langues")
for lg in ['fr','en','es','de']:
    src = RACINE/'_ajouts-i18n'/f'{lg}.json'
    dst = RACINE/'engine'/'i18n'/f'{lg}.json'
    if not src.exists(): stop(f"_ajouts-i18n/{lg}.json manquant — décompresser le zip à la racine.")
    if not dst.exists(): stop(f"engine/i18n/{lg}.json introuvable.")
    base = json.loads(dst.read_text(encoding='utf-8'))
    ajouts = json.loads(src.read_text(encoding='utf-8'))
    neuves = {k: v for k, v in ajouts.items() if k not in base}
    # ⛔ On n'écrase JAMAIS une clé existante : si elle est là, elle sert
    # ailleurs, et la remplacer changerait une page qu'on ne regarde pas.
    conflits = [k for k in ajouts if k in base and base[k] != ajouts[k]]
    if conflits: stop(f"{lg}.json : ces clés existent déjà avec une autre valeur → {conflits}")
    if not neuves: print(f"   = {lg} — déjà fait"); continue
    base.update(neuves)
    dst.write_text(json.dumps(base, ensure_ascii=False, indent=2, sort_keys=True)+'\n', encoding='utf-8')
    print(f"   ✓ {lg} — +{len(neuves)} clés")

# ═══ 3 · manifest.yml ══════════════════════════════════════════════════════
print("\n3 · sites/veveprice/manifest.yml — 3 blocs")
M = RACINE/'sites'/'veveprice'/'manifest.yml'
if not M.exists(): stop("sites/veveprice/manifest.yml introuvable.")
src = RACINE/'_blocs-manifeste.yml'
if not src.exists(): stop("_blocs-manifeste.yml manquant — décompresser le zip à la racine.")
m = M.read_text(encoding='utf-8'); avant3 = m
nouveaux = src.read_text(encoding='utf-8')

def extraire(txt, cle):
    """Le bloc de premier niveau `cle:` jusqu'à la prochaine clé de 1er niveau.
    ⚠️ Un bloc YAML ne se délimite pas par un compte de lignes : il se délimite
    par l'INDENTATION. Découper aux numéros de ligne casse au premier commentaire
    ajouté au-dessus."""
    d = re.search(rf'^{cle}:\s*$', txt, re.M)
    if not d: return None, None, None
    reste = txt[d.end():]
    f = re.search(r'^(?=[A-Za-z_])', reste, re.M)
    fin = d.end() + (f.start() if f else len(reste))
    return d.start(), fin, txt[d.start():fin]

for cle in ['identity', 'access', 'offer']:
    a, b, ancien = extraire(m, cle)
    if a is None: stop(f"bloc `{cle}:` introuvable dans le manifeste.")
    _, _, neuf = extraire(nouveaux, cle)
    if neuf is None: stop(f"bloc `{cle}:` absent de _blocs-manifeste.yml.")
    if ancien.strip() == neuf.strip(): print(f"   = {cle} — déjà fait"); continue
    m = m[:a] + neuf.rstrip() + '\n\n' + m[b:]
    print(f"   ✓ {cle}")
if m != avant3: M.write_text(m, encoding='utf-8')

# ═══ VÉRIFICATION — sur les fichiers RELUS DEPUIS LE DISQUE ════════════════
# ⭐ Un script qui se vérifie sur sa propre mémoire ne prouve que sa mémoire.
print("\n─── vérification ───")
v = P.read_text(encoding='utf-8'); ok = True
for nom, motif in [("6 paliers", "'langouste', 'whale']"),
                   ("5 portes", "'alerts', 'wallet_watch']"),
                   ("porte inconnue crie", "porte inconnue dans access.gates"),
                   ("champ caps", "caps: { ...(def.caps || {})"),
                   ("export plafond", "export function plafond(")]:
    good = motif in v; ok &= good; print(f"  {'✓' if good else '⛔'} access.mjs — {nom}")
try:
    import yaml
    d = yaml.safe_load(M.read_text(encoding='utf-8'))
    t = d['access']['tiers']; th = d['identity']['theme']
    print(f"  {'✓' if th=='vitrine' else '⛔'} manifeste — theme = {th}")
    print(f"  {'✓' if len(t)==5 else '⛔'} manifeste — {len(t)} paliers : {', '.join(t)}")
    print(f"  {'✓' if d['offer'].get('plans') else '⛔'} manifeste — {len(d['offer'].get('plans',[]))} plans")
    ok &= th=='vitrine' and len(t)==5
except ImportError:
    print("  ~ manifeste — PyYAML absent, contrôle sauté (sans gravité)")
except Exception as e: ok = False; print(f"  ⛔ manifeste — {e}")
for lg in ['fr','en','es','de']:
    d = json.loads((RACINE/'engine'/'i18n'/f'{lg}.json').read_text(encoding='utf-8'))
    good = 'home.pieces' in d and 'offer.title' in d; ok &= good
    print(f"  {'✓' if good else '⛔'} i18n {lg} — {len(d)} clés")

print("\n" + ("✅ TERMINÉ. Étape suivante : npm run test" if ok else "⛔ ÉCHEC — voir ci-dessus"))
print("⚠️  Il reste UNE chose à la main : les 3 lignes de nav dans src/layouts/Base.astro")
print("    (fichier partagé avec la conversation vevewiki — voir NAV-a-la-main.md)")
sys.exit(0 if ok else 1)
