// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;
const FULL_H = 5.625;

// Default images (used if you don't pass overrides)
const DEFAULT_COVER_URLS = ["/branding/cover.jpg"];
const DEFAULT_BACK_URLS = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------- helpers ---------- */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("FileReader error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// Same-origin / public URL -> data URL (for pptxgen)
async function urlToDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("urlToDataUrl: missing url");

  // Turn /foo into https://yourdomain.com/foo
  const absUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;
  if (absUrl.startsWith("data:")) return absUrl;

  const res = await fetch(absUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${absUrl} (${res.status})`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

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

  if (rImg >= rBox) {
    w = boxW;
    h = w / rImg;
  } else {
    h = boxH;
    w = h * rImg;
  }

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

// Derive a base name from a PDF URL (for spec preview images)
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
    } catch {
      // ignore
    }
  }

  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }

  return;
}

// Look for a spec preview PNG/JPG sitting next to the PDF
async function findSpecPreviewUrl(
  pdfUrl?: string,
  sku?: string
): Promise<string | undefined> {
  const key = guessSpecBaseFromPdf(pdfUrl) || sku;
  if (!key) return;

  const stems = [key, key.replace(/\s+/g, "_"), key.replace(/\s+/g, "")];
  const exts = ["png", "jpg", "jpeg", "webp"];

  for (const stem of stems) {
    for (const ext of exts) {
      const url = `/specs/${stem}.${ext}`;
      try {
        await urlToDataUrl(url);
        return url;
      } catch {
        // try next
      }
    }
  }
  return;
}

/* ---------- types ---------- */

export type ExportArgs = {
  projectName?: string;
  clientName?: string;
  contactName?: string; // "Your name (contact)" in the UI
  email?: string;
  phone?: string;
  date?: string;

  // Optional custom cover / back images from the app
  coverImageUrls?: string[];
  backImageUrls?: string[];

  items: Product[];
};

/* ---------- main ---------- */

export async function exportPptx({
  projectName = "Product Presentation",
  clientName = "",
  contactName = "",
  email = "",
  phone = "",
  date = "",
  coverImageUrls,
  backImageUrls,
  items,
}: ExportArgs) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  const coverUrls =
    coverImageUrls && coverImageUrls.length > 0
      ? coverImageUrls
      : DEFAULT_COVER_URLS;

  const backUrls =
    backImageUrls && backImageUrls.length > 0
      ? backImageUrls
      : DEFAULT_BACK_URLS;

  /* ---------- COVER ---------- */

  if (coverUrls[0]) {
    try {
      const s1 = pptx.addSlide();

      // Background image
      try {
        const bg = await urlToDataUrl(coverUrls[0]);
        s1.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H });
      } catch (e) {
        console.warn("Cover background failed", e);
      }

      // Title, centered horizontally
      s1.addText(projectName, {
        x: 0,
        y: 0.6,
        w: FULL_W,
        h: 1.0,
        fontSize: 32,
        bold: true,
        color: "FFFFFF",
        align: "center",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });

      // Contact block
      const lines: string[] = [];
      if (clientName) lines.push(`Client: ${clientName}`);
      if (contactName) lines.push(`Your contact: ${contactName}`);
      if (email) lines.push(`Email: ${email}`);
      if (phone) lines.push(`Phone: ${phone}`);
      if (date) lines.push(`Date: ${date}`);

      const contactBlock = lines.join("\n");
      if (contactBlock) {
        const lineHeight = 0.45; // approx inches per line
        const blockHeight = Math.max(0.9, lines.length * lineHeight);
        const yCentered = (FULL_H - blockHeight) / 2;

        s1.addText(contactBlock, {
          x: 0.6,
          y: yCentered,
          w: 8.8,
          h: blockHeight,
          fontSize: 20,
          color: "FFFFFF",
          lineSpacing: 26,
          align: "left",
          valign: "middle",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch (err) {
      console.error("Cover generation failed", err);
    }
  }

  /* ---------- PRODUCT SLIDES ---------- */

  for (const p of items) {
    const s = pptx.addSlide();

    // Image: try multiple possible fields
    const rawImgUrl =
      (p as any).imageProxied ||
      (p as any).imageUrl ||
      (p as any).image ||
      (p as any).ImageURL;

    if (rawImgUrl) {
      try {
        const imgData = await urlToDataUrl(rawImgUrl);
        await addContainedImage(s, imgData, {
          x: 0.4,
          y: 0.85,
          w: 5.6,
          h: 3.9,
        });
      } catch (imgErr) {
        console.warn("Product image failed", rawImgUrl, imgErr);
      }
    }

    // Title
    s.addText(p.name || "—", {
      x: 6.3,
      y: 0.7,
      w: 3.9,
      h: 0.9,
      fontSize: 30,
      bold: true,
    });

    // Description + bullets
    const bullets = (p.specsBullets ?? [])
      .slice(0, 8)
      .map((b) => `• ${b}`)
      .join("\n");
    const body = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(body || "", {
      x: 6.3,
      y: 1.8,
      w: 3.9,
      h: 3.2,
      fontSize: 14,
      lineSpacing: 18,
      valign: "top",
      shrinkText: true,
    });

    // SKU bottom-right
    if (p.code) {
      s.addText(p.code, {
        x: 8.9,
        y: 5.25,
        w: 1.0,
        h: 0.3,
        fontSize: 12,
        color: "666666",
        align: "right",
      });
    }
  }

  /* ---------- SPEC SLIDES ---------- */

  for (const p of items) {
    const pdfUrl: string | undefined = (p as any).pdfUrl;
    if (!pdfUrl) continue;

    const s2 = pptx.addSlide();

    s2.addText(`${p.name || "—"} — Specifications`, {
      x: 0.5,
      y: 0.4,
      w: 9.0,
      h: 0.6,
      fontSize: 28,
      bold: true,
    });

    let addedImage = false;
    try {
      const previewUrl = await findSpecPreviewUrl(pdfUrl, p.code);
      if (previewUrl) {
        const prevData = await urlToDataUrl(previewUrl);
        await addContainedImage(s2, prevData, {
          x: 0.25,
          y: 1.1,
          w: 9.5,
          h: 4.25,
        });
        addedImage = true;
      }
    } catch (e) {
      console.warn("Spec preview failed", e);
    }

    if (!addedImage) {
      s2.addText(
        "Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs, e.g. PMB420.png).",
        {
          x: 0.6,
          y: 2.0,
          w: 8.8,
          h: 1.2,
          fontSize: 18,
          color: "888888",
        }
      );
    }

    // Clickable link to the spec PDF
    s2.addText("Open Spec PDF", {
      x: 0.5,
      y: 5.0,
      w: 2.0,
      h: 0.4,
      fontSize: 16,
      color: "0078D4",
      hyperlink: { url: pdfUrl },
    });
  }

  /* ---------- BACK PAGES ---------- */

  for (const url of backUrls) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H });
    } catch (e) {
      console.warn("Back page image failed", url, e);
    }
  }

  const filename = `${(projectName || "Product_Presentation").replace(
    /[^\w-]+/g,
    "_"
  )}.pptx`;

  await pptx.writeFile({ fileName: filename });
}
