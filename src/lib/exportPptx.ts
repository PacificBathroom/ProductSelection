// src/lib/exportPptx.ts
import type { Product } from "../types";

/* -------------------- layout constants -------------------- */
const FULL_W = 10;         // 16:9 width (in)
const FULL_H = 5.625;      // 16:9 height (in)
const MARGIN = 0.5;

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ----------------------- helpers -------------------------- */
const clean = (s?: string | null) => (s ?? "").trim();
const title = (s?: string) => clean(s) || "—";
const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function bullets(arr?: string[] | null): string[] {
  if (!arr || !arr.length) return [];
  return arr.map((x) => clean(x)).filter(Boolean);
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

/** Convert /specs/foo.pdf → https://<host>/specs/foo.pdf for PPT hyperlinks */
function absoluteUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    if (u.startsWith("/")) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return origin ? new URL(u, origin).href : u;
    }
    return u;
  } catch {
    return u;
  }
}

/** Normalize Google Drive “view” links to direct-download */
function normalizeDrive(u: string): string {
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  const m2 = u.match(/[?&]id=([^&]+)/i);
  if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
  return u;
}

/** Resolve a spec PDF URL for a product.
 * Priority (external kept if provided):
 *  1) PdfURL / pdfUrl (external; Drive normalized)
 *  2) PdfFile → /specs/<PdfFile>
 *  3) PdfKey  → /specs/<PdfKey>.pdf
 *  4) Code    → /specs/<Code>.pdf
 */
function resolvePdfUrlRaw(
  p: Product
): { url?: string; source?: "PdfURL" | "pdfUrl" | "PdfFile" | "PdfKey" | "Code" } {
  const anyp = p as any;

  // If an explicit external URL exists, use it first (don’t override it).
  if (has(anyp.PdfURL))  return { url: normalizeDrive(String(anyp.PdfURL).trim()), source: "PdfURL" };
  if (has(p.pdfUrl))     return { url: normalizeDrive(p.pdfUrl.trim()), source: "pdfUrl" };

  // Otherwise, try local resolves in /public/specs/...
  if (has(anyp.PdfFile)) return { url: `/specs/${anyp.PdfFile.trim()}`, source: "PdfFile" };
  if (has(anyp.PdfKey))  return { url: `/specs/${anyp.PdfKey.trim()}.pdf`, source: "PdfKey" };
  if (has(p.code))       return { url: `/specs/${p.code.trim()}.pdf`, source: "Code" };

  return { url: undefined, source: undefined };
}

function resolvePdfUrlAbsolute(p: Product): { url?: string; source?: string } {
  const { url, source } = resolvePdfUrlRaw(p);
  return { url: absoluteUrl(url), source };
}

/** Warn in dev if a local /specs file looks missing (HEAD) */
async function warnIfMissingLocalSpec(url: string): Promise<void> {
  if (!url.includes("/specs/")) return;
  const abs = absoluteUrl(url) || url;
  try {
    const r = await fetch(abs, { method: "HEAD", cache: "no-store" });
    if (!r.ok) console.warn(`[specs] Missing PDF at ${abs}`);
  } catch {
    console.warn(`[specs] Could not verify PDF at ${abs}`);
  }
}

/* ------------------------- types -------------------------- */
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

/** If cover contact fields are blank in the input, pull from the first product that has contact info. */
function getCoverContact(input: ExportInput) {
  const firstWithContact = input.items.find((p) => {
    const c = (p as any).contact;
    return c && (c.name || c.email || c.phone || c.address);
  }) as any;

  const c = firstWithContact?.contact || {};
  return {
    name:  has(input.contactName) ? input.contactName : (c.name || ""),
    email: has(input.email)       ? input.email       : (c.email || ""),
    phone: has(input.phone)       ? input.phone       : (c.phone || ""),
    addr:  has(input.address)     ? input.address     : (c.address || ""),
  };
}

/* ---------------------- slide builders -------------------- */
async function addCoverSlide1(pptx: any, projectName: string, clientName: string) {
  const s = pptx.addSlide();
  // background (image optional)
  try {
    const img = await urlToDataUrl(COVER_URLS[0]);
    s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
  } catch {
    // no-op; keep a plain background
  }
  // overlay bar for legibility
  s.addShape(pptx.ShapeType.rect, { x: 0, y: FULL_H - 1.6, w: FULL_W, h: 1.6, fill: { color: "000000", transparency: 35 } });

  s.addText(
    [
      { text: title(projectName), options: { fontSize: 32, bold: true, color: "FFFFFF" } },
      { text: has(clientName) ? `\nClient: ${clientName}` : "", options: { fontSize: 18, color: "FFFFFF" } },
    ],
    { x: MARGIN, y: FULL_H - 1.4, w: FULL_W - MARGIN * 2, h: 1.2, align: "left" }
  );
}

