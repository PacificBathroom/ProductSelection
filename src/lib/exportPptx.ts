// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen 16:9 width (in)
const FULL_H = 5.625;  // pptxgen 16:9 height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------- helpers ---------- */

// Same-origin or proxied URL -> data URL
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
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
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

// Try to derive /specs/<basename>.png from various pdfUrl shapes
function guessSpecPreviewFromPdfUrl(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return undefined;

  // 1) Local: /specs/NAME.pdf  -> /specs/NAME.png
  if (pdfUrl.startsWith("/specs/"))
    return pdfUrl.replace(/\.pdf(\?.*)?$/i, ".png");

  // 2) Proxied external: /api/pdf-proxy?url=https://.../NAME.pdf
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = decoded.split("/").pop() || "";
      const key = base.replace(/\.pdf(\?.*)?$/i, "");
      if (key) return `/specs/${key}.png`;
    } catch { /* ignore */ }
  }

  // 3) Raw external https://.../NAME.pdf (if you ever pass those through)
  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop() || "";
    const key = base.replace(/\.pdf(\?.*)?$/i, "");
    if (key) return `/specs/${key}.png`;
  }

  return undefined;
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

  // Slide 2
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);

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

  /* ---------- PRODUCT + SPEC SLIDES ---------- */

  for (const p of items) {
    // ---- Product slide
    const s = pptx.addSlide();

    // Product image (left), keep aspect
    if (p.imageProxied) {
      try {
        const imgData = await urlToDataUrl(p.imageProxied);
        await addContainedImage(s, imgData, { x: 0.5, y: 0.7, w: 5.5, h: 4.1 });
      } catch {}
    }

    // Right side text
    s.addText(p.name || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.3, w: 6.2, h: 0.35, fontSize: 12 });

    const bullets =
      (p.specsBullets ?? [])
        .slice(0, 8)
        .map((b) => `• ${b}`)
        .join("\n");

    const bodyText = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(bodyText, {
      x: 6.2, y: 1.8, w: 6.2, h: 3.2,
      fontSize: 12, valign: "top",
      lineSpacing: 16,
      shrinkText: true,
    });

    let linkY = 5.25;
    if (p.url)
      s.addText("Product page", { x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    if (p.pdfUrl)
      s.addText("Spec sheet (PDF)", { x: 6.2, y: linkY + 0.4, w: 6.2, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });

    if (p.category)
      s.addText(`Category: ${p.category}`, { x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666" });

    // ---- Spec slide (always try when we have a PDF URL)
    if (p.pdfUrl) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.5, y: 0.4, w: 9.0, h: 0.45, fontSize: 18, bold: true,
      });

      const candidate = guessSpecPreviewFromPdfUrl(p.pdfUrl);
      let addedImage = false;
      if (candidate) {
        try {
          const prevData = await urlToDataUrl(candidate);
          await addContainedImage(s2, prevData, { x: 0.5, y: 0.9, w: 9.0, h: 4.2 });
          addedImage = true;
        } catch { /* fall through to message */ }
      }

      if (!addedImage) {
        s2.addText("Spec preview image not found.\n(Expecting a PNG beside the PDF in /public/specs.)", {
          x: 0.5, y: 1.8, w: 9.0, h: 1.0, fontSize: 14, color: "888888"
        });
      }

      s2.addText("Open full spec (PDF)", {
        x: 0.5, y: 5.3, w: 9.0, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl },
      });
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
