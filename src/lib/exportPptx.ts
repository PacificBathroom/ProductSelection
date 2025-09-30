// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;      // pptxgenjs 16:9 width (in)
const FULL_H = 5.625;   // pptxgenjs 16:9 height

// cover images you already ship in /public/branding/
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];

// a simple brand blue footer bar
const BRAND_BLUE = "1E3A8A"; // hex without '#'

// ===== helpers =====

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

// read natural (pixel) dims from a data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// fit into a box (contain)
function contain(
  imgW: number, imgH: number,
  x: number, y: number, W: number, H: number
) {
  const rImg = imgW / imgH;
  const rBox = W / H;
  let w: number, h: number;
  if (rImg >= rBox) { w = W; h = w / rImg; } else { h = H; w = h * rImg; }
  return { x: x + (W - w) / 2, y: y + (H - h) / 2, w, h };
}

// add contained image to slide
async function addContainedImage(slide: any, dataUrl: string, box: {x:number;y:number;w:number;h:number}) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = contain(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// turn a pdf url into likely preview filenames under /public/specs
function guessPreviewCandidates(pdfUrl?: string, code?: string): string[] {
  const out: string[] = [];
  if (pdfUrl) {
    // 1) /specs/Name.pdf -> /specs/Name.png/.jpg
    if (pdfUrl.startsWith("/specs/")) {
      const base = pdfUrl.replace(/\.pdf(\?.*)?$/i, "");
      out.push(`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`);
    }

    // 2) /api/pdf-proxy?url=https://.../Name.pdf -> /specs/Name.png...
    const m = pdfUrl.match(/[?&]url=([^&]+)/);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1]);
        const name = (decoded.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
        if (name) out.push(`/specs/${name}.png`, `/specs/${name}.jpg`, `/specs/${name}.jpeg`, `/specs/${name}.webp`);
      } catch {}
    }

    // 3) raw external https url
    if (/^https?:\/\//i.test(pdfUrl)) {
      const name = (pdfUrl.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
      if (name) out.push(`/specs/${name}.png`, `/specs/${name}.jpg`, `/specs/${name}.jpeg`, `/specs/${name}.webp`);
    }
  }

  // 4) try by SKU/code as a last resort
  if (code) {
    out.push(`/specs/${code}.png`, `/specs/${code}.jpg`, `/specs/${code}.jpeg`, `/specs/${code}.webp`);
  }

  // de-dupe
  return Array.from(new Set(out));
}

// try the candidates until one fetches
async function firstExistingImageData(candidates: string[]): Promise<string | undefined> {
  for (const url of candidates) {
    try { return await urlToDataUrl(url); } catch { /* keep trying */ }
  }
  return undefined;
}

// ===== main =====

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

  // ---------- covers ----------
  if (COVER_URLS[0]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[0]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);

      s.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1,
        fontSize: 34, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
      if (clientName) {
        s.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.5, w: 8.8, h: 0.7,
          fontSize: 22, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  if (COVER_URLS[1]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[1]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2,
        fontSize: 22, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  // ---------- product slides ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // footer bar (brand)
    s.addText("", { x: 0, y: FULL_H - 0.28, w: FULL_W, h: 0.28, fill: { color: BRAND_BLUE } });

    // layout constants
    const padX = 0.5;
    const topY = 0.6;
    const colGap = 0.3;
    const leftW = 5.2;              // left column width
    const rightX = padX + leftW + colGap;
    const rightW = FULL_W - rightX - padX;
    const imgBoxH = 3.0;            // height for main product image
    const specBoxH = 1.6;           // height for spec preview (bigger than before)

    // title + SKU
    s.addText(p.name || "—", { x: rightX, y: topY, w: rightW, h: 0.7, fontSize: 26, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: rightX, y: topY + 0.7, w: rightW, h: 0.35, fontSize: 12 });

    // description + bullets (auto-shrink, no links/category)
    const bullets = (p.specsBullets ?? []).slice(0, 6).map(b => `• ${b}`).join("\n");
    const body = [p.description, bullets].filter(Boolean).join("\n\n");
    s.addText(body, {
      x: rightX, y: topY + 1.1, w: rightW, h: 3.2,
      fontSize: 13, lineSpacing: 18, valign: "top", shrinkText: true,
    });

    // product image (big, left, contained)
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        await addContainedImage(s, data, { x: padX, y: topY + 0.2, w: leftW, h: imgBoxH });
      } catch {}
    }

    // spec preview (left, under product image, contained) — tries .png/.jpg beside PDF or by SKU
    const specCandidates = guessPreviewCandidates(p.pdfUrl, p.code);
    const specData = await firstExistingImageData(specCandidates);
    if (specData) {
      await addContainedImage(s, specData, {
        x: padX, y: topY + 0.2 + imgBoxH + 0.25,
        w: leftW, h: specBoxH,
      });
    }
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
