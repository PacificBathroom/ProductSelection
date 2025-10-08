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

/** Try to find an image URL from any column */
function findAnyImageUrl(row: Row): string | undefined {
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
      "Main Image",
      "Image Link"
    ) || undefined;
  if (preferred) return preferred;

  const looksUrl = (s: string) => /^https?:\/\//i.test(s) || s.startsWith("/");
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

/** Turn raw string into bullet list */
function splitBullets(s?: string) {
  return (s ?? "")
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|–|-/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Map a row to a Product object */
function mapRow(row: Row): Product {
  const name = pick(row, "Name", "Product", "Title");
  const code = pick(row, "SKU", "Code", "Item Code", "Product Code");
  const description = pick(row, "Description", "Desc", "Blurb", "Details");
  const category = pick(row, "Category", "Categories");
  const url = pick(row, "URL", "Link", "Page");

  const pdfUrl = pick(
    row,
    "PDF",
    "Spec",
    "Spec URL",
    "Spec Sheet",
    "Specification PDF",
    "Spec sheet (PDF)",
    "Specifications",
    "Specification",
    "Specs PDF",
    "Download Link"
  );

  const rawImg = findAnyImageUrl(row);
  const direct = toDirectImageUrl(rawImg);

  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;

  // Expanded spec field detection — captures *any* “spec”-like field
  const specsRaw =
    pick(
      row,
      "Bullets",
      "Specs",
      "Features",
      "Specifications",
      "Specification",
      "Product Features",
      "Key Features",
      "Highlights",
      "Technical Data",
      "Technical Details",
      "Product Details",
      "Performance"
    ) || "";

  const specsBullets = splitBullets(specsRaw);
  if (!specsBullets.length && description) {
    // fallback: derive specs from description lines
    specsBullets.push(...splitBullets(description));
  }

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
  const products = rows.map(mapRow);

  // Debug in console — see if specs are coming through
  if (products.length) {
    console.log("Sample product mapping:", products[0]);
    console.log("Sample specsBullets:", products[0]?.specsBullets);
  }

  return products;
}
