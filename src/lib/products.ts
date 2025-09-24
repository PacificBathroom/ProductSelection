import type { Product } from "../types";

// Turn a Google Sheets cell into an array of clean bullet points.
function splitSpecs(raw?: string): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/\r?\n|[•\u2022]|[|;]|\t/g)       // newline, •, |, ;, tab
    .map(s => s.replace(/\s+/g, " ").trim()) // collapse spaces
    .filter(Boolean);
}

export async function fetchProducts(range: string): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = await r.json();
  const rows: string[][] = data.values ?? [];
  const [header, ...body] = rows;

  const idx = (name: string) =>
    header.findIndex(h => (h ?? "").trim().toLowerCase() === name.toLowerCase());

  const iUrl  = idx("Url");
  const iCode = idx("Code");
  const iName = idx("Name");
  const iImg  = idx("ImageURL");
  const iDesc = idx("Description");
  const iSpec = idx("SpecsBullets");
  const iPdf  = idx("PdfURL");
  const iCat  = idx("Category");

  const products: Product[] = body.map(row => {
    const imageUrl = (row[iImg] ?? "").toString().trim() || undefined;
    const pdfUrl   = (row[iPdf] ?? "").toString().trim() || undefined;

    return {
      url:        (row[iUrl]  ?? "").toString().trim() || undefined,
      code:       (row[iCode] ?? "").toString().trim() || undefined,
      name:       (row[iName] ?? "").toString().trim() || undefined,
      imageUrl,
      imageProxied: imageUrl ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}` : undefined,
      description: (row[iDesc] ?? "").toString().trim() || undefined,
      specsBullets: splitSpecs((row[iSpec] ?? "").toString()),
      pdfUrl,
      category:   (row[iCat]  ?? "").toString().trim() || undefined,
    } as Product;
  });

  return products;
}
