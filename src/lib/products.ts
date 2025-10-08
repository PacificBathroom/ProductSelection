// src/lib/products.ts
import type { Product } from "../types";

/* ---------- helpers ---------- */
type Row = Record<string, string | undefined>;

function normalizeRowKeys(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k || "").trim().toLowerCase()] = v;
  }
  return out;
}

const lc = (s?: string) => String(s || "").trim().toLowerCase();

const pickCI = (row: Row, ...keys: string[]) => {
  const r = normalizeRowKeys(row);
  for (const k of keys) {
    const v = r[lc(k)];
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

/** Google Drive share link -> direct-download URL */
function toDirectImageUrl(u?: string) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

/** Find an image URL in ANY column (prefers common headers, then scans) */
function findAnyImageUrl(row: Row): string | undefined {
  const preferred =
    pickCI(
      row,
      "Image",
      "Image URL",
      "ImageUrl",
      "Picture",
      "Photo",
      "Img",
      "Thumbnail",
      "Main Image",
      "Primary Image"
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

/** Heuristic: pick any column that *looks* like a bullets list if named fields are empty */
function autoDetectBullets(row: Row, description?: string): string | undefined {
  let best: { text: string; tokens: number } | null = null;

  const SEP = /\r?\n|•|\u2022|;|,|—|–|-{1,2}/g;

  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    const key = lc(k);
    const val = String(v).trim();
    if (!val) continue;

    // skip obvious non-bullets columns
    if (/(name|title|sku|code|category|url|link|page|pdf|spec|desc|description)/i.test(key)) {
      continue;
    }

    const parts = val.split(SEP).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // don’t choose giant paragraphs; prefer list-y text
      const avgLen = parts.join(" ").length / parts.length;
      if (avgLen >= 2 && avgLen <= 120) {
        if (!best || parts.length > best.tokens) {
          best = { text: val, tokens: parts.length };
        }
      }
    }
  }

  // fallback: try to extract bullets from description itself (multi-line or bullet characters)
  if (!best && description) {
    const parts = description
      .split(/\r?\n|•|\u2022|;|,|—|–|-{1,2}/g)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      best = { text: parts.join("\n"), tokens: parts.length };
    }
  }

  return best?.text;
}

/** Map a sheet row to our Product shape */
function mapRow(row: Row): Product {
  const name = pickCI(row, "Name", "Product", "Title");
  const code = pickCI(row, "SKU", "Code", "Item Code", "Product Code");
  const description = pickCI(row, "Description", "Desc", "Blurb", "Long Description");
  const category = pickCI(row, "Category", "Categories");
  const url = pickCI(row, "URL", "Link", "Page", "Product Page", "Website");
  const pdfUrl = pickCI(
    row,
    "PDF",
    "Spec",
    "Spec URL",
    "Spec Sheet",
    "Spec sheet",
    "Spec sheet (PDF)",
    "Specifications",
    "Specification",
    "Specs PDF",
    "Datasheet",
    "Data Sheet"
  );

  // Image handling
  const rawImg = findAnyImageUrl(row);
  const direct = toDirectImageUrl(rawImg);
  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;

  // Specs / bullets: accept many headers; fallback to auto-detect
  const bulletsRaw =
    pickCI(
      row,
      "Bullets",
      "Bullet Points",
      "Specs",
      "Specifications",
      "Features",
      "Feature Bullets",
      "Key Features",
      "Highlights",
      "Selling Points",
      "Benefits",
      "Key Points"
    ) || autoDetectBullets(row, description) || "";

  const specsBullets = bulletsRaw
    .split(/\r?\n|•|\u2022|;|,|—|–|-{1,2}/g)
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
