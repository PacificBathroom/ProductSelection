// src/lib/products.ts
import type { Product } from "../types";

// Helper to normalize header names
const norm = (s: string) => s?.toLowerCase().trim();

// Find a column index by any of these header names
function findIdx(headers: string[], aliases: string[]): number {
  const H = headers.map(norm);
  for (const a of aliases.map(norm)) {
    const i = H.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

function col(row: string[], i: number) {
  return i >= 0 ? String(row[i] ?? "").trim() : "";
}

const IMG_REGEX = /https?:\/\/\S+\.(?:png|jpe?g|webp)(?:\?\S+)?/i;

export async function fetchProducts(range: string): Promise<Product[]> {
  // Your existing sheets API. Keep the same endpoint you already use.
  const r = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Sheets fetch failed: ${r.status}`);
  const data = await r.json();

  // Expect data.values = string[][] with first row as headers
  const values: string[][] = data.values ?? data?.data?.values ?? [];
  if (!values.length) return [];

  const headers = values[0] as string[];
  const rows = values.slice(1);

  // Map common header variants
  const iName = findIdx(headers, ["Name", "Product", "Product Name", "Title"]);
  const iCode = findIdx(headers, ["SKU", "Code", "Item Code"]);
  const iCat  = findIdx(headers, ["Category", "Cat"]);
  const iDesc = findIdx(headers, ["Description", "Desc", "Details"]);
  const iImg  = findIdx(headers, [
    "Image Proxied",
    "Image",
    "Image URL",
    "Photo",
    "Picture",
    "Thumbnail",
  ]);
  const iUrl  = findIdx(headers, ["URL", "Link", "Product URL", "Product page"]);
  const iPdf  = findIdx(headers, ["PDF", "Spec", "Spec sheet", "Spec sheet (PDF)", "Spec PDF"]);
  const iSpecs = findIdx(headers, ["Specs", "Specifications", "Features", "Specs bullets"]);

  const products: Product[] = rows.map((row) => {
    const rawName = col(row, iName);
    const code = col(row, iCode);
    const category = col(row, iCat);
    const url = col(row, iUrl);
    const pdfUrl = col(row, iPdf);

    let desc = col(row, iDesc);
    let image = col(row, iImg);

    // If there's no explicit image column, try to pull the first image URL out of description
    if (!image && desc) {
      const m = desc.match(IMG_REGEX);
      if (m) {
        image = m[0];
        // remove the image URL from the visible description
        desc = desc.replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
      }
    }

    // Build bullets
    const specsRaw = col(row, iSpecs);
    const specsBullets =
      specsRaw
        ?.split(/\r?\n|•|\u2022|\||;/)
        .map((s) => s.trim())
        .filter(Boolean) ?? [];

    // Proxy the image for PPTX (and browser if you prefer)
    const imageProxied = image ? `/api/img-proxy?url=${encodeURIComponent(image)}` : undefined;

    return {
      name: rawName || "",            // keep raw label (not URL)
      code,
      category,
      description: desc,
      url,
      pdfUrl,
      image,
      imageProxied,
      specsBullets,
    };
  });

  // Filter out completely empty rows
  return products.filter((p) => p.name || p.code || p.url || p.description);
}
