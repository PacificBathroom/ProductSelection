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

/** parse SpecsBullets from string (pipes/newlines/•/hyphens) or array */
function parseBullets(raw?: string | string[]): string[] {
  if (!raw) return [];
  const s = Array.isArray(raw) ? raw.join("\n") : String(raw);
  const normalized = s
    .replace(/[\u2022•]\s*/g, "\n")         // "• " -> newline
    .replace(/(?:^|\s)[\-–—]\s+/g, "\n")    // "- " -> newline
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return normalized
    .split(/\n|[|;]+/g)
    .map((x) => x.replace(/^[\u2022•\-–—\s]+/, "").trim())
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

/** one row -> Product */
function normalizeRow(r: Row): Product {
  const url = String(r.Url || "").trim();
  let name = String(r.Name || "").trim();
  if (!name || /^https?:\/\//i.test(name)) name = url ? nameFromUrl(url) : name || "—";

  const pdfKey = String(r.PdfKey || "").trim();
  const pdfUrl =
    String(r.PdfURL || "").trim() ||
    (pdfKey ? `/specs/${pdfKey}.pdf` : "");
  // after you build each `product` from a row:
const anyProd = p as any; // <-- use the variable you actually declared for the product
anyProd.pdfUrl =
  anyProd.pdfUrl ||
  anyProd.specPdf ||
  anyProd.specPDF ||
  anyProd.spec ||
  anyProd.specSheet ||
  anyProd["Spec PDF"] ||
  anyProd["Spec sheet"] ||
  anyProd["Spec sheet (PDF)"] ||
  anyProd["PDF"] ||
  undefined;

anyProd.specPreviewUrl =
  anyProd.specPreviewUrl ||
  anyProd["Spec preview"] ||
  anyProd["Spec Image"] ||
  undefined;


// Optional explicit preview image column
anyProd.specPreviewUrl = anyProd.specPreviewUrl || anyProd["Spec preview"] || anyProd["Spec Image"] || undefined;


  const img = String(r.ImageURL || r.Image || "").trim();

  return {
    code: String(r.Code || "").trim(),
    name,
    url: url || undefined,
    imageUrl: img || undefined,
    imageProxied: proxied(img),
    description: String(r.Description || "").trim(),
    specsBullets: parseBullets(r.SpecsBullets),
    pdfUrl: proxiedPdf(pdfUrl),
    pdfKey,
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
