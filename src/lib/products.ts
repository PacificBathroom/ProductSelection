// src/lib/products.ts
import type { Product } from "../types";

type Row = Record<string, string | undefined>;

const IMAGE_KEYS = [
  // common
  "imageProxied","imageUrl","image","img","picture",
  // spaced & camel
  "Image URL","Image Url","Image url","Image 1","Image1","Main Image",
  // concatenated
  "ImageURL","ImageLink","Imagelink","Imagelink",
  // fallbacks
  "Image link","Image Link","Primary Image","Thumbnail","Thumb"
];

/** First non-empty among keys */
const pick = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    if (k in row) {
      const v = row[k];
      if (v != null) {
        const s = String(v).trim();
        if (s) return s;
      }
    }
  }
  return undefined;
};

const splitBullets = (s?: string) =>
  (s ?? "")
    .split(/\r?\n|•|\|/g) // accept pipes too
    .map((x) => x.trim())
    .filter(Boolean);

// --- URL normalisers -------------------------------------------------

function normalizeGithubUrl(u: string) {
  // github.com/user/repo/blob/branch/path.jpg -> raw.githubusercontent.com/user/repo/branch/path.jpg
  const m = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if (!m) return u;
  const [, user, repo, branch, path] = m;
  return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
}

function normalizeDriveUrl(u: string) {
  // Share links -> direct download/view
  // https://drive.google.com/file/d/<ID>/view?usp=sharing  OR open?id=<ID>
  let idMatch = u.match(/\/file\/d\/([^/]+)\//) || u.match(/[?&]id=([^&]+)/);
  if (!idMatch) return u;
  const id = idMatch[1];
  // Use uc?export=download which returns bytes, good for the proxy
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function normalizeUrl(u?: string) {
  if (!u) return undefined;
  let url = u.trim();
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) return undefined;
  if (/github\.com\/.+\/blob\//i.test(url)) url = normalizeGithubUrl(url);
  if (/drive\.google\.com/i.test(url)) url = normalizeDriveUrl(url);
  return url;
}

// --- Sheet payload coercion ------------------------------------------

function valuesToRows(values: string[][]): Row[] {
  const [header = [], ...rest] = values;
  const keys = header.map((h) => String(h || "").trim());
  return rest.map((arr) => {
    const r: Row = {};
    for (let i = 0; i < keys.length; i++) r[keys[i]] = arr[i];
    return r;
  });
}

function coerceRows(payload: any): Row[] {
  if (!payload) return [];
  if (Array.isArray(payload.values) && payload.values.length && typeof payload.values[0] === "object" && !Array.isArray(payload.values[0])) {
    return payload.values as Row[];
  }
  if (Array.isArray(payload.rows) && payload.rows.length && typeof payload.rows[0] === "object") {
    return payload.rows as Row[];
  }
  if (Array.isArray(payload.values) && Array.isArray(payload.values[0])) {
    return valuesToRows(payload.values as string[][]);
  }
  return [];
}

async function fetchSheet(range: string) {
  const qs = `?range=${encodeURIComponent(range)}&as=objects`;
  for (const ep of ["/api/sheet", "/api/sheets"]) {
    try {
      const r = await fetch(`${ep}${qs}`, { cache: "no-store" });
      if (r.ok) return r.json();
    } catch {}
  }
  const r = await fetch(`/api/sheet?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchProducts failed: ${r.status}`);
  return r.json();
}

/**
 * Load products from your sheet-backed API.
 */
export async function fetchProducts(range: string): Promise<Product[]> {
  const payload = await fetchSheet(range);
  const rows = coerceRows(payload);

  const out: Product[] = rows.map((row) => {
    const p: any = {} as Product;

    // core
    p.name        = pick(row, "name","Name","Product","Product Name");
    p.code        = pick(row, "code","Code","SKU","sku","Item Code","Product Code");
    p.description = pick(row, "description","Description","Desc","Blurb");
    p.category    = pick(row, "category","Category","Cat","Collection");

    // images
    const rawImg = pick(row, ...IMAGE_KEYS);
    const normalized = normalizeUrl(rawImg);
    if (normalized) {
      const sameOrigin = normalized.startsWith("/") || /^https?:\/\/[^/]*pacificbathroom/i.test(normalized);
      const proxied = sameOrigin ? normalized : `/api/img?url=${encodeURIComponent(normalized)}`;
      p.imageUrl = normalized;
      p.imageProxied = proxied;
      // single canonical field for the UI:
      (p as any).image = proxied ?? normalized;
    }

    // product page
    p.url = pick(row, "url","URL","Product URL","Link");

    // bullets
    const bulletsRaw = pick(row, "specsBullets","SpecsBullets","Bullets","Features") || "";
    p.specsBullets = splitBullets(bulletsRaw);

    // spec pdf
    p.pdfUrl = pick(row, "pdfUrl","PDF","Spec PDF","Spec sheet","specPdf","specPDF","spec","specSheet");

    // optional preview
    p.specPreviewUrl = pick(row, "specPreviewUrl","Spec preview","Spec Image","Spec Preview URL");

    return p as Product;
  });

  return out;
}