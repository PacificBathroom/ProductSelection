// src/lib/specs.ts
import type { Product } from "../types";

const has = (v?: unknown) => typeof v === "string" && v.trim().length > 0;

/**
 * Resolve a spec PDF URL for a product using (in order):
 *   1) PdfFile  -> /specs/<PdfFile>
 *   2) PdfKey   -> /specs/<PdfKey>.pdf
 *   3) Code     -> /specs/<Code>.pdf
 *   4) PdfURL   -> (external) use as-is or via proxy if you use one
 *
 * Put PDFs in /public/specs in your repo so they deploy to /specs/...
 */
export function resolvePdfUrl(p: Product, opts?: { proxy?: (u: string) => string }): string | undefined {
  // 1) Explicit file name
  const pdfFile = (p as any).PdfFile;
  if (has(pdfFile)) return `/specs/${String(pdfFile).trim()}`;

  // 2) PdfKey + .pdf
  const pdfKey = (p as any).PdfKey;
  if (has(pdfKey)) return `/specs/${String(pdfKey).trim()}.pdf`;

  // 3) Fall back to Code
  if (has(p.Code)) return `/specs/${String(p.Code).trim()}.pdf`;

  // 4) External URL fallback (least preferred)
  if (has(p.PdfURL)) {
    const raw = String(p.PdfURL).trim();
    // If you have a Netlify/Vercel proxy function, wrap external links:
    return opts?.proxy ? opts.proxy(raw) : raw;
  }

  return undefined;
}

/**
 * Optional: sanity check in dev—logs if a local /specs file is likely missing.
 * Call this only on local /specs/* paths (not for proxied externals).
 */
export async function warnIfMissingLocalSpec(url: string) {
  if (!url.startsWith("/specs/")) return;
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!r.ok) console.warn(`[specs] Missing PDF at ${url}`);
  } catch {
    console.warn(`[specs] Could not verify PDF at ${url}`);
  }
}
