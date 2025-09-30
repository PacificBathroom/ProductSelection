// src/lib/exportPptx.ts
import type { Product } from "../types";

// pptxgen 16:9 canvas (inches)
const FULL_W = 10;
const FULL_H = 5.625;

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ───────── helpers ───────── */

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
  if (rImg >= rBox) { w = boxW; h = w / rImg; }
  else { h = boxH; w = h * rImg; }
  return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
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

// derive the “key” from a PDF url (/specs/KEY.pdf or proxied external)
function pdfKeyFromUrl(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  if (pdfUrl.startsWith("/specs/")) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  const src = m ? decodeURIComponent(m[1]) : pdfUrl;
  const base = src.split("/").pop() || "";
  return base.replace(/\.pdf(\?.*)?$/i, "");
}

// try common preview filenames next to the PDF
function specPreviewCandidates(pdfUrl?: string): string[] {
  const key = pdfKeyFromUrl(pdfUrl);
  if (!key) return [];
  const exts = [".png", ".jpg", ".jpeg", ".webp"];
  const suffixes = ["", "1", "-1", "_1"]; // some files use “1”
  const out: string[] = [];
  for (const s of suffixes) for (const e of exts) out.push(`/specs/${key}${s}${e}`);
  return out;
}

async function findFirstExistingImage(cands: string[]): Promise<string | null> {
  for (const u of cands) {
    try {
      const data = await urlToDataUrl(u);
      return data;
    } catch { /* try next */ }
  }
  return null;
}

/* ───────── main ───────── */

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

  /* covers */

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

  /* product + spec slides */

  for (const p of items) {
    // Product slide
    const s = pptx.addSlide();

    // Title block
    s.addText(p.name || "—", { x: 6.1, y: 0.55, w: 3.7, h: 0.7, fontSize: 22, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.1, y: 1.2, w: 3.7, h: 0.4, fontSize: 12, color: "666666" });

    // Image (left) — larger & contained
    if (p.imageProxied) {
      try {
        const imgData = await urlToDataUrl(p.imageProxied);
        await addContainedImage(s, imgData, { x: 0.5, y: 1.0, w: 5.6, h: 4.1 });
      } catch {}
    }

    // Description + (first few) specs (right)
    const bullets = (p.specsBullets ?? []).slice(0, 8).map(b => `• ${b}`).join("\n");
    const body = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(body, {
      x: 6.1, y: 1.7, w: 3.7, h: 3.4,
      fontSize: 12, lineSpacing: 16, valign: "top",
      shrinkText: true, // keep it inside the box
    });

    // (Removed category + links per your request)

    // Spec slide (when we have a PDF)
    if (p.pdfUrl) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.6, y: 0.45, w: 8.8, h: 0.6, fontSize: 22, bold: true,
      });

      const prev = await findFirstExistingImage(specPreviewCandidates(p.pdfUrl));
      if (prev) {
        // Make the spec image big and centred
        await addContainedImage(s2, prev, { x: 0.4, y: 0.9, w: 9.2, h: 4.4 });
      } else {
        s2.addText("Spec preview image not found.\n(Expecting a PNG/JPG beside the PDF in /public/specs.)", {
          x: 0.6, y: 2.0, w: 8.8, h: 1.0, fontSize: 14, color: "888888"
        });
      }

      // (Removed “Open full spec (PDF)” link per your request)
    }
  }

  /* back pages */

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
