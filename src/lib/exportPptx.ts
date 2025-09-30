// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen default 16:9 width (inches)
const FULL_H = 5.625;

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** Fetch any same-origin (or proxied) URL and return a data: URL */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/** Safely truncate long text (to keep it inside the text box) */
function truncate(s: string | undefined, max = 600): string {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/**
 * Render the **first page** of a PDF to a PNG data URL using pdfjs.
 * Works with URLs under /specs/* or any same-origin/ proxied URL (e.g. /api/pdf-proxy?...).
 */
async function pdfFirstPageToDataUrl(pdfUrl: string): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
    // Tell pdfjs where its worker script is (Vite-friendly)
    const workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.js?url")).default;
    (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

    const loadingTask = (pdfjs as any).getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // render at a nice scale for slides
    const viewport = page.getViewport({ scale: 1.7 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("PDF render failed:", e);
    return null; // graceful fallback – we’ll keep the PDF link if rendering fails
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
  // Slide 1: bathroom photo + project/client on top
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 3, offset: 1, color: "000000" }
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 3, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // Slide 2: second bathroom photo + the rest (prepared by, email, phone, date)
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      if (lines.length) {
        s2.addText(lines.join("\n"), {
          x: 0.6, y: 0.6, w: 8.8, h: 2.0,
          fontSize: 20, color: "FFFFFF", lineSpacing: 20,
          shadow: { type: "outer", blur: 3, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    // --- Main product slide
    const s = pptx.addSlide();

    // Left image (keep aspect, no cropping)
    if (p.imageProxied) {
      try {
        const img = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: img,
          x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 }
        } as any);
      } catch {}
    }

    // Right column text layout
    s.addText(p.name || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });

    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.3, w: 6.2, h: 0.38, fontSize: 12 });
    }

    // Description (truncate + shrink to fit)
    if (p.description) {
      s.addText(truncate(p.description, 550), {
        x: 6.2, y: 1.75, w: 6.2, h: 1.35,
        fontSize: 12, valign: "top", shrinkText: true
      });
    }

    // Specification bullets (real bullets, shrink to fit)
    if (p.specsBullets?.length) {
      s.addText(p.specsBullets.slice(0, 12).map(x => x.trim()).filter(Boolean), {
        x: 6.2, y: 3.2, w: 6.2, h: 1.9,
        fontSize: 12, bullet: { type: "bullet" }, valign: "top", shrinkText: true
      });
    }

    // Links
    let y = 5.35;
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.url }
      });
      y += 0.4;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl }
      });
    }

    // Category note (left bottom)
    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666"
      });
    }

    // --- Spec Sheet slide (image of PDF first page)
    if (p.pdfUrl) {
      const specImg = await pdfFirstPageToDataUrl(p.pdfUrl);
      if (specImg) {
        const spec = pptx.addSlide();
        spec.addText(`${p.name || "—"} — Spec Sheet`, {
          x: 0.5, y: 0.35, w: 9, h: 0.5, fontSize: 18, bold: true
        });
        // generous margins, keep aspect (no stretch)
        spec.addImage({
          data: specImg,
          x: 0.5, y: 0.9, w: 9, h: 4.2,
          sizing: { type: "contain", w: 9, h: 4.2 }
        } as any);
        spec.addText("Open full PDF", {
          x: 0.5, y: 5.3, w: 9, h: 0.35, fontSize: 12, underline: true,
          hyperlink: { url: p.pdfUrl }
        });
      }
      // If rendering fails, we still keep the PDF hyperlink on the main slide.
    }
  }

  // ---------- BACK PAGES (warranty then service) ----------
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
