// src/lib/products.ts
import type { Product } from "../types";

/** ---------- helpers ---------- **/
type Row = Record<string, string | undefined>;

const pick = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
};

function valuesToRows(values: string[][]): Row[] {
  const [header, ...rest] = values;
  const keys = (header ?? []).map((h) => String(h || "").trim());
  return (rest ?? []).map((arr) => {
    const r: Row = {};
    for (let i = 0; i < keys.length; i++) r[keys[i]] = arr[i];
    return r;
  });
}

/** Turn common sharing links into direct image URLs (e.g., Google Drive). */
function toDirectImageUrl(u?: string) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

/** Map a sheet row to your Product shape, adding imageProxied for export. */
function mapRow(row: Row): Product {
  const name = pick(row, "Name", "Product", "Title");
  const code = pick(row, "SKU", "Code", "Item Code", "Product Code");
  const description = pick(row, "Description", "Desc", "Blurb");
  const category = pick(row, "Category", "Categories");
  const url = pick(row, "URL", "Link", "Page");
  const pdfUrl = pick(row, "PDF", "Spec", "Spec PDF", "Spec Sheet");

  const rawImg =
    pick(row, "Image", "Image URL", "Picture", "Img", "Photo") ||
    pick(row, "imageUrl");

  const direct = toDirectImageUrl(rawImg);
  const imageProxied = direct
    ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
    : undefined;

  const specsBullets = (pick(row, "Bullets", "Specs", "Features") || "")
    .split(/\r?\n|•/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: name || code || "—",
    code,
    description,
    category,
    url,
    pdfUrl,
    image: direct,
    imageUrl: direct,
    imageProxied,
    specsBullets,
  } as any;
}

/** ---------- main fetch ---------- **/
/** Fetch products from your Sheet endpoint that returns { values: string[][] } */
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheet?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`sheet fetch failed (${res.status})`);
  const data = await res.json();
  const rows = valuesToRows(data.values || []);
  return rows.map(mapRow);
}
