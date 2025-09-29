// src/lib/products.ts
import type { Product } from "../types";

type Row = Record<string, string | undefined>;

/** Turn "/product/1500mm-waterproof-shaving-cabinet/" -> "1500mm Waterproof Shaving Cabinet" */
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
    return u;
  }
}

/** Split the SpecsBullets column into an array no matter how it’s typed */
function parseBullets(raw?: string): string[] {
  if (!raw) return [];
  // remove leading bullet chars and split on pipes or newlines
  return raw
    .split(/\r?\n|[|]/g)
    .map((s) => s.replace(/^[•\-\u2022\s]+/, "").trim())
    .filter(Boolean);
}

function proxied(url?: string | null): string | undefined {
  if (!url) return;
  // If it’s already a local file (e.g. /specs/X.pdf), leave it.
  if (/^\/(specs|branding)\//.test(url)) return url;
  return `/api/file-proxy?url=${encodeURIComponent(url)}`;
}

function proxiedPdf(url?: string | null): string | undefined {
  if (!url) return;
  if (url.startsWith("/specs/")) return url; // local file we ship
  return `/api/pdf-proxy?url=${encodeURIComponent(url)}`;
}

export async function fetchProducts(_range: string): Promise<Product[]> {
  // You already had this wired to Google Sheets; keep your fetch as-is and
  // call the mapper below for each row object.
  const res = await fetch("/api/sheets?range=Products!A:Z");
  if (!res.ok) throw new Error("Sheets fetch failed");
  const rows: Row[] = await res.json();

  return rows.map((r): Product => {
    // Sheet headings you confirmed:
    // Select, Code, PdfKey, Url, Name, ImageURL, Description, SpecsBullets, PdfURL, ... , Category
    const url = (r.Url || "").trim();
    let name = (r.Name || "").trim();

    // If Name cell is actually a URL, fix it
    if (!name || /^https?:\/\//i.test(name)) {
      if (url) name = nameFromUrl(url);
    }

    const imageUrl = (r.ImageURL || "").trim();
    const pdfUrl = (r.PdfURL || "").trim();

    const specsBullets = parseBullets(r.SpecsBullets);

    return {
      code: (r.Code || "").trim(),
      name,
      url: url || undefined,
      imageProxied: proxied(imageUrl),
      description: (r.Description || "").trim(),
      specsBullets,
      pdfUrl: proxiedPdf(pdfUrl),
      category: (r.Category || "").trim(),
    };
  });
}
