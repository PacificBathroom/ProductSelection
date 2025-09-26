// src/lib/products.ts
import type { Product } from "../types";

/* ----------------------- helpers ----------------------- */

function normalizeSpecs(raw?: unknown): string[] {
  let s = String(raw ?? "");

  // unify newlines
  s = s.replace(/\r\n?/g, "\n");

  // turn typical bullet markers into new lines
  s = s
    .replace(/[•▪◦·]/g, "\n")        // bullets to newline
    .replace(/(\n|^)\s*-\s+/g, "\n")  // "- bullet"
    .replace(/(\n|^)\s*–\s+/g, "\n")  // en dash bullet
    .replace(/;/g, "\n");             // semicolons -> newline

  // split, trim, de-dup, drop URLs & empties
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

const PROXY = (rawUrl: string) => `/api/file-proxy?url=${encodeURIComponent(rawUrl)}`;

function extractUrlFromImageFormula(v?: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // Accepts: =IMAGE("https://..."), =image("..."), or plain http(s) URL
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

// case-insensitive header lookup
function indexOfHeader(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function getCell(row: any[], headers: string[], ...names: string[]): unknown {
  const i = indexOfHeader(headers, ...names);
  return i >= 0 ? row[i] : undefined;
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
      // Core fields (support common alias variations)
      const select       = getCell(row, headers, "select");
      const url          = String(getCell(row, headers, "url", "product url", "link") ?? "").trim();
      const code         = String(getCell(row, headers, "code", "sku") ?? "").trim();
      const name         = String(getCell(row, headers, "name", "product name") ?? "").trim();

      const imageRaw     = getCell(row, headers, "imageurl", "image url", "image");
      const imageUrl     = normalizeImageUrl(imageRaw);
      const imageProxied = imageUrl ? PROXY(imageUrl) : undefined;

      const description  = String(getCell(row, headers, "description", "desc") ?? "");
      const specsRaw     = getCell(row, headers, "specsbullets", "specs bullets", "specs", "specification", "specifications");
      const pdfUrlSheet  = String(getCell(row, headers, "pdfurl", "spec sheet url") ?? "").trim();
      const pdfKey       = String(getCell(row, headers, "pdfkey") ?? "").trim();
      const pdfFile      = String(getCell(row, headers, "pdffile") ?? "").trim();
      const category     = String(getCell(row, headers, "category") ?? "").trim();

      // Optional contact fields
      const contactName    = String(getCell(row, headers, "contactname", "prepared by", "sales rep") ?? "").trim();
      const contactEmail   = String(getCell(row, headers, "contactemail", "email") ?? "").trim();
      const contactPhone   = String(getCell(row, headers, "contactphone", "phone", "mobile") ?? "").trim();
      const contactAddress = String(getCell(row, headers, "contactaddress", "address") ?? "").trim();

      const contact =
        contactName || contactEmail || contactPhone || contactAddress
          ? { name: contactName || undefined, email: contactEmail || undefined, phone: contactPhone || undefined, address: contactAddress || undefined }
          : undefined;

      const product: Product = {
        select: typeof select === "string" ? select : String(select ?? ""),
        url,
        code,
        name,
        imageUrl: imageUrl || undefined,
        imageProxied,
        description,
        specsBullets: normalizeSpecs(specsRaw),
        // keep both for compatibility with your types & resolver:
        pdfUrl: pdfUrlSheet || undefined,
        PdfURL: pdfUrlSheet || undefined,
        PdfKey: pdfKey || undefined,
        PdfFile: pdfFile || undefined,
        category,
        contact,
      };

      return product;
    })
    .filter((p) => p.name || p.code || p.url || p.imageUrl);

  return products;
}
