// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen default 16:9 width (in)
const FULL_H = 5.625;  // pptxgen default 16:9 height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------------- helpers ---------------- */

// Fetch any image URL (including /api/file-proxy?url=...) and return a PNG data URL.
// We always convert to PNG so Office renders it reliably (WebP/JPG become PNG).
async function urlToPngDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();

  // Read to data URL first (same-origin because of the proxy).
  const bufUrl: string = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });

  // Draw on canvas and export as PNG.
  const img = new Image();
  img.src = bufUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });

  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/png");
}

// Natural dimensions from a data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// Fit into a box while preserving aspect ratio (unchanged)
function fitIntoBox(
  imgW: number, imgH: number,
  boxX: number, boxY: number, boxW: number, boxH: number
) {
  const rImg = imgW / imgH;
  const rBox = boxW / boxH;
  let w: number, h: number;
  if (rImg >= rBox) { w = boxW; h = w / rImg; }
  else { h = boxH; w = h * rImg; }
  const x = boxX + (boxW - w) / 2;
  const y = boxY + (boxH - h) / 2;
  return { x, y, w, h };
}

async function addContainedImage(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number }
) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = fitIntoBox(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// derive a likely /specs/NAME.ext from a pdf url
function guessSpecBaseFromPdf(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  if (pdfUrl.startsWith("/specs/")) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  if (m) try {
    const decoded = decodeURIComponent(m[1]);
    const base = decoded.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  } catch {}
  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
}

// try multiple image extensions (png / jpg / jpeg / webp)
async function findSpecPreviewUrl(pdfUrl?: string, code?: string) {
  const key = guessSpecBaseFromPdf(pdfUrl) || code;
  if (!key) return undefined;
  const stems = [key, key.replace(/\s+/g, "_"), key.replace(/\s+/g, "")];
  const exts = ["png", "jpg", "jpeg", "webp"];
  for (const stem of stems) {
    for (const ext of exts) {
      const url = `/specs/${stem}.${ext}`;
      try { await urlToDataUrl(url); return url; } catch {}
    }
  }
  return undefined;
}




/* ---------------- main ---------------- */

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
      const bg = await urlToPngDataUrl(COVER_URLS[0]);
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
      const bg = await urlToPngDataUrl(COVER_URLS[1]);
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

    // Layout: image left, text right (keeps within slide width)
    if (p.imageProxied) {
      try {
        const imgData = await urlToPngDataUrl(p.imageProxied);
        await addContainedImage(s, imgData, { x: 0.6, y: 1.1, w: 5.8, h: 3.9 });
      } catch {}
    }

    // Title + SKU
    s.addText(p.name || "—", { x: 6.8, y: 0.7, w: 2.6, h: 0.8, fontSize: 28, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.8, y: 1.5, w: 2.6, h: 0.35, fontSize: 12 });

    // Description + (first few) bullets
    const bullets = (p.specsBullets ?? []).slice(0, 6).map(b => `• ${b}`).join("\n");
    const body = [p.description || "", bullets].filter(Boolean).join("\n\n");

    s.addText(body, {
      x: 6.8, y: 1.95, w: 2.6, h: 3.2,
      fontSize: 12, valign: "top", lineSpacing: 16, shrinkText: true,
    });

    // ---- Spec slide (if there is a PDF URL or we can still match by code)
    const specSlideNeeded = !!(p.pdfUrl || p.code);
    if (specSlideNeeded) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.6, y: 0.45, w: 8.8, h: 0.7, fontSize: 30, bold: true,
      });

      // Try multiple candidate image names
      const candidates = buildSpecPreviewCandidates(p);
      let added = false;
      for (const c of candidates) {
        try {
          const img = await urlToPngDataUrl(c);
          // Large box that fills most of the slide
          await addContainedImage(s2, img, { x: 0.25, y: 0.95, w: 9.5, h: 4.25 });
          added = true;
          break;
        } catch { /* try next */ }
      }

      if (!added) {
        s2.addText(
          "Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs, " +
          "e.g. PMB420.png).",
          { x: 0.6, y: 1.8, w: 8.8, h: 1.0, fontSize: 18, color: "888888" }
        );
      }

      // No links or extra footer per your request
    }
  }

  /* ---------- BACK PAGES ---------- */

  for (const url of BACK_URLS) {
    try {
      const data = await urlToPngDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
