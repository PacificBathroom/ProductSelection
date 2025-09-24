// src/lib/products.ts
import type { Product } from "../types";
import { proxyUrl } from "./api";

/** Accept URLs that contain ".pdf" anywhere before query/hash (case-insensitive) */
const PDF_REGEX = /\.pdf(?=($|[?#]))/i;

function cleanUrl(s?: string | null): string | null {
  if (!s) return null;
  let u = String(s).trim();
  if (!u) return null;
  // collapse internal whitespace and encode spaces
  u = u.replace(/\s+/g, " ").trim().replace(/ /g, "%20");
  // add https if missing protocol
  if (/^\/\//.test(u)) u = "https:" + u;
  else if (!/^https?:\/\//i.test(u) && /^www\./i.test(u)) u = "https://" + u;
  // otherwise leave as-is
  return u;
}

function normalizePdfUrl(s?: string | null): string | null {
  const u = cleanUrl(s);
  if (!u) return null;
  if (!PDF_REGEX.test(u)) return null; // only treat as PDF if it *looks* like a pdf
  return u;
}

/** case-insensitive header lookup */
function idxOf(headers: string[], name: string): number {
  const n = name.toLowerCase();
  return headers.findIndex(h => h?.toLowerCase() === n);
}

type Row = (string | null | undefined)[];

export async function fetchProducts(range = "Products!A:Z"): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
  const data = await r.json();
  const values: Row[] = data.values ?? [];
  if (values.length < 2) return [];

  const headers = (values[0] as string[]).map(h => (h ?? "").toString().trim());
  const out: Product[] = [];

  // common headers (case-insensitive)
  const hSelect   = idxOf(headers, "Select");
  const hUrl      = idxOf(headers, "Url");
  const hCode     = idxOf(headers, "Code");
  const hName     = idxOf(headers, "Name");
  const hImageURL = idxOf(headers, "ImageURL");
  const hDesc     = idxOf(headers, "Description");
  const hSpecs    = idxOf(headers, "SpecsBullets");
  const hPdf      = idxOf(headers, "PdfURL");
  const hCat      = idxOf(headers, "Category");

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const get = (idx: number) => (idx >= 0 ? String(row[idx] ?? "").trim() : "");

    const url = cleanUrl(get(hUrl)) || undefined;
    const imageUrl = cleanUrl(get(hImageURL)) || undefined;
    const pdfUrl = normalizePdfUrl(get(hPdf)) || undefined;

    // Split specs flexibly:
    // newline / semicolon / bullet dot / pipe / comma / or 2+ spaces
    const rawSpecs = get(hSpecs);
    const specsBullets = rawSpecs
      ? rawSpecs
          .split(/[\r\n;•|,]+|\s{2,}/g)
          .map(s => s.trim())
          .filter(Boolean)
      : [];

    const p: Product = {
      // keep the fields your UI expects
      url,
      code: get(hCode) || undefined,
      name: get(hName) || undefined,
      imageUrl,
      imageProxied: imageUrl ? proxyUrl(imageUrl) : undefined,
      description: get(hDesc) || undefined,
      specsBullets: specsBullets.length ? specsBullets : undefined,
      pdfUrl, // <-- only set when it truly looks like a PDF
      category: get(hCat) || undefined,
    };

    // Optionally filter out completely empty rows (no name & no url & no image)
    if (p.name || p.url || p.imageUrl) out.push(p);
  }

  return out;
}
