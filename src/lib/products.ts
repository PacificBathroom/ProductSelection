// src/lib/products.ts
import type { Product } from "../types";

/* ----------------------- helpers ----------------------- */

// Normalize "Contact Name" => "contactname", "Pdf Key" => "pdfkey", etc.
function normHeader(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Case/punctuation-insensitive header lookup
function indexOfHeader(headers: string[], ...candidates: string[]): number {
  const normed = headers.map(normHeader);
  for (const c of candidates) {
    const t = normHeader(c);
    const i = normed.indexOf(t);
    if (i >= 0) return i;
  }
  return -1;
}

function getCell(row: any[], headers: string[], ...names: string[]): unknown {
  const i = indexOfHeader(headers, ...names);
  return i >= 0 ? row[i] : undefined;
}

const PROXY = (rawUrl: string) => `/api/file-proxy?url=${encodeURIComponent(rawUrl)}`;

function extractUrlFromImageFormula(v?: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // Accept: =IMAGE("https://...") or plain http(s) URL
  const m = s.match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  if (m?.[1]) return m[1];
  if (/^https?:\/\//i.test(s)) return s;
  return undefined;
}

function normalizeImageUrl(raw?: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string" && raw.trim().startsWith("http")) return raw.trim();
  return extractUrlFromImageFormula(raw);
}

function normalizeSpecs(raw?: unknown): string[] {
  let s = String(raw ?? "");

  // unify newlines
  s = s.replace(/\r\n?/g, "\n");

  // typical bullet markers -> new lines
  s = s
    .replace(/[•▪◦·]/g, "\n")
    .replace(/(\n|^)\s*-\s+/g, "\n")  // "- "
    .replace(/(\n|^)\s*–\s+/g, "\n")  // en dash
    .replace(/\|/g, "\n")             // pipes
    .replace(/;/g, "\n");             // semicolons

  // split, trim, dedupe, drop URLs/empties
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/* ----------------------- main ----------------------- */

export async function fetchProducts(range: string): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets ${r.status}`);
  const data = await r.json();

  const rows: any[][] = data.values ?? [];
  if (!rows.length) return [];

  const headers = (rows[0] ?? []).map((h: any) => String(h ?? ""));
  const body = rows.slice(1);

  const products: Product[] = body
    .map((row) => {
      // Core fields (support common variations)
      const select       = getCell(row, headers, "Select");
      const url          = String(getCell(row, headers, "Url", "Product Url", "Link") ?? "").trim();
      const code         = String(getCell(row, headers, "Code", "SKU") ?? "").trim();
      const name         = String(getCell(row, headers, "Name", "Product Name") ?? "").trim();

      const imageRaw     = getCell(row, headers, "ImageURL", "Image Url", "Image");
      const imageUrl     = normalizeImageUrl(imageRaw);
      const imageProxied = imageUrl ? PROXY(imageUrl) : undefined;

      const description  = String(getCell(row, headers, "Description", "Desc") ?? "");
      const specsRaw     = getCell(row, headers, "SpecsBullets", "Specs Bullets", "Specs", "Specification", "Specifications");
      const pdfUrlSheet  = String(getCell(row, headers, "PdfURL", "PDF URL", "Spec Sheet URL") ?? "").trim();
      const pdfKey       = String(getCell(row, headers, "PdfKey", "PDF Key") ?? "").trim();
      const pdfFile      = String(getCell(row, headers, "PdfFile", "PDF File") ?? "").trim();
      const category     = String(getCell(row, headers, "Category") ?? "").trim();

      // Optional contact fields (used as exporter fallback for cover)
      const contactName    = String(getCell(row, headers, "Contact Name", "Prepared By", "Sales Rep") ?? "").trim();
      const contactEmail   = String(getCell(row, headers, "Contact Email", "Email") ?? "").trim();
      const contactPhone   = String(getCell(row, headers, "Contact Phone", "Phone", "Mobile") ?? "").trim();
      const contactAddress = String(getCell(row, headers, "Contact Address", "Address") ?? "").trim();

      const contact =
        contactName || contactEmail || contactPhone || contactAddress
          ? { name: contactName || undefined, email: contactEmail || undefined, phone: contactPhone || undefined, address: contactAddress || undefined }
          : undefined;

      const product: Product = {
        // selection & identity
        select: typeof select === "string" ? select : String(select ?? ""),
        url,
        code,
        name,

        // images
        imageUrl: imageUrl || undefined,
        imageProxied,

        // content
        description,
        specsBullets: normalizeSpecs(specsRaw),

        // PDFs (multiple ways)
        pdfUrl: pdfUrlSheet || undefined, // your original field
        PdfURL: pdfUrlSheet || undefined, // keep PascalCase variant too
        PdfKey: pdfKey || undefined,
        PdfFile: pdfFile || undefined,

        // categorisation
        category,

        // contact bundle (optional)
        contact,
      };

      return product;
    })
    // keep rows that have *some* useful content
    .filter((p) => p.name || p.code || p.url || p.imageUrl);

  return products;
}