async function addCoverSlide2(pptx: any, cover: { name: string; email: string; phone: string; addr: string }, date: string) {
  const s = pptx.addSlide();
  try {
    const img = await urlToDataUrl(COVER_URLS[1]);
    s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
  } catch {}
  s.addShape(pptx.ShapeType.rect, { x: 0, y: FULL_H - 2.0, w: FULL_W, h: 2.0, fill: { color: "000000", transparency: 35 } });

  const lines = [
    has(cover.name) ? `Prepared by: ${cover.name}` : "",
    has(cover.email) ? `Email: ${cover.email}` : "",
    has(cover.phone) ? `Phone: ${cover.phone}` : "",
    has(cover.addr)  ? `Address: ${cover.addr}` : "",
    has(date) ? `Date: ${date}` : "",
  ].filter(Boolean).join("\n");

  if (lines) {
    s.addText(lines, {
      x: MARGIN,
      y: FULL_H - 1.8,
      w: FULL_W - MARGIN * 2,
      h: 1.6,
      fontSize: 18,
      color: "FFFFFF",
      align: "left",
    } as any);
  }
}

async function addProductSlide(pptx: any, p: Product) {
  const sA = pptx.addSlide();

  // left image panel
  try {
    const imgSrc = (p as any).imageProxied || (p as any).imageUrl;
    if (imgSrc) {
      const dataUrl = await urlToDataUrl(imgSrc);
      sA.addImage({
        data: dataUrl,
        x: MARGIN,
        y: 0.7,
        w: 5.6,
        h: 4.2,
        sizing: { type: "contain", w: 5.6, h: 4.2 },
      } as any);
    } else {
      // placeholder box
      sA.addShape(pptx.ShapeType.rect, { x: MARGIN, y: 0.7, w: 5.6, h: 4.2, fill: { color: "F2F2F2" }, line: { color: "DDDDDD" } });
      sA.addText("No image", { x: MARGIN + 2, y: 2.5, w: 1.6, h: 0.3, fontSize: 12, color: "888888" });
    }
  } catch {
    sA.addShape(pptx.ShapeType.rect, { x: MARGIN, y: 0.7, w: 5.6, h: 4.2, fill: { color: "F2F2F2" }, line: { color: "DDDDDD" } });
    sA.addText("Image error", { x: MARGIN + 1.9, y: 2.5, w: 2, h: 0.3, fontSize: 12, color: "888888" });
  }

  // right details
  const rightX = 6.2;
  sA.addText(title((p as any).name), { x: rightX, y: 0.7, w: 3.2, h: 0.6, fontSize: 22, bold: true });
  if (has(p.code)) sA.addText(`SKU: ${p.code}`, { x: rightX, y: 1.3, w: 3.2, h: 0.3, fontSize: 12 });

  const desc = clean((p as any).description);
  if (desc) {
    sA.addText(desc, { x: rightX, y: 1.7, w: 3.2, h: 1.0, fontSize: 12 });
  }

  let linkY = 3.0;
  if (has((p as any).url)) {
    sA.addText("Product page", {
      x: rightX, y: linkY, w: 3.2, h: 0.3, fontSize: 12, underline: true,
      hyperlink: { url: absoluteUrl((p as any).url)! }
    });
    linkY += 0.35;
  }

  const { url: pdfAbs, source } = resolvePdfUrlAbsolute(p);
  if (pdfAbs) {
    // dev hint
    console.debug("[pptx] PDF resolved from", source, "→", pdfAbs);
    sA.addText("Spec sheet (PDF)", {
      x: rightX, y: linkY, w: 3.2, h: 0.3, fontSize: 12, underline: true,
      hyperlink: { url: pdfAbs }
    });
    const raw = resolvePdfUrlRaw(p).url;
    if (raw) void warnIfMissingLocalSpec(raw);
    linkY += 0.35;
  }

  if (has((p as any).category)) {
    sA.addText(`Category: ${(p as any).category}`, { x: rightX, y: 5.85, w: 3.2, h: 0.3, fontSize: 12 });
  }

  // specs slide (only if bullets or pdf present)
  const specLines = bullets((p as any).specsBullets);
  const needsSpecSlide = specLines.length > 0 || !!pdfAbs;

  if (needsSpecSlide) {
    const sB = pptx.addSlide();
    sB.addText(`${title((p as any).name)} — Specifications`, {
      x: MARGIN, y: 0.5, w: FULL_W - MARGIN * 2, h: 0.6, fontSize: 20, bold: true,
    });

    if (specLines.length > 0) {
      sB.addText(specLines.map((t) => `• ${t}`).join("\n"), {
        x: MARGIN, y: 1.1, w: FULL_W - MARGIN * 2, h: 4.8, fontSize: 12,
      });
    }

    if (pdfAbs) {
      sB.addText("View full specifications (PDF)", {
        x: MARGIN, y: 6.2, w: 6.5, h: 0.35, fontSize: 14, underline: true, color: "0088CC",
        hyperlink: { url: pdfAbs },
      });
    }
  }
}

/* ------------------------- main --------------------------- */
export async function exportPptx(input: ExportInput): Promise<void> {
  const { projectName, clientName, date, items } = input;
  const cover = getCoverContact(input);

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // cover 1 & 2 (text always added; image optional)
  await addCoverSlide1(pptx, projectName, clientName);
  await addCoverSlide2(pptx, cover, date);

  // product slides
  for (const p of items) {
    await addProductSlide(pptx, p);
  }

  // back pages
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const img = await urlToDataUrl(url);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {
      // ignore
    }
  }

  const filename = `${title(projectName).replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}