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

/** Find an image URL in **any** column (prefer common headers) */
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
      "Main Image"
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

/** Split text into array bullets (for “Specs”, “Features”, etc.) */
function splitBullets(s: string): string[] {
  return s
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map(t => t.replace(/^[•\u2022\-–—]\s*/, "").trim())
    .filter(Boolean);
}

/** Map a row to Product */
function mapRow(row: Row): Product {
  const name = pick(row, "Name", "Product", "Title");
  const code = pick(row, "SKU", "Code", "Item Code", "Product Code");
  const description = pick(row, "Description", "Desc", "Blurb");
  const category = pick(row, "Category", "Categories");
  const url = pick(row, "URL", "Link", "Page");

  const pdfUrl = pick(
    row,
    "PDF", "Spec", "Spec URL",
    "Spec Sheet", "Spec sheet", "Spec sheet (PDF)",
    "Specifications", "Specification", "Specs PDF"
  );

  const rawImg = findAnyImageUrl(row);
  const direct = toDirectImageUrl(rawImg);

  // If absolute (http) -> proxy; if local (/foo.jpg) use directly
  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;

  // Build specs bullets from any matching columns; fallback to description
  const explicitSpecs =
    pick(row, "Bullets", "Specs", "Features", "Key Features", "Highlights") || "";

  const specsBullets = (explicitSpecs ? splitBullets(explicitSpecs) : [])
    .concat(!explicitSpecs && description ? splitBullets(description) : [])
    .filter(Boolean)
    .slice(0, 12);

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
  const mapped = rows.map(mapRow);

  // one console sample to verify bullets are present
  try {
    if (mapped[0]) {
      // eslint-disable-next-line no-console
      console.log("Sample product mapping:", { name: mapped[0].name, code: mapped[0].code, description: mapped[0].description?.slice(0, 120) + "…" });
      // eslint-disable-next-line no-console
      console.log("Sample specsBullets:", mapped[0].specsBullets);
    }
  } catch {}

  return mapped;
}
