import { dataset } from '../../engine/lib/dataset.mjs';
// Index de recherche VOLONTAIREMENT PAUVRE : uniquement les fiches publiees,
// nom + adresse. Aucun prix, aucune donnee de valeur ne sort en vrac.
export async function GET() {
  const ds = await dataset();
  const idx = ds.items.map((i) => ({ s: i.slug, n: i.name }));
  return new Response(JSON.stringify(idx), { headers: { 'content-type': 'application/json' } });
}
