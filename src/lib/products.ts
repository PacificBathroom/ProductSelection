// src/lib/products.ts
import type { Product } from "../types";

function normalizeSpecs(raw?: string): string[] {
  let s = (raw ?? "").toString();

  // unify newlines
  s = s.replace(/\r\n?/g, "\n");

  // turn typical bullet markers into new lines
  s = s
    .replace(/[•▪◦·]/g, "\n")        // bullets to newline
    .replace(/(\n|^)\s*-\s+/g, "\n")  // "- bullet"
    .replace(/(\n|^)\s*–\s+/g, "\n")  // en dash bullet
    .replace(/;/g, "\n");             // semicolons to newline

  // split, trim, de-dup, drop URLs and empties
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export async function fetchProducts(range: string): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets ${r.status}`);
  const data = await r.json();

  const rows: any[][] = data.values ?? [];
  // Header: Select | Url | Code | Name | ImageURL | Description | SpecsBullets | PdfURL | ContactName | ContactEmail | ContactPhone | ContactAddress | Category
  const products: Product[] = rows
    .slice(1) // skip header
    .map((raw) => {
      const url          = (raw[1] ?? "").toString().trim();
      const code         = (raw[2] ?? "").toString().trim();
      const name         = (raw[3] ?? "").toString().trim();
      const imageUrl     = (raw[4] ?? "").toString().trim();
      const description  = (raw[5] ?? "").toString();
      const specsRaw     = (raw[6] ?? "").toString();
      const pdfUrl       = (raw[7] ?? "").toString().trim();
      const category     = (raw[12] ?? "").toString().trim();

      // use file-proxy for images to avoid CORS when converting to dataURL for pptx
      const imageProxied = imageUrl ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}` : "";

      return {
        url, code, name, imageUrl, imageProxied,
        description,
        specsBullets: normalizeSpecs(specsRaw),
        pdfUrl,
        category,
      } as Product;
    })
    // keep empty rows out
    .filter(p => p.name || p.code || p.url || p.imageUrl);

  return products;
}