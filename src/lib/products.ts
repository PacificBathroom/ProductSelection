import type { Product } from "../types";

/** Small helpers */
const clean = (s?: string) => (s ?? "").toString().trim();
const isHttp = (s?: string) => /^https?:\/\//i.test(s ?? "");

/** Turn the free-form “SpecsBullets” cell into an array of bullets */
function parseSpecs(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/\r/g, "\n")
    .split(/\u2022|•|\n|;|,| - |\t/) // handles • bullets, newlines, semicolons, etc.
    .map((s) => clean(s))
    .filter((s) => s.length > 0 && !isHttp(s)) // drop blank bits and stray URLs
    .slice(0, 12); // reasonable cap so slides don’t overflow
}

type SheetResponse = { values: string[][] };

/**
 * Fetch products from our sheet via the existing /api/sheets endpoint.
 * Expects the first row to be headers that match the names in your message.
 */
export async function fetchProducts(range: string): Promise<Product[]> {
  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`);
  if (!res.ok) throw new Error("Failed to fetch sheet rows");
  const data = (await res.json()) as SheetResponse;
  const [header, ...rows] = data.values ?? [];
  if (!header) return [];

  // Build a map like { Name: 4, ImageURL: 5, ... }
  const index: Record<string, number> = {};
  header.forEach((h, i) => (index[clean(h)] = i));
  const cell = (r: string[], key: string) =>
    clean(r[index[key] ?? -1]);

  const products: Product[] = rows.map((r) => {
    const name = cell(r, "Name");
    const code = cell(r, "Code");
    const url = cell(r, "Url");
    const imageUrl = cell(r, "ImageURL") || cell(r, "Image"); // tolerate either
    const description = cell(r, "Description");
    const pdfKey = cell(r, "PdfKey");
    let pdfUrl = cell(r, "PdfURL");

    // Prefer a local spec file if PdfKey exists, otherwise proxy the remote PdfURL
    if (!pdfUrl && pdfKey) pdfUrl = `/specs/${pdfKey}.pdf`;
    if (pdfUrl && isHttp(pdfUrl)) {
      // run through our proxy so CORS/SSL can’t break the PPTX
      pdfUrl = `/api/file-proxy?url=${encodeURIComponent(pdfUrl)}`;
    }

    const imageProxied = imageUrl
      ? `/api/file-proxy?url=${encodeURIComponent(imageUrl)}`
      : undefined;

    return {
      code: code || undefined,
      url: url || undefined,
      name: name || undefined,
      imageUrl: imageUrl || undefined,
      imageProxied,
      description: description || undefined,
      specsBullets: parseSpecs(cell(r, "SpecsBullets")),
      pdfUrl: pdfUrl || undefined,
      category: cell(r, "Category") || undefined,
    } as Product;
  });

  return products;
}
