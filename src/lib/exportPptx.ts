// src/lib/exportPptx.ts
import type { Product } from "../types";

// Slide size (pptxgen 16:9 default in inches)
const FULL_W = 10;
const FULL_H = 5.625;

// Your branding images
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** Fetch a URL (same-origin or via your proxies) and return a data URL */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/** Lazily load pdf.js and render first page -> data URL. Falls back to null on failure. */
let pdfReady: Promise<any> | null = null;
function ensurePdfJs() {
  if (!pdfReady) {
    pdfReady = (async () => {
      // The worker entry registers itself; we don't need to set workerSrc manually.
      await import("pdfjs-dist/build/pdf.worker.entry");
      const pdfjs = await import("pdfjs-dist/build/pdf");
      return pdfjs;
    })();
  }
  return pdfReady;
}

async function pdfFirstPageToPngDataUrl(url: string): Promise<string | null> {
  try {
    const pdfjs: any = await ensurePdfJs();
    const loadingTask = pdfjs.getDocument({ url }); // can be a proxied URL
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Render at 2x for clarity (tweak if file size gets large)
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Toggle: set to true if you want to try to put *everything* on one slide.
// Default keeps your “product slide” + “spec sheet slide” flow.
const COMBINE_SPEC_ON_PRODUCT_SLIDE = false;

type ExportArgs = {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
};

export async function exportPptx({
  projectName = "Product Presentation",
  clientName = "",
  contactName = "",
  email = "",
  phone = "",
  date = "",
  items,
}: ExportArgs) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ---------- COVERS ----------
  // Cover 1: project + client on a full-bleed photo
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      s1.addImage({
        data: await urlToDataUrl(COVER_URLS[0]),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // Cover 2: contact info on second full-bleed photo
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      s2.addImage({
        data: await urlToDataUrl(COVER_URLS[1]),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.0,
        fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  // ---------- PRODUCT(S) ----------
  for (const p of items) {
    // Primary product slide (image + details)
    {
      const s = pptx.addSlide();

      // Left: product image (contain so it never looks cropped)
      const imgUrl = p.imageProxied || (p as any).imageUrl;
      if (imgUrl) {
        try {
          s.addImage({
            data: await urlToDataUrl(imgUrl),
            x: 0.5, y: 0.7, w: 5.5, h: 4.1,
            sizing: { type: "contain", w: 5.5, h: 4.1 },
          } as any);
        } catch {}
      }

      // Right: title + SKU
      s.addText(p.name || "—", {
        x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true,
      });
      if (p.code) {
        s.addText(`SKU: ${p.code}`, {
          x: 6.2, y: 1.4, w: 6.2, h: 0.35, fontSize: 12,
        });
      }

      // Right: description (boxed so it can't run off page)
      if (p.description) {
        s.addText(p.description, {
          x: 6.2, y: 1.9, w: 6.2, h: 1.6,
          fontSize: 12, valign: "top", shrinkText: true,
        });
      }

      // Right: specs (real bullets, own box so it never overlaps description)
      const bullets = (p.specsBullets ?? []).filter(Boolean);
      if (bullets.length) {
        s.addText("Specifications", {
          x: 6.2, y: 3.6, w: 6.2, h: 0.3, fontSize: 12, bold: true,
        });
        s.addText(bullets.join("\n"), {
          x: 6.2, y: 3.9, w: 6.2, h: 1.6,
          fontSize: 12, bullet: { type: "bullet" }, shrinkText: true, valign: "top",
        });
      }

      // Links
      let linkY = 5.8;
      if (p.url) {
        s.addText("Product page", {
          x: 6.2, y: linkY, w: 6.2, h: 0.35,
          fontSize: 12, underline: true, hyperlink: { url: p.url },
        });
        linkY += 0.4;
      }
      if (p.pdfUrl) {
        s.addText("Spec sheet (PDF)", {
          x: 6.2, y: linkY, w: 6.2, h: 0.35,
          fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl },
        });
      }

      // Category helper (subtle, bottom-left)
      if (p.category) {
        s.addText(`Category: ${p.category}`, {
          x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666",
        });
      }

      // Single-slide mode: also try to place the spec PDF page on the same slide
      if (COMBINE_SPEC_ON_PRODUCT_SLIDE && p.pdfUrl) {
        const png = await pdfFirstPageToPngDataUrl(p.pdfUrl);
        if (png) {
          // Mini spec preview under the product image
          s.addImage({
            data: png, x: 0.5, y: 5.1, w: 5.5, h: 0.9,
            sizing: { type: "contain", w: 5.5, h: 0.9 },
          } as any);
        }
      }
    }

    // Two-slide flow: dedicated spec slide with the first page of the PDF
    if (!COMBINE_SPEC_ON_PRODUCT_SLIDE && p.pdfUrl) {
      const png = await pdfFirstPageToPngDataUrl(p.pdfUrl);
      const s = pptx.addSlide();
      s.addText(p.name || "—", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true });
      if (p.code) {
        s.addText(`SKU: ${p.code}`, { x: 0.5, y: 0.75, w: 9, h: 0.35, fontSize: 12 });
      }

      if (png) {
        // Full-bleed-ish spec page (contain so it never distorts)
        s.addImage({
          data: png, x: 0.5, y: 1.2, w: 9, h: 4.0,
          sizing: { type: "contain", w: 9, h: 4.0 },
        } as any);
      } else {
        s.addText("Spec sheet could not be embedded (click to open PDF)", {
          x: 0.5, y: 2.6, w: 9, h: 0.8, fontSize: 14, color: "AA0000",
        });
      }

      // Always add an explicit “Open PDF” link for convenience
      s.addText("Open Spec Sheet (PDF)", {
        x: 0.5, y: 5.5, w: 9, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  // ---------- BACK PAGES ----------
  for (const url of BACK_URLS) {
    try {
      const s = pptx.addSlide();
      s.addImage({
        data: await urlToDataUrl(url),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
