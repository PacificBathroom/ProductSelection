// src/lib/specs.ts
import type { Product } from "../types";

/**
 * Put curated bullets here, keyed by PdfKey or Code.
 * Keep the values short, “bullet-sized” strings.
 * Example keys: "BSB-480", "KOR900", "ATBMC"
 */
const SPEC_BULLETS: Record<string, string[]> = {
  // --- examples ---
  "BSB-480": [
    "Vitreous China",
    "480 × 450 mm",
    "Overflow available (various colours)",
    "20-year warranty (porcelain)",
    "2-year labour / valves"
  ],
  "RH5040": [
    "304 Stainless Steel",
    "Single bowl 500 × 400 × 200 mm",
    "Includes basket waste",
    "Suitable for inset installation"
  ],
  // Add more here…
};

/** Normalise keys like "Bsb-480" / " bsb_480 " -> "BSB-480" */
function normKey(s?: string | null): string {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "")
    .trim();
}

/** Return bullets from the repo map (by PdfKey or Code) */
export function bulletsFromRepo(p: Product): string[] {
  const byPdfKey = SPEC_BULLETS[normKey((p as any).pdfKey)];
  const byCode   = SPEC_BULLETS[normKey(p.code)];
  return byPdfKey || byCode ? (byPdfKey || byCode)! : [];
}
