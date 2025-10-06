// src/lib/products.ts
import type { Product } from "../types";

/* ---------- helpers ---------- */
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

/** Drive share -> direct */
function toDirectImageUrl(u?: string) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

/** NEW: find an image URL in ANY column */
function findAnyImageUrl(row: Row): string | undefined {
  // Prefer common headers first (cheap win)
  const preferred =
    pick(
      row,
      "Image",
      "Image URL",
      "ImageUrl",
      "Picture",
      "Photo",
      "Img",
      "Thumbnail",
      "Main Image"
    ) || undefined;
  if (preferred) return preferred;

  // Fallback: scan all cells for something that looks like an image URL
  const looksUrl = (s: string) =>
    /^https?:\/\//i.test(s) || s.startsWith("/");

  const looksImage = (s: string) =>
    /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(s) ||
    /drive\.google\.com\/file\/d\//i.test(s) ||
    /wp-content|cloudfront|cdn|images|branding/i.test(s);

  for (const v of Object.values(row)) {
    const s = String(v || "").trim();
    if (!s) continue;
    if (looksUrl(s) && looksImage(s)) return s;
  }
  return undefined;
}

/** Map a row to Product */
function mapRow(row: Row): Product {
  const name = pick(row, "Name", "Product", "Title");
  const code = pick(row, "SKU", "Code", "Item Code", "Product Code");
  const description = pick(row, "Description", "Desc", "Blurb");
  const category = pick(row, "Category", "Categories");
  const url = pick(row, "URL", "Link", "Page");
  const pdfUrl = pick(row, "PDF", "Spec", "Spec Sheet", "Spec URL");

  const rawImg = findAnyImageUrl(row);
  const direct = toDirectImageUrl(rawImg);

  // If it’s absolute (http) proxy it; if local (/foo.jpg) keep it
  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;

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
  };
}

/* ---------- main fetch ---------- */
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheet?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const data = await res.json();
  const rows = valuesToRows(data.values || []);
  return rows.map(mapRow);
}
