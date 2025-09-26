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

/**
 * Resolve a spec PDF URL for a product using (in order):
 *   1) PdfFile  -> /specs/<PdfFile>
 *   2) PdfKey   -> /specs/<PdfKey>.pdf
 *   3) Code     -> /specs/<Code>.pdf
 *   4) pdfUrl   -> use as-is (external)  [least preferred]
 *
 * Put PDFs in /public/specs so they deploy to /specs/...
 */
function resolvePdfUrl(p: Product): string | undefined {
  const anyp = p as any;

  // 1) explicit file name (e.g. VAN600.pdf)
  if (has(anyp.PdfFile)) return `/specs/${anyp.PdfFile.trim()}`;

  // 2) PdfKey + .pdf (e.g. VAN600 -> /specs/VAN600.pdf)
  if (has(anyp.PdfKey)) return `/specs/${anyp.PdfKey.trim()}.pdf`;

  // 3) fall back to Code (SKU)
  if (has(p.code)) return `/specs/${p.code.trim()}.pdf`;

  // 4) last resort: use existing external url on the product object
  if (has((p as any).PdfURL)) return String((p as any).PdfURL).trim();
  if (has(p.pdfUrl)) return p.pdfUrl.trim();

  return undefined;
}

/** Optional: warn in dev if a local /specs file looks missing */
async function warnIfMissingLocalSpec(url: string) {
  if (!url.startsWith("/specs/")) return;
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!r.ok) console.warn(`[specs] Missing PDF at ${url}`);
  } catch {
    console.warn(`[specs] Could not verify PDF at ${url}`);
  }
}

type ExportInput = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  items: Product[];
};

export async function exportPptx(input: ExportInput) {
  const {
    projectName, clientName, contactName, email, phone, date,
    items,
  } = input;

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ------------- COVER 1 (project + client) -------------
  try {
    const img1 = await urlToDataUrl(COVER_URLS[0]);
    const s = pptx.addSlide();
    s.addImage({ data: img1, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

    // Overlay (bottom-left)
    s.addText(
      [
        { text: title(projectName), options: { fontSize: 30, bold: true } },
        { text: clean(clientName) ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
      ],
      { x: 0.6, y: 4.2, w: 8.8, h: 1.1, color: "000000", align: "left" }
    );
  } catch {
    // ignore cover load errors
  }

  // ------------- COVER 2 (rest of the info) -------------
  try {
    const img2 = await urlToDataUrl(COVER_URLS[1]);
    const s = pptx.addSlide();
    s.addImage({ data: img2, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

    // Overlay (bottom-left)
    const lines = [
      clean(contactName) ? `Prepared by: ${contactName}` : "",
      clean(email) ? `Email: ${email}` : "",
      clean(phone) ? `Phone: ${phone}` : "",
      clean(date) ? `Date: ${date}` : "",
    ].filter(Boolean).join("\n");

    if (lines) {
      s.addText(lines, {
        x: 0.6, y: 4.2, w: 8.8, h: 1.2,
        fontSize: 18, color: "000000", align: "left",
      });
    }
  } catch {
    // ignore cover load errors
  }

  // ------------- PRODUCT SLIDES -------------
  for (const p of items) {
    // --- Slide A: Main product card ---
    const sA = pptx.addSlide();

    // Left: product image (contained in a box)
    try {
      if ((p as any).imageProxied) {
        const dataUrl = await urlToDataUrl((p as any).imageProxied);
        sA.addImage({
          data: dataUrl,
          x: 0.5, y: 0.7, w: 5.6, h: 4.2,
          sizing: { type: "contain", w: 5.6, h: 4.2 }
        } as any);
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
    let linkY = 3.0; // moved up since we no longer show specs here
    if (has((p as any).url)) {
      sA.addText("Product page", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: (p as any).url }
      });
      linkY += 0.4;
    }

    const pdfResolved = resolvePdfUrl(p);
    if (pdfResolved) {
      sA.addText("Spec sheet (PDF)", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: pdfResolved }
      });
      // Optional dev warning for missing local files
      warnIfMissingLocalSpec(pdfResolved);
      linkY += 0.4;
    }

    if (has((p as any).category)) {
      sA.addText(`Category: ${(p as any).category}`, { x: rightX, y: 5.9, w: 6.2, h: 0.35, fontSize: 12 });
    }

    // --- Slide B: Specifications (add only if needed) ---
    const specLines = bullets((p as any).specsBullets);
    const needsSpecSlide = (specLines.length > 0) || !!pdfResolved;

    if (needsSpecSlide) {
      const sB = pptx.addSlide();
      sB.addText(`${title((p as any).name)} — Specifications`, {
        x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 20, bold: true,
      });

      let y = 1.1;

      if (specLines.length > 0) {
        sB.addText(specLines.map((t) => `• ${t}`).join("\n"), {
          x: 0.5, y, w: 9, h: 4.8, fontSize: 12,
        });
        y += Math.min(4.8, 0); // keep y if you want to stack more content later
      }

      if (pdfResolved) {
        sB.addText("View full specifications (PDF)", {
          x: 0.5, y: 6.5, w: 7, h: 0.35, fontSize: 14, underline: true, color: "0088CC",
          hyperlink: { url: pdfResolved },
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
