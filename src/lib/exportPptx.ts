// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen 16:9 width (in)
const FULL_H = 5.625;  // pptxgen 16:9 height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------------- helpers ---------------- */

// Same-origin (or proxied) URL -> data URL
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

// Read pixel dims from data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// Trim near-white borders off an image (so spec pages fill space nicely)
async function trimWhite(dataUrl: string, threshold = 245): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let top = 0, left = 0, right = width - 1, bottom = height - 1;

  const isWhite = (i: number) => {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // treat fully transparent as white; treat near-white as white
    return a < 8 || (r >= threshold && g >= threshold && b >= threshold);
  };

  // scan from each edge until we hit a non-white pixel
  outerTop:
  for (; top < height; top++) {
    for (let x = 0; x < width; x++) {
      const i = (top * width + x) * 4;
      if (!isWhite(i)) break outerTop;
    }
  }
  outerBottom:
  for (; bottom >= top; bottom--) {
    for (let x = 0; x < width; x++) {
      const i = (bottom * width + x) * 4;
      if (!isWhite(i)) break outerBottom;
    }
  }
  outerLeft:
  for (; left < width; left++) {
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + left) * 4;
      if (!isWhite(i)) break outerLeft;
    }
  }
  outerRight:
  for (; right >= left; right--) {
    for (let y = top; y <= bottom; y++) {
      const i = (y * width + right) * 4;
      if (!isWhite(i)) break outerRight;
    }
  }

  const w = Math.max(1, right - left + 1);
  const h = Math.max(1, bottom - top + 1);

  // if we trimmed almost nothing, just return original
  if (w < width * 0.98 && h < height * 0.98) {
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const octx = out.getContext("2d")!;
    octx.drawImage(canvas, left, top, w, h, 0, 0, w, h);
    return out.toDataURL(); // PNG
  }
  return dataUrl;
}

// compute contain rect inside a box (ppt inches)
function containRect(
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

// add contained image (optionally trim white first)
async function addImageContained(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number },
  opts?: { trim?: boolean }
) {
  const data = opts?.trim ? await trimWhite(dataUrl) : dataUrl;
  const { w: iw, h: ih } = await getImageDims(data);
  const rect = containRect(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data, ...rect } as any);
}

// Try to derive one or more preview image URLs from a PDF URL
function candidatePreviewsFromPdfUrl(pdfUrl?: string): string[] {
  if (!pdfUrl) return [];

  const tryNames = (base: string) =>
    [".png", ".jpg", ".jpeg", ".webp"].map(ext => `/specs/${base}${ext}`);

  // /specs/NAME.pdf
  if (pdfUrl.startsWith("/specs/")) {
    const base = pdfUrl.split("/").pop()!.replace(/\.pdf(\?.*)?$/i, "");
    return tryNames(base);
  }

  // /api/pdf-proxy?url=.../NAME.pdf
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = decoded.split("/").pop()!.replace(/\.pdf(\?.*)?$/i, "");
      return tryNames(base);
    } catch { /* ignore */ }
  }

  // raw https url
  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop()!.replace(/\.pdf(\?.*)?$/i, "");
    return tryNames(base);
  }

  return [];
}

// fetch first preview that exists -> dataURL
async function firstPreviewData(previews: string[]): Promise<string | null> {
  for (const u of previews) {
    try {
      const d = await urlToDataUrl(u);
      return d;
    } catch { /* keep trying */ }
  }
  return null;
}

/* ---------------- main export ---------------- */

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

  // ---- cover 1
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

  // ---- cover 2
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

  // ---- product + spec slides
  for (const p of items) {
    // PRODUCT slide
    const s = pptx.addSlide();

    // photo (left)
    const photoUrl = p.imageProxied || p.imageUrl;
    if (photoUrl) {
      try {
        const imgData = await urlToDataUrl(photoUrl);
        await addImageContained(s, imgData, { x: 0.5, y: 1.2, w: 5.7, h: 3.9 }, { trim: false });
      } catch {}
    }

    // right copy
    s.addText(p.name || "—", { x: 6.5, y: 0.8, w: 3.0, h: 0.7, fontSize: 30, bold: true, valign: "top" });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.5, y: 1.55, w: 3.8, h: 0.35, fontSize: 12 });

    const bullets =
      (p.specsBullets ?? [])
        .slice(0, 8)
        .map((b) => `• ${b}`)
        .join("\n");

    const bodyText = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(bodyText, {
      x: 6.5, y: 2.0, w: 3.8, h: 3.0,
      fontSize: 16, valign: "top",
      lineSpacing: 22,
      shrinkText: true,
    });

    // accent bar (optional)
    s.addShape(pptx.ShapeType.rect, { x: 0, y: FULL_H - 0.25, w: FULL_W, h: 0.25, fill: { color: "1f3b82" }, line: { color: "1f3b82" } });

    // SPEC slide (separate page)
    if (p.pdfUrl) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.6, y: 0.5, w: 8.8, h: 0.7, fontSize: 36, bold: true,
      });

      const previews = candidatePreviewsFromPdfUrl(p.pdfUrl);
      const data = await firstPreviewData(previews);

      if (data) {
        // Trim borders so technical drawings fill space consistently
        await addImageContained(
          s2,
          await trimWhite(data),
          { x: 0.4, y: 1.2, w: 9.2, h: 3.9 },
          { trim: false }
        );
      } else {
        s2.addText("Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs.)", {
          x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 16, color: "888888"
        });
      }
    }
  }

  // ---- back pages
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
