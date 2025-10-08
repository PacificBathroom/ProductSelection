import type { Product } from "../types";

/* ---------- helpers ---------- */
type Row = Record<string, string | undefined>;

const lc = (s?: string) => String(s || "").trim().toLowerCase();

/** Choose a header row robustly (skip intro/blank rows). */
function pickHeaderAndRows(values: string[][]): { header: string[]; body: string[][] } {
  // Heuristic: pick the first row among the first 3 that has >= 4 non-empty cells
  const candidates = values.slice(0, 3);
  let headerIdx = 0;
  let maxNonEmpty = -1;
  candidates.forEach((r, i) => {
    const nonEmpty = r.filter((c) => String(c || "").trim() !== "").length;
    if (nonEmpty > maxNonEmpty) {
      maxNonEmpty = nonEmpty;
      headerIdx = i;
    }
  });
  const header = (values[headerIdx] || []).map((h) => String(h || "").trim());
  const body = values.slice(headerIdx + 1);
  return { header, body };
}

function valuesToRows(values: string[][]): Row[] {
  const { header, body } = pickHeaderAndRows(values);
  return (body ?? []).map((arr) => {
    const r: Row = {};
    for (let i = 0; i < header.length; i++) r[header[i]] = arr[i];
    return r;
  });
}

function normalizeRow(row: Row): Record<string, string | undefined> {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[lc(k)] = v;
  return out;
}

function pickCI(row: Row, ...keys: string[]) {
  const r = normalizeRow(row);
  for (const k of keys) {
    const v = r[lc(k)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

/** Google Drive share -> direct-download URL */
function toDirectImageUrl(u?: string) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

/** Find an image URL in ANY column */
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

/** Split possible list text into bullets (handles pipes / slashes too) */
function splitBullets(s: string): string[] {
  return s
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map((t) => t.replace(/^[•\u2022\-–—]\s*/, "").trim())
    .filter(Boolean);
}

/** Collect bullets from a single rich text column */
function bulletsFromSingleColumns(row: Row): string[] {
  const raw =
    pickCI(
      row,
      "Bullets",
      "Bullet Points",
      "Bulletpoints",
      "Specs",
      "Specifications",
      "Specification",
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

/** Collect bullets from numbered columns (Spec 1.., Feature 2.. etc.) */
function bulletsFromNumberedColumns(row: Row): string[] {
  const r = normalizeRow(row);
  const vals: string[] = [];
  const prefixes = [
    "spec","specs","specification","specifications",
    "feature","features",
    "bullet","bullets",
    "point","points",
    "highlight","highlights",
    "detail","details",
    "benefit","benefits",
    "item","items"
  ];
  for (const [key, val] of Object.entries(r)) {
    if (!val) continue;
    const k = key.toLowerCase();
    const hasPrefix = prefixes.some((p) => k.startsWith(p));
    const hasOrdinal = /\b(\d{1,2}|[a-z])\b/.test(k);
    if (hasPrefix && hasOrdinal) {
      const t = String(val).trim();
      if (t) vals.push(t);
    }
  }
  return vals;
}

/** Fuzzy: ANY column whose header includes spec/feature/bullet/etc. */
function bulletsFromFuzzyColumns(row: Row): string[] {
  const r = normalizeRow(row);
  const vals: string[] = [];
  const fuzzy = /(spec|feature|bullet|point|highlight|detail|benefit)/i;
  for (const [key, val] of Object.entries(r)) {
    if (!val) continue;
    const k = key.toLowerCase();
    if (/(image|url|link|page|pdf|code|sku|name|title|category|desc|description)/i.test(k)) continue;
    if (fuzzy.test(k)) vals.push(String(val));
  }
  return vals.flatMap(splitBullets);
}

/** Very aggressive fallback: scan all non-obvious columns and carve a list */
function bulletsFromAnyUsefulColumn(row: Row, description?: string): string[] {
  const r = normalizeRow(row);
  const vals: string[] = [];
  for (const [key, val] of Object.entries(r)) {
    if (!val) continue;
    const k = key.toLowerCase();
    if (/(image|url|link|page|pdf|code|sku|name|title|category)/i.test(k)) continue;
    // allow description to be used as a last resort; prioritize other fields first
    if (/^desc(ription)?$/.test(k)) continue;
    const parts = splitBullets(String(val));
    if (parts.length) vals.push(...parts);
  }
  if (vals.length) return vals;
  if (description) return splitBullets(description);
  return [];
}

/** Map a sheet row to Product (with debug metadata) */
function mapRow(row: Row): Product & {
  __debugSpecSource?: string;
  __debugSpecCount?: number;
} {
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

  // Bullets: merge every source (ordered by precision)
  const bulletsNum    = bulletsFromNumberedColumns(row);       // Spec 1, Feature 2, ...
  const bulletsSingle = bulletsFromSingleColumns(row);          // "Features", "Highlights", ...
  const bulletsFuzzy  = bulletsFromFuzzyColumns(row);           // any header containing spec/feature/...
  const bulletsAny    = bulletsFromAnyUsefulColumn(row, description); // last resort across all

  let specsBullets = [...bulletsNum, ...bulletsSingle, ...bulletsFuzzy, ...bulletsAny]
    .map((b) => b.trim())
    .filter(Boolean);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  specsBullets = specsBullets.filter((b) => {
    const key = b.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let __debugSpecSource = "";
  if (bulletsNum.length)    __debugSpecSource += "[numbered]";
  if (bulletsSingle.length) __debugSpecSource += "[single]";
  if (bulletsFuzzy.length)  __debugSpecSource += "[fuzzy]";
  if (bulletsAny.length)    __debugSpecSource += "[any]";
  if (!__debugSpecSource)   __debugSpecSource  = "[none]";

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
    __debugSpecSource,
    __debugSpecCount: specsBullets.length,
  } as any;
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
