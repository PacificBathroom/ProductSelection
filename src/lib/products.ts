// src/lib/products.ts
import type { Product } from "../types";

type Row = Record<string, string | undefined>;

/** Safe getter: return first non-empty value among the given keys */
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

/** Convert various sheet API shapes into array of {key:value} rows */
function coerceRows(payload: any): Row[] {
  // 1) Already rows as [{...}, {...}]
  if (payload && Array.isArray(payload.rows) && typeof payload.rows[0] === "object") {
    return payload.rows as Row[];
  }

  // 2) Google Sheets-style "values": [ [header...], [row...], ... ]
  if (payload && Array.isArray(payload.values) && Array.isArray(payload.values[0])) {
    const [header, ...rest] = payload.values as string[][];
    const keys = header.map((h) => String(h || "").trim());
    return rest.map((arr) => {
      const r: Row = {};
      for (let i = 0; i < keys.length; i++) r[keys[i]] = arr[i];
      return r;
    });
  }

  // 3) Fallback
  return [];
}

/**
 * Load products from your sheet-backed API.
 * Expects `/api/sheet?range=...` to return either:
 *  - { rows: Array<Record<string,string>> }  OR
 *  - { values: string[][] } where first row is headers
 */
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheet?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchProducts failed: ${res.status}`);
  const payload = await res.json();
  const rows = coerceRows(payload);

// images / links (tolerant to many header names)
const rawImg =
  pick(row, "imageProxied", "imageUrl", "Image URL", "Image", "Image link", "Main Image", "Image1", "Image 1") ||
  undefined;

if (rawImg) {
  const sameOrigin = rawImg.startsWith("/") || /^https?:\/\/[^/]*pacificbathroom/i.test(rawImg);
  // Keep original for reference
  p.imageUrl = rawImg;
  // Prefer same-origin for UI + PPTX (proxy if needed)
  p.imageProxied = sameOrigin ? rawImg : `/api/img?url=${encodeURIComponent(rawImg)}`;
}


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

    // Optional explicit preview image (used by exportPptx)
    p.specPreviewUrl = pick(
      row,
      "specPreviewUrl",
      "Spec preview",
      "Spec Image",
      "Spec Preview URL"
    );

    // Older cards might read (p as any).imageUrl:
    if (!p.imageProxied) p.imageUrl = pick(row, "imageUrl", "Image", "Image URL");

    return p as Product;
  });

  return out;
}
