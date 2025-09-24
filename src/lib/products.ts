// src/lib/products.ts
import type { Product } from "@/types";

export async function fetchProducts(range = "Products!A:Z"): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = await r.json();
  const rows: string[][] = data?.values ?? [];
  if (!rows.length) return [];

  const header = rows[0].map((h: string) => (h || "").trim());
  const idx = (name: string) => header.indexOf(name);

  const iSel = idx("Select");
  const iUrl = idx("Url");
  const iCode = idx("Code");
  const iName = idx("Name");
  const iImage = idx("ImageURL");
  const iDesc = idx("Description");
  const iSpecs = idx("SpecsBullets");
  const iPdf  = idx("PdfURL");
  const iCat  = idx("Category");

  const products: Product[] = rows.slice(1).map((raw: string[]) => {
    const pick = (i: number) => (i >= 0 ? (raw[i] ?? "").trim() : "");

    const url = pick(iUrl);
    const code = pick(iCode);
    const name = pick(iName);
    const description = pick(iDesc);
    const imageUrl = pick(iImage);
    const pdfUrl = pick(iPdf);
    const category = pick(iCat);

    // robust parse of specs
    const specsRaw = pick(iSpecs);
    const specsBullets = (specsRaw
      ? specsRaw
          .split(/\r?\n|;|•/g)
          .flatMap(s => s.split(/(?:^|\s)[\-–—]\s+/g))
          .map(s => s.trim())
          .filter(Boolean)
      : []
    ).slice(0, 20);

    // use the proxy for images so CORS is never a problem (also works in PPTX)
    const imageProxied = imageUrl ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}` : "";

    return {
      url, code, name, description, pdfUrl, category,
      imageUrl, imageProxied,
      specsBullets,
    } as Product;
  });

  // keep original order as in sheet (optionally filter by "Select" if used)
  return products.filter(p => p.name || p.code || p.url);
}
