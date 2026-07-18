// Genere un echantillon realiste pour builder hors-ligne (bac a sable, CI).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'sample');

const series = [
  { name: 'Modern Marvel S1', brand: 'Marvel', licensor: 'Disney' },
  { name: 'DC Classics S2', brand: 'DC', licensor: 'Warner' },
  { name: 'Cosmic Heroes', brand: 'Marvel', licensor: 'Disney' },
  { name: 'Retro Arcade', brand: 'Capcom', licensor: 'Capcom' },
];
const rarities = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Secret Rare'];
const heroes = ['Spider-Man','Iron Man','Batman','Superman','Wolverine','Thor','Flash','Hulk','Venom','Mega Man','Ryu','Groot','Loki','Joker','Storm','Vision','Rocket','Gamora','Zangief','Doctor Strange'];

let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const cat = [];
const prices = [];
const baselines = [];

for (let i = 0; i < 40; i++) {
  const uuid = `sample-${String(i).padStart(4, '0')}-${Math.floor(rnd() * 1e6)}`;
  const s = series[i % series.length];
  const rarity = pick(rarities);
  const name = `${heroes[i % heroes.length]} ${['','Variant','Gold','Prime'][i % 4]}`.trim();
  const tirage = [500, 1000, 2500, 5000, 10000][i % 5];
  const store = [10, 20, 30, 60, 100][i % 5];
  const start = new Date(Date.UTC(2021, 9 + (i % 3), 1 + (i % 20)));
  let floor = Math.round((store * (2 + rnd() * 8)) * 100) / 100;
  let listings = 5 + Math.floor(rnd() * 60);
  const hist = [];
  const months = 50;
  for (let m = 0; m < months; m++) {
    const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + m);
    if (d > new Date()) break;
    const pts = 1 + Math.floor(rnd() * 3);
    for (let p = 0; p < pts; p++) {
      const day = new Date(d); day.setUTCDate(1 + Math.floor(rnd() * 27));
      const boom = m < 6 ? 1.25 : m < 14 ? 0.93 : 0.995;
      floor = Math.max(store * 0.6, Math.round(floor * boom * (0.9 + rnd() * 0.22) * 100) / 100);
      listings = Math.max(1, listings + Math.floor(rnd() * 9) - 4);
      hist.push({ ts: day.toISOString().replace('.000', ''), floor, listings });
    }
  }
  hist.sort((a, b) => a.ts.localeCompare(b.ts));
  for (const h of hist) prices.push(`${uuid},${h.ts},${h.floor},${h.listings}`);
  const fl = hist.map((h) => h.floor).sort((a, b) => a - b);
  const q = (p) => fl[Math.min(fl.length - 1, Math.floor(fl.length * p))];
  const last = hist[hist.length - 1];
  baselines.push(`${uuid},${fl[0]},${q(0.05)},${q(0.25)},${q(0.5)},${q(0.75)},${q(0.95)},${fl[fl.length-1]},${hist.length},${last.floor},${last.listings}`);
  cat.push([uuid,'collectible',name,'Standard',rarity,start.toISOString().slice(0,10),s.name,s.brand,s.licensor,tirage,store,last.floor,last.listings,fl[fl.length-1],fl[0]].join(','));
}

writeFileSync(join(OUT, 'catalogue.csv'), 'uuid,kind,name,edition_type,rarity,release_date,series,brand,licensor,tirage,store_price,floor,listings,ath,atl\n' + cat.join('\n') + '\n');
writeFileSync(join(OUT, 'prices.csv'), 'veve_uuid,ts_utc,floor,listings\n' + prices.join('\n') + '\n');
writeFileSync(join(OUT, 'prices_baselines.csv'), 'veve_uuid,floor_min,p5,p25,p50,p75,p95,floor_max,n_points,last_floor,last_listings\n' + baselines.join('\n') + '\n');
console.log(`echantillon: ${cat.length} items, ${prices.length} points de prix`);
