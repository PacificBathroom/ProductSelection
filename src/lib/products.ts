// src/lib/products.ts
import type { Product } from "../types";

/* ---------- helpers ---------- */
type Row = Record<string, string | undefined>;

const lc = (s?: string) => String(s || "").trim().toLowerCase();

function normalizeRow(row: Row): Record<string, string | undefined> {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[lc(k)] = v;
  return out;
}

function valuesToRows(values: string[][]): Row[] {
  const [header, ...rest] = values;
  const keys = (header ?? []).map((h) => String(h || "").trim());
  return (rest ?? []).map((arr) => {
    const r: Row = {};
    for (let i = 0; i < keys.length; i++) r[keys[i]] = arr[i];
    return r;
  });
}

function pickCI(row: Row, ...keys: string[]) {
  const r = normalizeRow(row);
  for (const k of keys) {
    const v = r[lc(k)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
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
  const r = normalizeRow(row);
  const preferredKeys = [
    "image","image url","imageurl","picture","photo","img","thumbnail","main image","primary image"
  ];

  for (const k of preferredKeys) {
    const v = r[k];
    if (v && String(v).trim()) return String(v).trim();
  }

  const looksUrl = (s: string) => /^https?:\/\//i.test(s) || s.startsWith("/");
  const looksImage = (s: string) =>
    /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(s) ||
    /drive\.google\.com\/file\/d\//i.test(s) ||
    /wp-content|cloudfront|cdn|images|branding/i.test(s);

  for (const v of Object.values(r)) {
    const s = String(v || "").trim();
    if (!s) continue;
    if (looksUrl(s) && looksImage(s)) return s;
  }
  return undefined;
}

/** Split a list-like string into bullets */
function splitBullets(s: string): string[] {
  return s
    .split(/\r?\n|•|\u2022|;|,|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map((t) => t.replace(/^[•\u2022\-–—]\s*/, "").trim())
    .filter(Boolean);
}

/** Pull bullets from common single text columns */
function bulletsFromSingleColumns(row: Row): string[] {
  const raw =
    pickCI(
      row,
      "Bullets",
      "Bullet Points",
      "Bulletpoints",
      "Specs",
      "Specifications",
      "Features",
      "Feature Bullets",
      "Key Features",
      "Highlights",
      "Selling Points",
      "Benefits",
      "Key Points",
      "Notes"
    ) || "";
  return splitBullets(raw);
}

/** Pull bullets from multiple numbered columns (Spec 1..20, Feature 1..20, Bullet 1..20) */
function bulletsFromNumberedColumns(row: Row): string[] {
  const r = normalizeRow(row);
  const vals: string[] = [];
  const prefixes = ["spec", "feature", "bullet", "point", "highlight"];

  for (const [key, val] of Object.entries(r)) {
    if (!val) continue;
    // match things like "spec", "spec 1", "feature 12", "bullet_3"
    if (prefixes.some((p) => new RegExp(`^${p}(\\s*[_-]?\\s*\\d+)?$`, "i").test(key))) {
      const t = String(val).trim();
      if (t) vals.push(t);
    }
  }
  return vals;
}

/** Heuristic: If nothing else, pick a column that looks list-like */
function bulletsAutoDetect(row: Row, description?: string): string[] {
  const r = normalizeRow(row);
  let best: string[] = [];

  for (const [key, val] of Object.entries(r)) {
    if (!val) continue;
    // Skip obvious non-list fields
    if (/(name|title|sku|code|category|url|link|page|pdf|spec url|desc|description|image)/i.test(key)) {
      continue;
    }
    const parts = splitBullets(String(val));
    // choose the column with the most "list-ish" tokens
    if (parts.length >= 2 && parts.length > best.length) best = parts;
  }

  if (best.length) return best;

  // fallback: try description
  if (description) {
    const parts = splitBullets(description);
    if (parts.length >= 2) return parts;
  }
  return [];
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

  // Images
  const rawImg = findAnyImageUrl(row);
  const direct = toDirectImageUrl(rawImg);
  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;

  // Bullets (merge all sources; keep order: numbered > single > autodetect)
  const bulletsNum = bulletsFromNumberedColumns(row);
  const bulletsSingle = bulletsFromSingleColumns(row);
  const bulletsAuto = bulletsAutoDetect(row, description);

  const specsBullets = [...bulletsNum, ...bulletsSingle, ...bulletsAuto]
    .map((b) => b.trim())
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
