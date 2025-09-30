// src/lib/specs.ts
import type { Product } from "../types";

/**
 * Add any product-specific fallback specs here (by Code preferably).
 * These are only used when the Sheet's `SpecsBullets` is empty.
 *
 * Example:
 *  "ATSMC": [
 *    "Solid brass body",
 *    "WELS 4 Star 7.5L/min",
 *    "PVD Chrome finish",
 *    "35mm ceramic cartridge",
 *  ],
 */
const SPEC_MAP_BY_CODE: Record<string, string[]> = {
  // "YOUR-CODE": ["Bullet 1", "Bullet 2", ...],
};

const SPEC_MAP_BY_NAME: Record<string, string[]> = {
  // Optional name-based fallbacks if you don't have codes:
  // "Example Product Name": ["Bullet 1", "Bullet 2"],
};

function norm(s?: string) {
  return (s || "").trim();
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = typeof v === "string" ? v.trim().toLowerCase() : JSON.stringify(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/**
 * Merge Sheet bullets (if any) with local fallbacks (if any),
 * preferring Sheet bullets. Deduped, trimmed.
 */
export function getMergedSpecs(p: Product): string[] {
  const fromSheet = Array.isArray(p.specsBullets) ? p.specsBullets : [];
  const code = norm(p.code).toUpperCase();
  const name = norm(p.name);

  const fromCode = code ? SPEC_MAP_BY_CODE[code] || [] : [];
  const fromName = name ? SPEC_MAP_BY_NAME[name] || [] : [];

  // Sheet takes priority; if empty, we’ll show fallbacks.
  const merged = fromSheet.length ? fromSheet.concat(fromCode, fromName)
                                  : fromCode.concat(fromName);

  return uniq(
    merged
      .map((x) => String(x || "").replace(/^[•\-\u2022\s]+/, "").trim())
      .filter(Boolean)
  );
}
