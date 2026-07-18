// Donnees structurees JSON-LD.
export const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

export const productLd = (item, url, brand) => ({
  '@context': 'https://schema.org', '@type': 'Product',
  name: item.name, sku: item.uuid, url,
  brand: { '@type': 'Brand', name: item.brand || brand },
  category: item.series || undefined,
  ...(item.floor ? { offers: { '@type': 'Offer', price: item.floor, priceCurrency: 'USD', availability: (item.listings || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url } } : {}),
});

export const breadcrumbLd = (parts) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: parts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, item: p.url })),
});

export const itemListLd = (items, url) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', url,
  numberOfItems: items.length,
  itemListElement: items.slice(0, 50).map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
});

export const websiteLd = (site, url) => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name: site, url,
  potentialAction: { '@type': 'SearchAction', target: `${url}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});
