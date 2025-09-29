// src/lib/products.ts
import type { Product } from "../types";

// fetch rows from the Sheets proxy (unchanged)
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error(`sheets ${res.status}`);
  const rows: Record<string, string>[] = await res.json();
  return rows.map(normalizeRow).filter(p => p.name || p.code);
}

// --- helpers ---------------------------------------------------------------

function pick(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (k in row && row[k] != null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
    const low = k.toLowerCase();
    for (const kk of Object.keys(row)) {
      if (kk.trim().toLowerCase() === low) {
        const v = row[kk];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return "";
}

function splitBullets(s: string) {
  if (!s) return [];
  return s
    .split(/\r?\n|;|•|–|—|(?:^|[\s])-(?=\s)/g)
    .map(t => t.replace(/^[\s•–—-]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

// --- row → Product ---------------------------------------------------------

function normalizeRow(row: Record<string, any>): Product {
  const name        = pick(row, ["Name", "Product name", "Title"]);
  const code        = pick(row, ["Code", "SKU"]);
  const description = pick(row, ["Description", "Desc", "Details"]);
  const category    = pick(row, ["Category", "Cat"]);
  const url         = pick(row, ["Url", "URL", "Link"]);

  // your exact columns
  const imageUrl    = pick(row, ["ImageURL", "Image Url", "Image", "Photo", "Picture"]);
  const pdfUrlRaw   = pick(row, ["PdfURL", "PDFURL", "Pdf Url", "PDF"]);
  const pdfKey      = pick(row, ["PdfKey", "PDFKey", "PDF Key"]);

  // specs: use your SpecsBullets first
  const specsRaw      = pick(row, ["SpecsBullets", "Specs", "Specifications"]);
  const specsBullets  = splitBullets(specsRaw);

  // final PDF URL: prefer PdfURL; if blank but PdfKey present, point to local /public/specs/<key>.pdf
  const pdfUrl = pdfUrlRaw || (pdfKey ? `/specs/${pdfKey}.pdf` : "");

  // build proxied image URL so CORS/mime is safe
  const imageProxied = imageUrl
    ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}`
    : undefined;

  return {
    name,
    code,
    description,
    category,
    url,
    pdfUrl,
    image: imageUrl,
    imageProxied,
    specsBullets,
  } as Product;
}
