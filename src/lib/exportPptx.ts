// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen 16:9 width (in)
const FULL_H = 5.625;  // pptxgen 16:9 height (in)

const COVER_URLS = ["/branding/cover.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------- helpers ---------- */

// Same-origin or proxied URL -> data URL
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("FileReader error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// Read natural (pixel) dimensions from a data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// Fit into a box while preserving aspect ratio; return centered rect
function fitIntoBox(
  imgW: number, imgH: number,
  boxX: number, boxY: number, boxW: number, boxH: number
): { x: number; y: number; w: number; h: number } {
  const rImg = imgW / imgH;
  const rBox = boxW / boxH;
  let w: number, h: number;
  if (rImg >= rBox) { w = boxW; h = w / rImg; }
  else { h = boxH; w = h * rImg; }
  const x = boxX + (boxW - w) / 2;
  const y = boxY + (boxH - h) / 2;
  return { x, y, w, h };
}

// Add a centered, non-cropped image into a box
async function addContainedImage(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number }
) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = fitIntoBox(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// From a pdf url, guess basename (without extension)
function guessSpecBaseFromPdf(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  if (pdfUrl.startsWith("/specs/")) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = decoded.split("/").pop() || "";
      return base.replace(/\.pdf(\?.*)?$/i, "");
    } catch { /* ignore */ }
  }
  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  return;
}

// Try multiple extensions and name variants to find a preview next to the PDF
async function findSpecPreviewUrl(pdfUrl?: string, sku?: string): Promise<string | undefined> {
  const key = guessSpecBaseFromPdf(pdfUrl) || sku;
  if (!key) return;
  const stems = [key, key.replace(/\s+/g, "_"), key.replace(/\s+/g, "")];
  const exts = ["png", "jpg", "jpeg", "webp"];
  for (const stem of stems) {
    for (const ext of exts) {
      const url = `/specs/${stem}.${ext}`;
      try { await urlToDataUrl(url); return url; } catch {}
    }
  }
  return;
}

/* ---------- main ---------- */

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

  // Slide 1
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
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

  
  /* ---------- PRODUCT + SPEC SLIDES ---------- */

  for (const p of items) {
    // ---- Product slide
    {
      const s = pptx.addSlide();

      // Large product image on the left
      if (p.imageProxied) {
        try {
          const imgData = await urlToDataUrl(p.imageProxied);
          await addContainedImage(s, imgData, { x: 0.4, y: 0.85, w: 5.6, h: 3.9 });
        } catch {}
      }

      // Title on the right
      s.addText(p.name || "—", {
        x: 6.3, y: 0.7, w: 3.9, h: 0.9, fontSize: 30, bold: true,
      });

      // Body + bullets on the right
      const bullets =
        (p.specsBullets ?? []).slice(0, 8).map((b) => `• ${b}`).join("\n");
      const body = [p.description, bullets].filter(Boolean).join("\n\n");
      s.addText(body, {
        x: 6.3, y: 1.8, w: 3.9, h: 3.2,
        fontSize: 14, lineSpacing: 18, valign: "top", shrinkText: true,
      });

      // SKU bottom-right so it never collides with the copy
      if (p.code) {
        s.addText(p.code, {
          x: 8.9, y: 5.25, w: 1.0, h: 0.3, fontSize: 12, color: "666666", align: "right",
        });
      }
    }

    // ---- Spec slide (always try when we have a PDF URL)
    if (p.pdfUrl) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.5, y: 0.4, w: 9.0, h: 0.6, fontSize: 28, bold: true,
      });

      let addedImage = false;
      try {
        const previewUrl = await findSpecPreviewUrl(p.pdfUrl, p.code);
        if (previewUrl) {
          const prevData = await urlToDataUrl(previewUrl);
          // Large centered box
          await addContainedImage(s2, prevData, { x: 0.25, y: 1.1, w: 9.5, h: 4.25 });
          addedImage = true;
        }
      } catch {}

      if (!addedImage) {
        s2.addText(
          "Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs, e.g. PMB420.png).",
          { x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 18, color: "888888" }
        );
      }
    }
  }

  /* ---------- BACK PAGES ---------- */
  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
