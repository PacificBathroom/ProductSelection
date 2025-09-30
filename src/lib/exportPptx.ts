// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // 16:9 width (inches)
const FULL_H = 5.625;  // 16:9 height
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BRAND_BLUE = "1E3A8A";

/* ---------------- helpers ---------------- */

// Same-origin (or proxied) URL -> data URL
async function urlToDataUrl(rawUrl: string): Promise<string> {
  // handle spaces in paths like "/specs/S Trap.png"
  const url = encodeURI(rawUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// read natural dims from a data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

function contain(iw: number, ih: number, x: number, y: number, W: number, H: number) {
  const rImg = iw / ih, rBox = W / H;
  let w: number, h: number;
  if (rImg >= rBox) { w = W; h = w / rImg; } else { h = H; w = h * rImg; }
  return { x: x + (W - w) / 2, y: y + (H - h) / 2, w, h };
}

async function addContainedImage(slide: any, dataUrl: string, box: { x:number; y:number; w:number; h:number }) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = contain(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// Prefer proxied product image to avoid CORS
function getProductImgUrl(p: Product): string | undefined {
  if (p.imageProxied) return p.imageProxied;
  if (p.imageUrl) {
    if (/^https?:\/\//i.test(p.imageUrl)) return `/api/file-proxy?url=${encodeURIComponent(p.imageUrl)}`;
    return p.imageUrl;
  }
  return undefined;
}

// make name easier to match to filenames
function slugifyNameForGuess(name?: string): { nice: string; tight: string } {
  if (!name) return { nice: "", tight: "" };
  const nice = name.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const tight = nice.replace(/ /g, "");
  return { nice, tight };
}

// build a list of likely preview image filenames in /public/specs
function guessPreviewCandidates(pdfUrl?: string, code?: string, pdfKey?: string, name?: string): string[] {
  const out: string[] = [];
  const push = (base?: string) => {
    if (!base) return;
    out.push(`/specs/${base}.png`, `/specs/${base}.jpg`, `/specs/${base}.jpeg`, `/specs/${base}.webp`);
  };

  if (pdfUrl?.startsWith("/specs/")) {
    const base = pdfUrl.replace(/^\/specs\//, "").replace(/\.pdf(\?.*)?$/i, "");
    push(base);
  }

  const m = pdfUrl?.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = (decoded.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
      push(base);
    } catch {}
  }

  if (pdfUrl && /^https?:\/\//i.test(pdfUrl)) {
    const base = (pdfUrl.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
    push(base);
  }

  push(code);
  push(pdfKey);

  const { nice, tight } = slugifyNameForGuess(name);
  push(nice);
  push(tight);

  return Array.from(new Set(out));
}

async function firstExistingImageData(cands: string[]): Promise<string | undefined> {
  for (const c of cands) {
    try { return await urlToDataUrl(c); } catch {}
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

  // -------- cover slides (optional images in /public/branding) --------
  for (let i = 0; i < 2; i++) {
    const url = COVER_URLS[i];
    if (!url) continue;
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(url);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
      if (i === 0) {
        s.addText(projectName, { x: 0.6, y: 0.6, w: 8.8, h: 1, fontSize: 34, bold: true, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
        if (clientName) {
          s.addText(`Client: ${clientName}`, { x: 0.6, y: 1.5, w: 8.8, h: 0.7, fontSize: 22, color: "FFFFFF",
            shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
        }
      } else {
        const lines: string[] = [];
        if (contactName) lines.push(`Prepared by: ${contactName}`);
        if (email)       lines.push(`Email: ${email}`);
        if (phone)       lines.push(`Phone: ${phone}`);
        if (date)        lines.push(`Date: ${date}`);
        s.addText(lines.join("\n"), { x: 0.6, y: 0.6, w: 8.8, h: 2, fontSize: 22, color: "FFFFFF",
          lineSpacing: 20, shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
      }
    } catch {}
  }

  // -------- product slides (slide 1) + spec slides (slide 2) --------
  for (const p of items) {
    // ---- Slide 1: product image + text (no category/links)
    {
      const s = pptx.addSlide();

      // footer accent bar
      s.addText("", { x: 0, y: FULL_H - 0.28, w: FULL_W, h: 0.28, fill: { color: BRAND_BLUE } });

      const padX = 0.5;
      const topY = 0.55;
      const leftW = 5.5;
      const gap = 0.35;
      const rightX = padX + leftW + gap;
      const rightW = FULL_W - rightX - padX;

      // product image (left, big)
      const imgUrl = getProductImgUrl(p);
      if (imgUrl) {
        try {
          const data = await urlToDataUrl(imgUrl);
          await addContainedImage(s, data, { x: padX, y: topY, w: leftW, h: 3.3 });
        } catch {}
      }

      // title + sku + description/bullets
      s.addText(p.name || "—", { x: rightX, y: topY, w: rightW, h: 0.9, fontSize: 28, bold: true });
      if (p.code) s.addText(`SKU: ${p.code}`, { x: rightX, y: topY + 0.78, w: rightW, h: 0.38, fontSize: 12 });

      const bullets = (p.specsBullets ?? []).slice(0, 6).map(b => `• ${b}`).join("\n");
      const body = [p.description, bullets].filter(Boolean).join("\n\n");
      s.addText(body, {
        x: rightX, y: topY + 1.15, w: rightW, h: 3.7,
        fontSize: 13, lineSpacing: 18, valign: "top", shrinkText: true,
      });
    }

    // ---- Slide 2: specification preview image full width
    if (p.pdfUrl || p.pdfKey || p.code || p.name) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.5, y: 0.4, w: FULL_W - 1.0, h: 0.6, fontSize: 28, bold: true
      });

      const cands = guessPreviewCandidates(p.pdfUrl, p.code, p.pdfKey, p.name);
      const imgData = await firstExistingImageData(cands);

      if (imgData) {
        // big: fill most of the page
        await addContainedImage(s2, imgData, {
          x: 0.4, y: 1.0, w: FULL_W - 0.8, h: FULL_H - 1.5
        });
      } else {
        s2.addText("Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs.)", {
          x: 0.6, y: 2.0, w: FULL_W - 1.2, h: 1.0, fontSize: 16, color: "888888"
        });
      }
    }
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
