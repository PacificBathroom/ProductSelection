// src/lib/exportPptx.ts
import type { Product } from "../types";

// Header fields passed from your form
export type HeaderData = {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  date?: string;
};

const FULL_W = 10;       // 16:9 pptx width (inches)
const FULL_H = 5.625;    // 16:9 pptx height (inches)

const COVER_URLS = ["/pptx/cover1.jpg", "/pptx/cover2.jpg"];
const BACK_URLS  = ["/pptx/warranty.jpg", "/pptx/service.jpg"];

// ----- small helpers -----
const title = (s?: string) => (s ?? "").trim() || "—";

async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  const b = await r.blob();
  return blobToDataUrl(b);
}

// ----- main export function -----
export async function exportPptx(
  selected: Product[],
  header: HeaderData
): Promise<void> {
  if (!selected.length) {
    throw new Error("No products selected.");
  }

  // Lazy-load pptxgenjs only when exporting
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // -------- Covers (two bathroom photos) --------
  for (const url of COVER_URLS) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({
        data: dataUrl,
        x: 0,
        y: 0,
        w: FULL_W,
        h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);
    } catch {
      // ignore image fetch errors; continue
    }
  }

  // -------- Product slides --------
  for (const p of selected) {
    const s = pptx.addSlide();

    // product image (left)
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: dataUrl,
          x: 0.5,
          y: 0.7,
          w: 5.5,
          h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 },
        } as any);
      }
    } catch {
      // no image, just skip
    }

    // text (right)
    const lines: string[] = [];
    if (p.description) lines.push(p.description);
    if (p.specsBullets?.length)
      lines.push("• " + p.specsBullets.join("\n• "));
    if (p.category) lines.push(`\nCategory: ${p.category}`);

    s.addText(title(p.name), {
      x: 6.2,
      y: 0.7,
      w: 6.2,
      h: 0.6,
      fontSize: 20,
      bold: true,
    });

    if (p.code) {
      s.addText(`SKU: ${p.code}`, {
        x: 6.2,
        y: 1.4,
        w: 6.2,
        h: 0.4,
        fontSize: 12,
      });
    }

    s.addText(lines.join("\n"), {
      x: 6.2,
      y: 1.9,
      w: 6.2,
      h: 3.7,
      fontSize: 12,
    });

    if (p.url) {
      s.addText("Product page", {
        x: 6.2,
        y: 5.8,
        w: 6.2,
        h: 0.4,
        fontSize: 12,
        underline: true,
        hyperlink: { url: p.url },
      });
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2,
        y: 6.2,
        w: 6.2,
        h: 0.4,
        fontSize: 12,
        underline: true,
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  // -------- Back pages (warranty then service) --------
  for (const url of BACK_URLS) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({
        data: dataUrl,
        x: 0,
        y: 0,
        w: FULL_W,
        h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);
    } catch {
      // ignore and continue
    }
  }

  const filename = `${(header.projectName || "Selection")
    .replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
