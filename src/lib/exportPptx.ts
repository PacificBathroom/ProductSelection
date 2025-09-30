// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;        // pptx 16:9 width (in)
const FULL_H = 5.625;     // pptx 16:9 height (in)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------- helpers ---------- */

// fetch any same-origin/our-proxy URL and return a data:URL
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

// clamp long text so it won’t spill out of a text box
function clamp(text = "", maxChars = 600): string {
  const t = (text || "").trim();
  return t.length > maxChars ? t.slice(0, maxChars - 1).trimEnd() + "…" : t;
}

// build a friendly bullets array (limit how many)
function bullets(list?: string[], limit = 8): string[] {
  if (!list?.length) return [];
  return list.map((s) => String(s).trim()).filter(Boolean).slice(0, limit);
}

// Prefer /specs/<file>.pdf or our pdf-proxy for CORS-safe loading
function pdfSrc(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return undefined;
  return pdfUrl.startsWith("/specs/") ? pdfUrl : `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
}

// Render FIRST page of a PDF to a PNG data URL using PDF.js **from a CDN**.
// Important: we use a variable + /* @vite-ignore */ so Vite/TS won’t try to bundle/typecheck it.
async function renderPdfFirstPageToPng(pdfUrl: string, targetWidthPx = 1500): Promise<string> {
  const pdfjsUrl =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs";
  const workerUrl =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs";

  const pdfjs: any = await import(/* @vite-ignore */ pdfjsUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ url: pdfUrl });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / viewport.width;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const scaled = page.getViewport({ scale });
  canvas.width = Math.round(scaled.width);
  canvas.height = Math.round(scaled.height);

  await page.render({ canvasContext: context, viewport: scaled }).promise;
  return canvas.toDataURL("image/png");
}

/* ---------- main export ---------- */

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

  /* ---------- COVERS ---------- */
  // Slide 1: big photo, Project + Client
  if (COVER_URLS[0]) {
    try {
      const s = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[0]);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
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
  }

  // Slide 2: big photo, Prepared by / Email / Phone / Date
  if (COVER_URLS[1]) {
    try {
      const s = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[1]);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.2,
        fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  /* ---------- PRODUCT SLIDES (2 per product) ---------- */
  for (const p of items) {
    // Slide A: product image + details
    {
      const s = pptx.addSlide();

      // Left: product image (keep proportions)
      if (p.imageProxied) {
        try {
          const data = await urlToDataUrl(p.imageProxied);
          s.addImage({
            data, x: 0.5, y: 0.7, w: 5.5, h: 4.1,
            sizing: { type: "contain", w: 5.5, h: 4.1 }, // no cropping
          } as any);
        } catch {}
      }

      // Right: name, SKU, description, bullets, links
      const desc = clamp(p.description, 550);
      const specs = bullets(p.specsBullets, 8);

      s.addText(p.name || "—", {
        x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true,
      });
      if (p.code) {
        s.addText(`SKU: ${p.code}`, {
          x: 6.2, y: 1.35, w: 6.2, h: 0.4, fontSize: 12,
        });
      }

      if (desc) {
        s.addText(desc, {
          x: 6.2, y: 1.85, w: 6.2, h: 1.6, fontSize: 12, valign: "top",
        });
      }

      if (specs.length) {
        s.addText(specs, {
          x: 6.2, y: 3.55, w: 6.2, h: 2.0, fontSize: 12,
          bullet: { type: "bullet" },
        });
      }

      let linkY = 5.7;
      if (p.url) {
        s.addText("Product page", {
          x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
          hyperlink: { url: p.url },
        });
        linkY += 0.4;
      }
      if (p.pdfUrl) {
        s.addText("Spec sheet (PDF)", {
          x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
          hyperlink: { url: p.pdfUrl },
        });
      }

      if (p.category) {
        s.addText(`Category: ${p.category}`, {
          x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666",
        });
      }
    }

    // Slide B: spec-sheet as an image (first page of the PDF)
    if (p.pdfUrl) {
      const specUrl = pdfSrc(p.pdfUrl);
      if (specUrl) {
        try {
          const png = await renderPdfFirstPageToPng(specUrl, 1800); // nice resolution
          const s = pptx.addSlide();

          // Title/header
          s.addText(`${p.name || "Product"} — Specifications`, {
            x: 0.5, y: 0.4, w: 9.0, h: 0.5, fontSize: 16, bold: true,
          });

          // Image area (keep proportions, no stretch)
          s.addImage({
            data: png, x: 0.5, y: 1.0, w: 9.0, h: 4.0,
            sizing: { type: "contain", w: 9.0, h: 4.0 },
          } as any);

          // Optional footer link
          s.addText("Open full spec (PDF)", {
            x: 0.5, y: 5.2, w: 9.0, h: 0.35, fontSize: 12, underline: true,
            hyperlink: { url: p.pdfUrl },
          });
        } catch {
          // If rendering fails, at least add a slide with a link
          const s = pptx.addSlide();
          s.addText("Specifications", { x: 0.5, y: 0.6, fontSize: 20, bold: true });
          s.addText("Could not render the spec PDF.", { x: 0.5, y: 1.2, fontSize: 14, color: "cc0000" });
          s.addText("Open full spec (PDF)", {
            x: 0.5, y: 1.8, w: 9.0, h: 0.35, fontSize: 12, underline: true,
            hyperlink: { url: p.pdfUrl },
          });
        }
      }
    }
  }

  /* ---------- BACK PAGES ---------- */
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
