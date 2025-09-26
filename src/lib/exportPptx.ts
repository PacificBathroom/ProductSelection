// src/lib/exportPptx.ts
import type { Product } from "../types";

// Slide size for 16:9 in pptxgenjs (inches)
const FULL_W = 10;
const FULL_H = 5.625;

// Public asset paths (these files must be in /public/branding/)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// --- small helpers ---
function clean(s?: string | null): string { return (s ?? "").trim(); }
function title(s?: string) { return clean(s) || "—"; }
function bullets(arr?: string[] | null): string[] {
  if (!arr || !arr.length) return [];
  return arr.map((x) => clean(x)).filter((x) => !!x);
}
function has(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(String(r.result)); r.readAsDataURL(b); });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

// Convert local path (/specs/xyz.pdf) to absolute URL for PPT hyperlinks
function absoluteUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    if (u.startsWith("/")) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return origin ? new URL(u, origin).href : u;
    }
    return u;
  } catch { return u; }
}

// Normalize common Google Drive “view” links to direct-download
function normalizeDrive(u: string): string {
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
  return u;
}

/**
 * Resolve a spec PDF URL for a product using (in order):
 *   1) PdfFile  -> /specs/<PdfFile>
 *   2) PdfKey   -> /specs/<PdfKey>.pdf
 *   3) Code     -> /specs/<Code>.pdf
 *   4) PdfURL / pdfUrl (external; Drive links normalized)
 *
 * Put PDFs in /public/specs so they deploy to /specs/...
 */
function resolvePdfUrlRaw(p: Product): { url?: string; source?: "PdfFile"|"PdfKey"|"Code"|"PdfURL"|"pdfUrl" } {
  const anyp = p as any;
  if (has(anyp.PdfFile)) return { url: `/specs/${anyp.PdfFile.trim()}`, source: "PdfFile" };
  if (has(anyp.PdfKey))  return { url: `/specs/${anyp.PdfKey.trim()}.pdf`, source: "PdfKey" };
  if (has(p.code))       return { url: `/specs/${p.code.trim()}.pdf`, source: "Code" };
  if (has(anyp.PdfURL))  return { url: normalizeDrive(String(anyp.PdfURL).trim()), source: "PdfURL" };
  if (has(p.pdfUrl))     return { url: normalizeDrive(p.pdfUrl.trim()), source: "pdfUrl" };
  return { url: undefined, source: undefined };
}
function resolvePdfUrlAbsolute(p: Product): { url?: string; source?: string } {
  const { url, source } = resolvePdfUrlRaw(p);
  return { url: absoluteUrl(url), source };
}

/** Optional: warn in dev if a local /specs file looks missing (uses absolute URL) */
async function warnIfMissingLocalSpec(url: string) {
  if (!url.includes("/specs/")) return;
  const abs = absoluteUrl(url) || url;
  try {
    const r = await fetch(abs, { method: "HEAD", cache: "no-store" });
    if (!r.ok) console.warn(`[specs] Missing PDF at ${abs}`);
  } catch {
    console.warn(`[specs] Could not verify PDF at ${abs}`);
  }
}

type ExportInput = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
  date: string;
  items: Product[];
};

// If cover contact fields are blank in the input, pull from the first product that has contact info.
function getCoverContactFallback(input: ExportInput) {
  const firstWithContact = input.items.find(p => (p as any).contact && (
    (p as any).contact.name || (p as any).contact.email || (p as any).contact.phone || (p as any).contact.address
  )) as any;

  const c = firstWithContact?.contact || {};
  return {
    name:  has(input.contactName) ? input.contactName : (c.name  || ""),
    email: has(input.email)       ? input.email       : (c.email || ""),
    phone: has(input.phone)       ? input.phone       : (c.phone || ""),
    addr:  has(input.address)     ? input.address     : (c.address || ""),
  };
}

