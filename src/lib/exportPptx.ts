// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;
const FULL_H = 5.625;

const COVER_URLS = ["/branding/cover.jpg"];
const BACK_URLS = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------- helpers ---------- */

// Convert Blob -> data URL
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("FileReader error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

/**
 * Robust URL -> data URL loader.
 * Tries:
 *  1) direct fetch
 *  2) fetch with credentials (include cookies)
 *  3) fetch via local proxy endpoint: /api/fetch-image?url=...
 *
 * Notes:
 *  - If url starts with "/", it will be converted to absolute using window.location.origin.
 *  - If the URL is already a data URL, it returns immediately.
 *  - Implement a server-side proxy if your images are blocked by CORS or need auth.
 */
async function urlToDataUrl(url: string): Promise<string> {
  if (!url) throw new Error("urlToDataUrl: missing url");
  const abs = url.startsWith("/") ? `${window.location.origin}${url}` : url;
  if (abs.startsWith("data:")) return abs;

  async function tryFetch(u: string, opts?: RequestInit) {
    const res = await fetch(u, { cache: "no-store", ...opts });
    if (!res.ok) throw new Error(`fetch failed (${res.status}) ${u}`);
    const blob = await res.blob();
    return blobToDataUrl(blob);
  }

  // 1) plain fetch
  try {
    return await tryFetch(abs);
  } catch (err1) {
    console.warn("urlToDataUrl: direct fetch failed for", abs, err1);
  }

  // 2) fetch with credentials (include cookies) — helpful if same-origin uses session cookies
  try {
    return await tryFetch(abs, { credentials: "include" });
  } catch (err2) {
    console.warn("urlToDataUrl: fetch with credentials failed for", abs, err2);
  }

  // 3) fallback to proxy endpoint on your server (you must implement it)
  // Example endpoint: GET /api/fetch-image?url=<encodedUrl>
  try {
    const proxyPath = `/api/fetch-image?url=${encodeURIComponent(abs)}`;
    return await tryFetch(proxyPath);
  } catch (err3) {
    console.warn("urlToDataUrl: proxy fetch failed for", abs, err3);
    throw new Error(`Could not load image: ${url}`);
  }
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

async function addContainedImage(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number }
) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = fitIntoBox(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

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
  company?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
};

export async function exportPptx({
  projectName = "Product Presentation",
  clientName = "",
  contactName = "",
  company = "",
  email = "",
  phone = "",
  date = "",
  items,
}: ExportArgs) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  /* ---------- COVER ---------- */

  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();

      // background image (if present) — robust loader
      try {
        const bg = await urlToDataUrl(COVER_URLS[0]);
        s1.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H });
      } catch (bgErr) {
        console.warn("Cover background failed to load:", bgErr);
      }

      // Project title: centered horizontally across the slide
      s1.addText(projectName || "Product Presentation", {
        x: 0, y: 0.6, w: FULL_W, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        align: "center",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });

      // Contact info block (centered vertically)
      const lines: string[] = [];
      if (contactName) lines.push(`Your contact: ${contactName}${company ? `, ${company}` : ""}`);
      if (email) lines.push(`Email: ${email}`);
      if (phone) lines.push(`Phone: ${phone}`);
      if (date) lines.push(`Date: ${date}`);

      const contactBlock = lines.join("\n") || "";
      const lineHeightInches = 0.45; // approx per line
      const blockHeight = Math.max(0.9, lines.length * lineHeightInches);
      const yCentered = (FULL_H - blockHeight) / 2;

      if (contactBlock) {
        s1.addText(contactBlock, {
          x: 0.6, y: yCentered, w: 8.8, h: blockHeight,
          fontSize: 20, color: "FFFFFF", lineSpacing: 26, align: "left", valign: "middle",
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

    if (p.imageProxied) {
      try {
        const imgData = await urlToDataUrl(p.imageProxied);
        await addContainedImage(s, imgData, { x: 0.4, y: 0.85, w: 5.6, h: 3.9 });
      } catch (imgErr) {
        console.warn("Product image failed:", p.imageProxied, imgErr);
      }
    }

    s.addText(p.name || "—", {
      x: 6.3, y: 0.7, w: 3.9, h: 0.9, fontSize: 30, bold: true,
    });

    const bullets = (p.specsBullets ?? []).slice(0, 8).map(b => `• ${b}`).join("\n");
    const body = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(body || "", {
      x: 6.3, y: 1.8, w: 3.9, h: 3.2,
      fontSize: 14, lineSpacing: 18, valign: "top", shrinkText: true,
    });

    if (p.code) {
      s.addText(p.code, {
        x: 8.9, y: 5.25, w: 1.0, h: 0.3, fontSize: 12, color: "666666", align: "right",
      });
    }
  }

  /* ---------- SPEC SLIDES ---------- */
  for (const p of items) {
    const pdfUrl: string | undefined = (p as any).pdfUrl;
    if (!pdfUrl) continue;
    const s2 = pptx.addSlide();
    s2.addText(`${p.name || "—"} — Specifications`, {
      x: 0.5, y: 0.4, w: 9.0, h: 0.6, fontSize: 28, bold: true,
    });

    let addedImage = false;
    try {
      const previewUrl = await findSpecPreviewUrl(pdfUrl, p.code);
      if (previewUrl) {
        const prevData = await urlToDataUrl(previewUrl);
        await addContainedImage(s2, prevData, { x: 0.25, y: 1.1, w: 9.5, h: 4.25 });
        addedImage = true;
      }
    } catch (e) {
      console.warn("Spec preview load failed:", e);
    }

    if (!addedImage) {
      s2.addText(
        "Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs, e.g. PMB420.png).",
        { x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 18, color: "888888" }
      );
    }

    try {
      s2.addText("Open Spec PDF", {
        x: 0.5, y: 5.0, w: 2.0, h: 0.4, fontSize: 16, color: "0078D4",
        hyperlink: { url: pdfUrl },
      });
    } catch {}
  }

  /* ---------- BACK PAGES ---------- */
  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H });
    } catch (e) {
      console.warn("Back page image failed:", url, e);
    }
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
