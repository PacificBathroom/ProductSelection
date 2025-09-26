// src/lib/products.ts
import type { Product } from "../types";

function normalizeSpecs(raw?: string): string[] {
  let s = (raw ?? "").toString();

  // unify newlines
  s = s.replace(/\r\n?/g, "\n");

  // turn typical bullet markers into new lines
  s = s
    .replace(/[•▪◦·]/g, "\n") // bullets to newline
    .replace(/(\n|^)\s*-\s+/g, "\n") // "- bullet"
    .replace(/(\n|^)\s*–\s+/g, "\n") // en dash bullet
    .replace(/;/g, "\n"); // semicolons to newline

  // split, trim, de-dup, drop URLs and empties
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of s.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export async function fetchProducts(range: string): Promise<Product[]> {
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Sheets ${r.status}`);
  const data = await r.json();

  const rows: any[][] = data.values ?? [];
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => (h ?? "").toString().trim().toLowerCase());

  function col(name: string, alts: string[] = []): number {
    const names = [name, ...alts].map((n) => n.toLowerCase());
    return header.findIndex((h) => names.includes(h));
  }

  const idx = {
    url: col("url"),
    code: col("code", ["sku", "product code"]),
    name: col("name", ["product name"]),
    imageUrl: col("imageurl", ["image"]),
    description: col("description", ["desc"]),
    specs: col("specsbullets", ["specifications", "specs"]),
    pdfUrl: col("pdfurl", ["spec sheet url", "pdf"]),
    pdfFile: col("pdffile"),
    pdfKey: col("pdfkey"),
    contactName: col("contactname", ["prepared by", "sales rep"]),
    contactEmail: col("contactemail", ["email"]),
    contactPhone: col("contactphone", ["phone", "mobile"]),
    contactAddress: col("contactaddress", ["address"]),
    category: col("category"),
  };

  const products: Product[] = rows.slice(1).map((raw) => {
    const url = idx.url >= 0 ? (raw[idx.url] ?? "").toString().trim() : "";
    const code = idx.code >= 0 ? (raw[idx.code] ?? "").toString().trim() : "";
    const name = idx.name >= 0 ? (raw[idx.name] ?? "").toString().trim() : "";
    const imageUrl = idx.imageUrl >= 0 ? (raw[idx.imageUrl] ?? "").toString().trim() : "";
    const description = idx.description >= 0 ? (raw[idx.description] ?? "").toString() : "";
    const specsRaw = idx.specs >= 0 ? (raw[idx.specs] ?? "").toString() : "";
    const pdfUrl = idx.pdfUrl >= 0 ? (raw[idx.pdfUrl] ?? "").toString().trim() : "";
    const category = idx.category >= 0 ? (raw[idx.category] ?? "").toString().trim() : "";

    const pdfFile = idx.pdfFile >= 0 ? (raw[idx.pdfFile] ?? "").toString().trim() : "";
    const pdfKey = idx.pdfKey >= 0 ? (raw[idx.pdfKey] ?? "").toString().trim() : "";

    const contact = {
      name: idx.contactName >= 0 ? (raw[idx.contactName] ?? "").toString().trim() : "",
      email: idx.contactEmail >= 0 ? (raw[idx.contactEmail] ?? "").toString().trim() : "",
      phone: idx.contactPhone >= 0 ? (raw[idx.contactPhone] ?? "").toString().trim() : "",
      address: idx.contactAddress >= 0 ? (raw[idx.contactAddress] ?? "").toString().trim() : "",
    };

    // use file-proxy for images to avoid CORS
    const imageProxied = imageUrl ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}` : "";

    return {
      url,
      code,
      name,
      imageUrl,
      imageProxied,
      description,
      specsBullets: normalizeSpecs(specsRaw),
      pdfUrl,
      category,
      PdfFile: pdfFile,
      PdfKey: pdfKey,
      contact,
    } as Product;
  });

  return products.filter((p) => p.name || p.code || p.url || p.imageUrl);
}
