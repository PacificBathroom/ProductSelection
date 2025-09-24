// src/lib/products.ts
import type { Product } from "../types";

type Raw = string[];

// Fetch rows from your /api/sheets
export async function fetchProducts(range = "Products!A:Z"): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = await r.json();
  const rows: Raw[] = data.values ?? [];
  if (!rows.length) return [];

  const hdr = rows[0].map((h: string) => (h || "").trim());
  const idx = Object.fromEntries(hdr.map((h: string, i: number) => [h, i])) as Record<string, number>;

  const list: Product[] = rows.slice(1).map((raw: Raw) => {
    const get = (name: string) => String(raw[idx[name]] ?? "").trim();
    const name = get("Name");
    const code = get("Code");
    const url = get("Url");
    const imageUrl = get("ImageURL");
    const description = get("Description");
    const pdfUrl = get("PdfURL");
    const category = get("Category");

    // robust bullet parsing
    const rawBullets = get("SpecsBullets");
    const specsBullets = rawBullets
      ? rawBullets.split(/\r?\n|[•;]|\u2022/g).map(s => s.trim()).filter(Boolean)
      : [];

    const imageProxied = imageUrl
      ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}`
      : "";

    return {
      name: name || "",
      code: code || "",
      url: url || "",
      imageUrl,
      imageProxied,
      description,
      specsBullets,
      pdfUrl,
      category,
    } as Product;
  });

  // keep original sheet order
  return list.filter(Boolean);
}
