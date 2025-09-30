// src/lib/products.ts
import type { Product } from "../types";

type Row = Record<string, any>;

/** url slug -> Title Case */
function nameFromUrl(u: string): string {
  try {
    const path = decodeURIComponent(new URL(u, "https://x.example").pathname);
    const last = path.split("/").filter(Boolean).pop() || "";
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  } catch {
    return u || "—";
  }
}

/** parse SpecsBullets from string (pipes/newlines/•/hyphen bullets) or array */
function parseBullets(raw?: string | string[]): string[] {
  if (!raw) return [];
  const s = Array.isArray(raw) ? raw.join("\n") : String(raw);

  // normalize common bullet separators to newlines
  const normalized = s
    .replace(/[\u2022•]\s*/g, "\n")    // "• spec • next" -> newline separated
    .replace(/(?:^|\s)[\-–—]\s+/g, "\n") // "- spec" / "– spec" / "— spec"
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return normalized
    .split(/\n|[|;]+/g)                        // newline / pipe / semicolon
    .map(x => x.replace(/^[\u2022•\-–—\s]+/, "")) // strip bullet glyphs
    .map(x => x.trim())
    .filter(Boolean);
}

const proxied = (url?: string | null) =>
  url
    ? /^\/(specs|branding)\//.test(url)
      ? url
      : `/api/file-proxy?url=${encodeURIComponent(url)}`
    : undefined;

const proxiedPdf = (url?: string | null) =>
  url
    ? url.startsWith("/specs/")
      ? url
      : `/api/pdf-proxy?url=${encodeURIComponent(url)}`
    : undefined;

/** turn one sheets row into our Product shape */
function normalizeRow(r: Row): Product {
  const url = String(r.Url || "").trim();
  let name = String(r.Name || "").trim();
  if (!name || /^https?:\/\//i.test(name)) name = url ? nameFromUrl(url) : name || "—";

  // Prefer explicit PdfURL; otherwise allow PdfKey => /specs/<key>.pdf
  const pdfUrl =
    String(r.PdfURL || "").trim() ||
    (r.PdfKey ? `/specs/${String(r.PdfKey).trim()}.pdf` : "");

  const img = String(r.ImageURL || r.Image || "").trim();

  return {
    code: String(r.Code || "").trim(),
    name,
    url: url || undefined,
    imageProxied: proxied(img),
    description: String(r.Description || "").trim(),
    specsBullets: parseBullets(r.SpecsBullets),
    pdfUrl: proxiedPdf(pdfUrl),
    category: String(r.Category || "").trim(),
  };
}

/** Robustly read either an array or { rows: [...] } or { values: [...] } */
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`sheets ${res.status}`);

  const payload: any = await res.json();

  let rows: Row[] = [];
  if (Array.isArray(payload)) rows = payload as Row[];
  else if (Array.isArray(payload?.rows)) rows = payload.rows as Row[];
  else if (Array.isArray(payload?.data)) rows = payload.data as Row[];
  else if (Array.isArray(payload?.values)) {
    const [hdr = [], ...vals] = payload.values as any[][];
    rows = vals.map((arr) =>
      Object.fromEntries(hdr.map((h: string, i: number) => [h, arr[i]]))
    );
  } else {
    throw new Error("Sheets API did not return rows");
  }

  return rows.map(normalizeRow).filter((p) => p.name || p.code);
}
