// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;      // 16:9 default width (inches)
const FULL_H = 5.625;   // 16:9 default height (inches)

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** fetch any same-origin URL (incl. /api/file-proxy?url=...) to a data URL */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/** lazy-load pdf.js from CDN at runtime (avoids Vite/TS bundling issues) */
let pdfjsLibCached: any | null = null;
async function ensurePdfJs(): Promise<any> {
  if (pdfjsLibCached) return pdfjsLibCached;
  // Use variable + @vite-ignore so the bundler doesn’t try to resolve it
  const PDFJS_URL: any =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs";
  // @ts-ignore – dynamic remote import lacks types
  const lib = await import(/* @vite-ignore */ PDFJS_URL);
  // Point the worker to the CDN build
  lib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  pdfjsLibCached = lib;
  return lib;
}

/** render first page of a PDF URL to a PNG data URL (or return null on failure) */
async function pdfFirstPageToDataUrl(pdfUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const pdfjs = await ensurePdfJs();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const page = await doc.getPage(1);

    // Render at a decent resolution
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("pdf->image failed", e);
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

  // --------- COVERS ---------
  // Slide 1: photo + project/client
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0, fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6, fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // Slide 2: photo + prepared-by/email/phone/date
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.0, fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
    } catch {}
  }

  // --------- PRODUCT SLIDES (one slide per product: side-by-side images + description) ---------
  for (const p of items) {
    const s = pptx.addSlide();

    // Title / SKU
    s.addText(p.name || "—", { x: 0.5, y: 0.2, w: 9.0, h: 0.6, fontSize: 20, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 0.5, y: 0.7, w: 9.0, h: 0.4, fontSize: 12, color: "666666" });

    // Two columns (images), then description across the bottom
    const marginX = 0.5;
    const gap = 0.4;
    const colW = (FULL_W - marginX * 2 - gap) / 2; // two equal columns
    const topY = 1.1;
    const imgH = 3.2;

    // Left: product photo (contain to avoid cropping)
    if (p.imageProxied) {
      try {
        const photo = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: photo, x: marginX, y: topY, w: colW, h: imgH,
          sizing: { type: "contain", w: colW, h: imgH }
        } as any);
      } catch {}
    }

    // Right: spec PDF first page (rendered to image)
    let specPreview: string | null = null;
    if (p.pdfUrl) {
      specPreview = await pdfFirstPageToDataUrl(p.pdfUrl);
    }
    if (specPreview) {
      s.addImage({
        data: specPreview, x: marginX + colW + gap, y: topY, w: colW, h: imgH,
        sizing: { type: "contain", w: colW, h: imgH }
      } as any);
    } else if (p.pdfUrl) {
      // Fallback: clickable text if preview failed
      s.addText("Open Spec Sheet (PDF)", {
        x: marginX + colW + gap, y: topY + imgH / 2 - 0.2, w: colW, h: 0.4,
        fontSize: 12, underline: true, align: "center",
        hyperlink: { url: p.pdfUrl }
      });
    }

    // Description (+ optional bullets) across the bottom
    const descTop = topY + imgH + 0.25;
    const descH = FULL_H - descTop - 0.3;

    const bullets =
      (p.specsBullets ?? [])
        .slice(0, 8)
        .map(b => `• ${b}`)
        .join("\n");

    const body = [p.description || "", bullets].filter(Boolean).join("\n\n");

    s.addText(body || " ", {
      x: marginX, y: descTop, w: FULL_W - marginX * 2, h: descH,
      fontSize: 12, valign: "top", shrinkText: true
    });

    // Links row (optional)
    let linkY = descTop + descH - 0.35;
    if (p.url) {
      s.addText("Product page", {
        x: marginX, y: linkY, w: 3.0, h: 0.3,
        fontSize: 12, underline: true, hyperlink: { url: p.url }
      });
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: marginX + 3.2, y: linkY, w: 3.5, h: 0.3,
        fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl }
      });
    }

    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: FULL_W - marginX - 3.0, y: linkY, w: 3.0, h: 0.3,
        fontSize: 10, color: "666666", align: "right"
      });
    }
  }

  // --------- BACK PAGES ---------
  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
