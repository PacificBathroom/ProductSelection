import type { Product } from "../types";

type Row = Record<string, string | undefined>;

/** url slug -> Title Case */
function nameFromUrl(u: string): string {
  try {
    const path = decodeURIComponent(new URL(u, "https://x.example").pathname);
    const last = path.split("/").filter(Boolean).pop() || "";
    return last.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
               .replace(/\b\w/g, (m) => m.toUpperCase());
  } catch { return u; }
}

/** parse SpecsBullets from string (pipes/newlines/bullets) or array */
function parseBullets(raw?: string | string[]): string[] {
  if (!raw) return [];
  const s = Array.isArray(raw) ? raw.join("|") : raw;
  return s.split(/\r?\n|[|]/g)
          .map((x) => x.replace(/^[•\-\u2022\s]+/, "").trim())
          .filter(Boolean);
}

const proxied = (url?: string | null) =>
  url ? (/^\/(specs|branding)\//.test(url) ? url
       : `/api/file-proxy?url=${encodeURIComponent(url)}`) : undefined;

const proxiedPdf = (url?: string | null) =>
  url ? (url.startsWith("/specs/") ? url
       : `/api/pdf-proxy?url=${encodeURIComponent(url)}`) : undefined;

export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`Sheets fetch failed (${res.status})`);

  const payload: any = await res.json();

  // Accept multiple response shapes
  let rows: any[] = [];
  if (Array.isArray(payload)) rows = payload;
  else if (Array.isArray(payload?.rows)) rows = payload.rows;
  else if (Array.isArray(payload?.data)) rows = payload.data;
  else if (Array.isArray(payload?.values)) {
    // Google Sheets "values" 2D array -> objects using header row
    const [hdr = [], ...vals] = payload.values;
    rows = vals.map((arr: any[]) =>
      Object.fromEntries(hdr.map((h: string, i: number) => [h, arr[i]]))
    );
  } else {
    throw new Error("Unexpected sheets response shape");
  }

  return rows.map((r: Row): Product => {
    const url = (r.Url || "").trim();
    let name = (r.Name || "").trim();
    if (!name || /^https?:\/\//i.test(name)) name = url ? nameFromUrl(url) : name;

    return {
      code: (r.Code || "").trim(),
      name,
      url: url || undefined,
      imageProxied: proxied((r.ImageURL || "").trim()),
      description: (r.Description || "").trim(),
      specsBullets: parseBullets(r.SpecsBullets),
      pdfUrl: proxiedPdf((r.PdfURL || "").trim()),
      category: (r.Category || "").trim(),
    };
  });
}
