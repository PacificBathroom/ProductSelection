// src/lib/products.ts
import type { Product } from "../types";

type Row = Record<string, string | undefined>;

/** First non-empty among keys */
const pick = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    if (k in row) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return undefined;
};

const splitBullets = (s?: string) =>
  (s ?? "")
    .split(/\r?\n|•/g)
    .map((x) => x.trim())
    .filter(Boolean);

/** Matrix -> array of objects using first row as header */
function valuesToRows(values: string[][]): Row[] {
  const [header, ...rest] = values;
  const keys = header.map((h) => String(h || "").trim());
  return rest.map((arr) => {
    const r: Row = {};
    for (let i = 0; i < keys.length; i++) r[keys[i]] = arr[i];
    return r;
  });
}

/** Coerce various server payloads into rows */
function coerceRows(payload: any): Row[] {
  if (!payload) return [];
  // { values: [{...}, {...}] }
  if (Array.isArray(payload.values) && payload.values.length && typeof payload.values[0] === "object" && !Array.isArray(payload.values[0])) {
    return payload.values as Row[];
  }
  // { rows: [{...}, {...}] }
  if (Array.isArray(payload.rows) && payload.rows.length && typeof payload.rows[0] === "object") {
    return payload.rows as Row[];
  }
  // { values: [ [header...], [row...], ... ] }
  if (Array.isArray(payload.values) && Array.isArray(payload.values[0])) {
    return valuesToRows(payload.values as string[][]);
  }
  return [];
}

/** Try singular then plural route */
async function fetchSheet(range: string) {
  const qs = `?range=${encodeURIComponent(range)}&as=objects`;
  for (const ep of ["/api/sheet", "/api/sheets"]) {
    try {
      const r = await fetch(`${ep}${qs}`, { cache: "no-store" });
      if (r.ok) return r.json();
    } catch { /* try next */ }
  }
  // final attempt: matrix on /api/sheet
  const r = await fetch(`/api/sheet?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchProducts failed: ${r.status}`);
  return r.json();
}

/**
 * Load products from your sheet-backed API.
 * Supports: {values:[{...}]}, {rows:[...]}, {values:[[...headers],[...row],...]}
 */
export async function fetchProducts(range: string): Promise<Product[]> {
  const payload = await fetchSheet(range);
  const rows = coerceRows(payload);

  const out: Product[] = rows.map((row) => {
    const p: any = {} as Product;

    // core
    p.name        = pick(row, "name", "Name", "Product");
    p.code        = pick(row, "code", "SKU", "sku", "Item Code");
    p.description = pick(row, "description", "Description", "Desc");
    p.category    = pick(row, "category", "Category", "Cat");

    // images (map many headers + proxy non-origin)
    const rawImg =
      pick(row, "imageProxied", "imageUrl", "Image URL", "Image", "Image link", "Main Image", "Image1", "Image 1") ||
      undefined;

    if (rawImg) {
      const sameOrigin = rawImg.startsWith("/") || /^https?:\/\/[^/]*pacificbathroom/i.test(rawImg);
      p.imageUrl = rawImg; // keep the original
      p.imageProxied = sameOrigin ? rawImg : `/api/img?url=${encodeURIComponent(rawImg)}`;
    }

    // product page link
    p.url = pick(row, "url", "Product URL", "Link");

    // bullets
    const bulletsRaw = pick(row, "specsBullets", "Bullets", "Features") || "";
    p.specsBullets   = splitBullets(bulletsRaw);

    // Accept many possible column names for spec PDF URL
    p.pdfUrl = pick(
      row,
      "pdfUrl",
      "specPdf",
      "specPDF",
      "spec",
      "specSheet",
      "Spec PDF",
      "Spec sheet",
      "Spec sheet (PDF)",
      "PDF"
    );

    // Optional explicit preview image for spec slide
    p.specPreviewUrl = pick(row, "specPreviewUrl", "Spec preview", "Spec Image", "Spec Preview URL");

    return p as Product;
  });

  return out;
}
