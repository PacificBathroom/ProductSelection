// src/lib/specs.ts
import type { Product } from "../types";

// Add any items that don't have SpecsBullets in the sheet
const MAP: Record<string, string[]> = {
  // by SKU/code
  // "PSC-1800": ["Finger-pull doors", "Moisture-resistant finish", "Soft-close runners"],
};
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
export function bulletsFor(p: Product): string[] {
  if (!p) return [];
  // try by code, then by name (normalized)
  const byCode = (p.code || "").trim();
  if (byCode && MAP[byCode]) return MAP[byCode];
/** Normalise keys like "Bsb-480" / " bsb_480 " -> "BSB-480" */
function normKey(s?: string | null): string {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "")
    .trim();
}

export function bulletsFor(p: Product): string[] {
  if (!p) return [];
  // try by code, then by name (normalized)
  const byCode = (p.code || "").trim();
  if (byCode && MAP[byCode]) return MAP[byCode];

  const key = (p.name || "").trim().toLowerCase();
  const found = Object.entries(MAP).find(([k]) => k.toLowerCase() === key);
  return found ? found[1] : [];
}
