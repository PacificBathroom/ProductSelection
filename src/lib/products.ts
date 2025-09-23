// src/lib/products.ts
import { sheetsUrl, proxyUrl } from "./api";
import type { Product } from "../types";

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// extract URL if cell uses IMAGE("https://...")
const urlFromImageFormula = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
};

const coerceString = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
const coerceImageUrl = (v: unknown) => urlFromImageFormula(v) || coerceString(v);

// split specs text into bullets (lines/semicolons/• bullets)
const splitBullets = (v: unknown): string[] | undefined => {
  const s = coerceString(v);
  if (!s) return undefined;
  return s.split(/\r?\n|;|•/g).map(t => t.trim()).filter(Boolean);
};

// normalized header name -> Product key path
const KEY_MAP: Record<string, string> = {
  select: "select",
  url: "url",
  code: "code",
  name: "name",
  imageurl: "imageUrl",
  description: "description",
  specsbullets: "specsBullets",
  pdfurl: "pdfUrl",
  category: "category",

  contactname: "contact.name",
  contactemail: "contact.email",
  contactphone: "contact.phone",
  contactaddress: "contact.address",
};

function assignPath(obj: any, path: string, value: unknown) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

export async function fetchProducts(range = "Products!A:Z"): Promise<Product[]> {
  const url = `${sheetsUrl}?as=objects&range=${encodeURIComponent(range)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets HTTP ${r.status}`);

  // ✅ define the JSON we use below
  const json = (await r.json()) as { values?: Record<string, unknown>[] };

  // ✅ rows typed; no 'any'
  const rows: Record<string, unknown>[] = json.values ?? [];

  const products: Product[] = rows.map((raw: Record<string, unknown>) => {
    // Build a normalized key view
    const lower: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) lower[norm(k)] = v;

    const out: Product = {};

    for (const [kNorm, v] of Object.entries(lower)) {
      const path = KEY_MAP[kNorm];
      if (!path) continue;

      if (path === "imageUrl") {
        const u = coerceImageUrl(v);
        if (u) {
          out.imageUrl = u;
          out.imageProxied = proxyUrl(u);
        }
        continue;
      }

      if (path === "specsBullets") {
        assignPath(out, path, splitBullets(v));
        continue;
      }

      // string fields (including contact.*)
      assignPath(out, path, coerceString(v));
    }

    return out;
  });

  return products;
}
