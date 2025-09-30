// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;      // 16:9 slide width (in)
const FULL_H = 5.625;   // 16:9 slide height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** Fetch any same-origin (or proxied) URL and return as data URL */
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

/** Lazy-load pdf.js and render first page -> PNG data URL (no worker) */
let pdfLib: any | null = null;
async function pdfFirstPageToPngDataUrl(url: string): Promise<string | null> {
  try {
    if (!pdfLib) {
      // legacy build is friendlier with bundlers
      pdfLib = await import("pdfjs-dist/build/pdf");
    }
    // No worker = no bundler complaints
    const loadingTask = pdfLib.getDocument({ url, disableWorker: true });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Render at 2x for clarity
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
      x: 0.6, y: 0.6, w: 8.8, h: 2,
      fontSize: 20, color: "FFFFFF", lineSpacing: 20,
      shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
    });
  } catch {}

  // ---------- PRODUCTS ----------
  for (const p of items) {
    // Product slide (image + details)
    {
      const s = pptx.addSlide();

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

      s.addText(p.name || "—", {
        x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true,
      });
      if (p.code) {
        s.addText(`SKU: ${p.code}`, {
          x: 6.2, y: 1.4, w: 6.2, h: 0.35, fontSize: 12,
        });
      }

      if (p.description) {
        s.addText(p.description, {
          x: 6.2, y: 1.9, w: 6.2, h: 1.6,
          fontSize: 12, valign: "top", shrinkText: true,
        });
      }

      const bullets = (p.specsBullets ?? []).filter(Boolean);
      if (bullets.length) {
        s.addText("Specifications", {
          x: 6.2, y: 3.6, w: 6.2, h: 0.3, fontSize: 12, bold: true,
        });
        s.addText(bullets.join("\n"), {
          x: 6.2, y: 3.9, w: 6.2, h: 1.6,
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

    // Spec slide (PDF page 1 as image)
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
