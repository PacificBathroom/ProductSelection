import { sheetsUrl, proxyUrl } from "./api";
import type { Product } from "../types";

// normalize "Column Name" → "columnname"
const norm = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// extract URL if the cell uses =IMAGE("https://...") or variations
const urlFromImageFormula = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
};

// split specs text into bullets (handles lines or semicolons)
const splitBullets = (v: unknown): string[] | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s
    .split(/\r?\n|;|•/g)
    .map(t => t.trim())
    .filter(Boolean);
};

// map common header variants → canonical key
const KEY_MAP: Record<string, keyof Product> = {
  // code
  code: "code", sku: "code", itemcode: "code", productcode: "code",
  // name
  name: "name", productname: "name", title: "name",
  // description
  description: "description", desc: "description", details: "description",
  // image
  image: "imageUrl", imageurl: "imageUrl", img: "imageUrl", picture: "imageUrl",
  // specs
  specs: "specsBullets", spec: "specsBullets", specsbullets: "specsBullets",
  specifications: "specsBullets",
  // pdf/datasheet
  pdf: "pdfUrl", pdfurl: "pdfUrl", datasheet: "pdfUrl", brochure: "pdfUrl",
  // category
  category: "category", type: "category", group: "category"
};

function coerceImageUrl(v: unknown): string | undefined {
  return urlFromImageFormula(v) || (typeof v === "string" ? v.trim() : undefined);
}

export async function fetchProducts(range = "Products!A:Z"): Promise<Product[]> {
  const url = `${sheetsUrl}?as=objects&range=${encodeURIComponent(range)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = (await r.json()) as { values?: Record<string, unknown>[] };
  const rows = data.values ?? [];

  const products: Product[] = rows.map(raw => {
    // Build a case-insensitive view of the row keys
    const lower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) lower[norm(k)] = v;

    const out: Product = {};

    // walk through keys and map what we recognize
    for (const [k, v] of Object.entries(lower)) {
      const key = KEY_MAP[k];
      if (!key) continue;

      if (key === "imageUrl") {
        const u = coerceImageUrl(v);
        if (u) {
          out.imageUrl = u;
          out.imageProxied = proxyUrl(u);
        }
      } else if (key === "specsBullets") {
        out.specsBullets = splitBullets(v);
      } else if (key === "description") {
        const s = v == null ? "" : String(v);
        out.description = s || undefined;
      } else if (key === "pdfUrl") {
        const s = v == null ? "" : String(v).trim();
        out.pdfUrl = s || undefined;
      } else if (key === "category") {
        const s = v == null ? "" : String(v).trim();
        out.category = s || undefined;
      } else if (key === "code" || key === "name") {
        const s = v == null ? "" : String(v).trim();
        (out as any)[key] = s || undefined;
      }
    }

    // keep original fields too (optional)
    for (const [k, v] of Object.entries(raw)) {
      if (out[k as keyof Product] === undefined) (out as any)[k] = v;
    }

    return out;
  });

  return products;
}
