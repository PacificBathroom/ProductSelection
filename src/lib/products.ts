import type { Product } from "../types";

// If you already have proxyUrl() elsewhere, you can inline the same behavior:
const prox = (u?: string) => (u ? `/api/file-proxy?url=${encodeURIComponent(u)}` : undefined);

// Be forgiving about how specs are typed in Sheets
function parseSpecs(cell?: string): string[] {
  if (!cell) return [];
  const s = cell.replace(/\r/g, "").trim();
  if (!s) return [];

  // If the cell is a JSON array like ["one","two"]
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) {
      return j.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch { /* not JSON */ }

  // Split on common separators: newlines, bullets, dashes, semicolons, pipes
  return s
    .split(/\n+|•\s*|-\s+|;\s+|\|\s*/g)
    .map(t => t.trim())
    .filter(Boolean);
}

export async function fetchProducts(range: string): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = await r.json();

  const rows: string[][] = data.values ?? [];
  if (!rows.length) return [];
const specsBullets =
  String(row[idx.SpecsBullets] || "")
    .split(/\r?\n|[•;]|\u2022/g)
    .map(s => s.trim())
    .filter(Boolean);

  const [header, ...body] = rows;
  const idx = (name: string) =>
    header.findIndex((h) => h?.toString().trim().toLowerCase() === name.toLowerCase());

  const col = {
    Url: idx("Url"),
    Code: idx("Code"),
    Name: idx("Name"),
    ImageURL: idx("ImageURL"),
    Description: idx("Description"),
    SpecsBullets: idx("SpecsBullets"),
    PdfURL: idx("PdfURL"),
    Category: idx("Category"),
  };

  const get = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");

  const products: Product[] = body.map((row) => {
    const p: Product = {
      url:         get(row, col.Url),
      code:        get(row, col.Code),
      name:        get(row, col.Name),
      imageUrl:    get(row, col.ImageURL),
      description: get(row, col.Description),
      specsBullets: parseSpecs(get(row, col.SpecsBullets)),
      pdfUrl:      get(row, col.PdfURL),
      category:    get(row, col.Category),
    };
    p.imageProxied = prox(p.imageUrl);
    return p;
  });

  // keep rows that actually have some content
  return products.filter(p => (p.name || p.code || p.url));
}
