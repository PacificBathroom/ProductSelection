// src/lib/urls.ts
export const PROXY = (rawUrl: string) => `/api/file-proxy?url=${encodeURIComponent(rawUrl)}`;

export function extractUrlFromImageFormula(v?: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // Handles =IMAGE("...") and plain urls
  const m = s.match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1] || (s.startsWith("http") ? s : undefined);
}

export function normalizeImageUrl(raw?: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string" && raw.trim().startsWith("http")) return raw.trim();
  return extractUrlFromImageFormula(raw);
}