export async function exportPptx({
  projectName, 
  clientName, 
  contactName, 
  email, 
  phone, 
  address, 
  date, 
  items
}: ExportInput) { ... }


  // Resolve cover contact fields with fallback
  const cover = getCoverContactFallback(input);

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ------------- COVER 1 (project + client) -------------
  try {
    const img1 = await urlToDataUrl(COVER_URLS[0]);
    const s = pptx.addSlide();
    s.addImage({ data: img1, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    s.addText(
      [
        { text: title(projectName), options: { fontSize: 30, bold: true } },
        { text: has(clientName) ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
      ],
      { x: 0.6, y: 4.2, w: 8.8, h: 1.1, color: "000000", align: "left" }
    );
  } catch {}

  // ------------- COVER 2 (rest of the info) -------------
  try {
    const img2 = await urlToDataUrl(COVER_URLS[1]);
    const s = pptx.addSlide();
    s.addImage({ data: img2, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

    const lines = [
      has(cover.name) ? `Prepared by: ${cover.name}` : "",
      has(cover.email) ? `Email: ${cover.email}` : "",
      has(cover.phone) ? `Phone: ${cover.phone}` : "",
      has(cover.addr)  ? `Address: ${cover.addr}` : "",
      has(date) ? `Date: ${date}` : "",
    ].filter(Boolean).join("\n");

    if (lines) {
      s.addText(lines, { x: 0.6, y: 4.2, w: 8.8, h: 1.2, fontSize: 18, color: "000000", align: "left" });
    }
  } catch {}

  // ------------- PRODUCT SLIDES -------------
  for (const p of items) {
    // --- Slide A: Main product card ---
    const sA = pptx.addSlide();

    // Left: product image (contained in a box)
    try {
      const imgSrc = (p as any).imageProxied || (p as any).imageUrl;
      if (imgSrc) {
        const dataUrl = await urlToDataUrl(imgSrc);
        sA.addImage({ data: dataUrl, x: 0.5, y: 0.7, w: 5.6, h: 4.2, sizing: { type: "contain", w: 5.6, h: 4.2 } } as any);
      }
    } catch {}

    // Right: name + SKU + description + links
    const rightX = 6.2;
    sA.addText(title((p as any).name), { x: rightX, y: 0.7, w: 6.2, h: 0.6, fontSize: 22, bold: true });

    if (has(p.code)) {
      sA.addText(`SKU: ${p.code}`, { x: rightX, y: 1.3, w: 6.2, h: 0.35, fontSize: 12 });
    }

    const desc = clean((p as any).description);
    if (desc) {
      sA.addText(desc, { x: rightX, y: 1.7, w: 6.2, h: 1.0, fontSize: 12 });
    }

    // Links on main slide (product page + spec link if desired)
    let linkY = 3.0;
    if (has((p as any).url)) {
      sA.addText("Product page", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: absoluteUrl((p as any).url)! }
      });
      linkY += 0.4;
    }

    const { url: pdfAbs, source } = resolvePdfUrlAbsolute(p);
    if (pdfAbs) {
      console.debug("[pptx] PDF resolved from", source, "→", pdfAbs);
      sA.addText("Spec sheet (PDF)", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: pdfAbs }
      });
      // Optional dev warning for missing local files
      const raw = resolvePdfUrlRaw(p).url;
      if (raw) warnIfMissingLocalSpec(raw);
      linkY += 0.4;
    }

    if (has((p as any).category)) {
      sA.addText(`Category: ${(p as any).category}`, { x: rightX, y: 5.9, w: 6.2, h: 0.35, fontSize: 12 });
    }

    // --- Slide B: Specifications (add only if needed) ---
    const specLines = bullets((p as any).specsBullets);
    const needsSpecSlide = (specLines.length > 0) || !!pdfAbs;

    if (needsSpecSlide) {
      const sB = pptx.addSlide();
      sB.addText(`${title((p as any).name)} — Specifications`, { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 20, bold: true });

      if (specLines.length > 0) {
        sB.addText(specLines.map((t) => `• ${t}`).join("\n"), { x: 0.5, y: 1.1, w: 9, h: 4.8, fontSize: 12 });
      }

      if (pdfAbs) {
        sB.addText("View full specifications (PDF)", {
          x: 0.5, y: 6.5, w: 7, h: 0.35, fontSize: 14, underline: true, color: "0088CC",
          hyperlink: { url: pdfAbs },
        });
      }
    }
  }

  // ------------- BACK PAGES (warranty then service) -------------
  for (const url of BACK_URLS) {
    try {
      const img = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${title(projectName).replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
