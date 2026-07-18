import { dataset } from '../../engine/lib/dataset.mjs';
export async function GET() {
  const ds = await dataset();
  const idx = ds.items.map((i) => ({ s: i.slug, n: i.name, f: i.floor }));
  return new Response(JSON.stringify(idx), { headers: { 'content-type': 'application/json' } });
}
