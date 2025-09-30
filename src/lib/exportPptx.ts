// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;      // 16:9 width in inches
const FULL_H = 5.625;   // 16:9 height in inches

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** Switch here: 'one' = everything on 1 slide, 'two' = separate PDF slide */
const LAYOUT: "one" | "two" = "one";

/** Fetch URL (same-origin or proxied) -> data URL */
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

/** Ensure pdf.js is loaded (UMD from CDN), return window.pdfjsLib */
async function ensurePdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return w.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load pdf.js"));
    document.head.appendChild(s);
  });

  const lib = (window as any).pdfjsLib;
  if (!lib) throw new Error("pdfjsLib not available after load");
  // No worker to avoid cross-origin/packager issues
  try { lib.GlobalWorkerOptions.workerSrc = null; } catch {}
  return lib;
}

/** Render first page of a PDF to a PNG data URL */
async function pdfFirstPageToPngDataUrl(url: string): Promise<string | null> {
  try {
    const pdfjs = await ensurePdfJs();
    const task = pdfjs.getDocument({ url, disableWorker: true });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2 }); // 2x for clarity
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("pdf render failed:", e);
    return null;
  }
}

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

  // ---------- COVER 1 ----------
  try {
    const s = pptx.addSlide();
    s.addImage({
      data: await urlToDataUrl(COVER_URLS[0]),
      x: 0, y: 0, w: FULL_W, h: FULL_H,
      sizing: { type: "cover", w: FULL_W, h: FULL_H },
    } as any);
    s.addText(projectName, {
      x: 0.6, y: 0.6, w: 8.8, h: 1,
      fontSize: 32, bold: true, color: "FFFFFF",
      shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
    });
    if (clientName) {
      s.addText(`Client: ${clientName}`, {
        x: 0.6, y: 1.4, w: 8.8, h: 0.6,
        fontSize: 20, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    }
  } catch {}

  // ---------- COVER 2 ----------
  try {
    const s = pptx.addSlide();
    s.addImage({
      data: await urlToDataUrl(COVER_URLS[1]),
      x: 0, y: 0, w: FULL_W, h: FULL_H,
      sizing: { type: "cover", w: FULL_W, h: FULL_H },
    } as any);
    const lines: string[] = [];
    if (contactName) lines.push(`Prepared by: ${contactName}`);
    if (email)       lines.push(`Email: ${email}`);
    if (phone)       lines.push(`Phone: ${phone}`);
    if (date)        lines.push(`Date: ${date}`);
    s.addText(lines.join("\n"), {
      x: 0.6, y: 0.6, w: 8.8, h: 2,
      fontSize: 20, color: "FFFFFF", lineSpacing: 20,
      shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
    });
  } catch {}

  // ---------- PRODUCTS ----------
  for (const p of items) {
    if (LAYOUT === "one") {
      // ONE-SLIDE LAYOUT
      const s = pptx.addSlide();

      // Title
      s.addText(p.name || "—", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, bold: true });
      if (p.code) s.addText(`SKU: ${p.code}`, { x: 0.5, y: 0.75, w: 9, h: 0.35, fontSize: 12 });

      // Top row: product image (left) + text (right)
      // image box
      if (p.imageProxied || (p as any).imageUrl) {
        try {
          const imgUrl = p.imageProxied || (p as any).imageUrl;
          s.addImage({
            data: await urlToDataUrl(imgUrl!),
            x: 0.5, y: 1.1, w: 4.8, h: 3.2,
            sizing: { type: "contain", w: 4.8, h: 3.2 }, // no crop/stretch
          } as any);
        } catch {}
      }

      // right column text
      const rightX = 5.5;
      let rightY = 1.1;

      if (p.description) {
        s.addText(p.description, {
          x: rightX, y: rightY, w: 4.0, h: 1.5,
          fontSize: 12, valign: "top", shrinkText: true,
        });
        rightY += 1.55;
      }

      if (p.specsBullets && p.specsBullets.length) {
        s.addText("Specifications", {
          x: rightX, y: rightY, w: 4.0, h: 0.3,
          fontSize: 12, bold: true,
        });
        s.addText(p.specsBullets.join("\n"), {
          x: rightX, y: rightY + 0.35, w: 4.0, h: 1.25,
          fontSize: 12, bullet: { type: "bullet" }, valign: "top", shrinkText: true,
        });
      }

      // Bottom row: PDF preview across the slide (if available)
      if (p.pdfUrl) {
        const png = await pdfFirstPageToPngDataUrl(p.pdfUrl);
        if (png) {
          s.addImage({
            data: png, x: 0.5, y: 4.4, w: 9.0, h: 1.1,
            sizing: { type: "contain", w: 9.0, h: 1.1 },
          } as any);
        } else {
          s.addText("Spec sheet could not be embedded (open PDF link below)", {
            x: 0.5, y: 4.6, w: 9.0, h: 0.5, fontSize: 12, color: "AA0000",
          });
        }
        s.addText("Open Spec Sheet (PDF)", {
          x: 0.5, y: 5.2, w: 9.0, h: 0.35, fontSize: 12, underline: true,
          hyperlink: { url: p.pdfUrl },
        });
      }

      // Meta + links
      if (p.category) {
        s.addText(`Category: ${p.category}`, {
          x: 0.5, y: 5.0, w: 4.5, h: 0.3, fontSize: 10, color: "666666",
        });
      }
      let linkY = 5.2;
      if (p.url) {
        s.addText("Product page", {
          x: 5.5, y: linkY, w: 4.0, h: 0.35,
          fontSize: 12, underline: true, hyperlink: { url: p.url },
        });
      }
    } else {
      // TWO-SLIDE LAYOUT (product slide + separate spec slide)
      // Slide A
      {
        const s = pptx.addSlide();

        if (p.imageProxied || (p as any).imageUrl) {
          try {
            const imgUrl = p.imageProxied || (p as any).imageUrl;
            s.addImage({
              data: await urlToDataUrl(imgUrl!),
              x: 0.5, y: 0.7, w: 5.5, h: 4.1,
              sizing: { type: "contain", w: 5.5, h: 4.1 },
            } as any);
          } catch {}
        }

        s.addText(p.name || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
        if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.4, w: 6.2, h: 0.35, fontSize: 12 });

        if (p.description) {
          s.addText(p.description, {
            x: 6.2, y: 1.9, w: 6.2, h: 1.8, fontSize: 12, valign: "top", shrinkText: true,
          });
        }
        if (p.specsBullets?.length) {
          s.addText("Specifications", {
            x: 6.2, y: 3.8, w: 6.2, h: 0.3, fontSize: 12, bold: true,
          });
          s.addText(p.specsBullets.join("\n"), {
            x: 6.2, y: 4.1, w: 6.2, h: 1.4,
            fontSize: 12, bullet: { type: "bullet" }, valign: "top", shrinkText: true,
          });
        }

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
        if (p.category) {
          s.addText(`Category: ${p.category}`, {
            x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666",
          });
        }
      }

      // Slide B (spec page)
      if (p.pdfUrl) {
        const s = pptx.addSlide();
        s.addText(p.name || "—", { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 18, bold: true });
        if (p.code) s.addText(`SKU: ${p.code}`, { x: 0.5, y: 0.75, w: 9, h: 0.35, fontSize: 12 });

        const png = await pdfFirstPageToPngDataUrl(p.pdfUrl);
        if (png) {
          s.addImage({
            data: png, x: 0.5, y: 1.2, w: 9, h: 4.0,
            sizing: { type: "contain", w: 9, h: 4.0 },
          } as any);
        } else {
          s.addText("Spec sheet could not be embedded (open PDF link below)", {
            x: 0.5, y: 2.6, w: 9, h: 0.8, fontSize: 14, color: "AA0000",
          });
        }
        s.addText("Open Spec Sheet (PDF)", {
          x: 0.5, y: 5.5, w: 9, h: 0.35, fontSize: 12, underline: true,
          hyperlink: { url: p.pdfUrl },
        });
      }
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
