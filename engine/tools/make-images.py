#!/usr/bin/env python3
"""Genere public/og.png et public/apple-touch-icon.png depuis le manifeste du site.
   Usage : SITE=veveprice python3 engine/tools/make-images.py"""
import os, sys, pathlib, yaml
from PIL import Image, ImageDraw, ImageFont

SITE = os.environ.get('SITE', 'veveprice')
ROOT = pathlib.Path(__file__).resolve().parents[2]
m = yaml.safe_load((ROOT / 'sites' / SITE / 'manifest.yml').read_text(encoding='utf-8'))
pal = m.get('identity', {}).get('palette', {})
brand = m['site'].get('brand', SITE)
domain = m['site'].get('domain', '')
tag = m['site'].get('tagline', '')
if isinstance(tag, dict):
    tag = tag.get(m.get('languages', {}).get('default', 'en')) or next(iter(tag.values()))

F = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
hexa = lambda c, d: tuple(int((c or d).lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
BG, PRI, TXT, MUT = hexa(pal.get('bg'), '#0b0e14'), hexa(pal.get('primary'), '#4f8cff'), hexa(pal.get('text'), '#e6edf7'), hexa(pal.get('muted'), '#94a3b8')

# --- image de partage 1200x630 ---
W, H = 1200, 630
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.rectangle([0, 0, W, 10], fill=PRI)                    # bandeau de marque
d.rounded_rectangle([70, 90, 190, 210], radius=28, fill=PRI)
ini = ''.join(w[0] for w in brand.split())[:2].upper()
fi = ImageFont.truetype(F, 58)
b = d.textbbox((0, 0), ini, font=fi)
d.text((130 - (b[2]-b[0])/2, 150 - (b[3]-b[1])/2 - 6), ini, font=fi, fill=(255, 255, 255))
d.text((70, 270), brand, font=ImageFont.truetype(F, 76), fill=TXT)
# tagline sur 2 lignes max
ft = ImageFont.truetype(FR, 34)
words, line, lines = tag.split(), '', []
for w in words:
    t = (line + ' ' + w).strip()
    if d.textlength(t, font=ft) > W - 140 and line:
        lines.append(line); line = w
    else: line = t
lines.append(line)
for i, l in enumerate(lines[:2]):
    d.text((70, 380 + i * 46), l, font=ft, fill=MUT)
d.text((70, H - 80), domain, font=ImageFont.truetype(FR, 30), fill=PRI)
out = ROOT / 'public'; out.mkdir(exist_ok=True)
im.save(out / 'og.png', optimize=True)

# --- icone iOS 180x180 ---
S = 180
ic = Image.new('RGB', (S, S), PRI); d2 = ImageDraw.Draw(ic)
f2 = ImageFont.truetype(F, 82)
b2 = d2.textbbox((0, 0), ini, font=f2)
d2.text((S/2 - (b2[2]-b2[0])/2, S/2 - (b2[3]-b2[1])/2 - 8), ini, font=f2, fill=(255, 255, 255))
ic.save(out / 'apple-touch-icon.png', optimize=True)
print(f"images generees pour {SITE} : og.png + apple-touch-icon.png")
