// src/lib/exportPptx.ts
import type { Product } from "../types";

// Slide size for 16:9 in pptxgenjs (inches)
const FULL_W = 10;
const FULL_H = 5.625;

// Public asset paths (these files must be in /public/branding/)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// --- small helpers ---
function clean(s?: string | null): string { return (s ?? "").trim(); }
function title(s?: string) { return clean(s) || "—"; }
function bullets(arr?: string[] | null): string[] {
  if (!arr || !arr.length) return [];
  // Keep non-empty lines, trim, and dedupe consecutive empties
  return arr
    .map((x) => clean(x))
    .filter((x) => !!x);
}

// Turn a Blob into data URL so we can embed images in the PPT
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

type ExportInput = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  items: Product[];
};

export async function exportPptx(input: ExportInput) {
  const {
    projectName, clientName, contactName, email, phone, date,
    items,
  } = input;

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ------------- COVER 1 (project + client) -------------
  try {
    const img1 = await urlToDataUrl(COVER_URLS[0]);
    const s = pptx.addSlide();
    s.addImage({ data: img1, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

    // Overlay (bottom-left)
    s.addText(
      [
        { text: title(projectName), options: { fontSize: 30, bold: true } },
        { text: clean(clientName) ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
      ],
      { x: 0.6, y: 4.2, w: 8.8, h: 1.1, color: "000000", align: "left" }
    );
  } catch {
    // ignore cover load errors
  }

  // ------------- COVER 2 (rest of the info) -------------
  try {
    const img2 = await urlToDataUrl(COVER_URLS[1]);
    const s = pptx.addSlide();
    s.addImage({ data: img2, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

    // Overlay (bottom-left)
    const lines = [
      clean(contactName) ? `Prepared by: ${contactName}` : "",
      clean(email) ? `Email: ${email}` : "",
      clean(phone) ? `Phone: ${phone}` : "",
      clean(date) ? `Date: ${date}` : "",
    ].filter(Boolean).join("\n");

    if (lines) {
      s.addText(lines, {
        x: 0.6, y: 4.2, w: 8.8, h: 1.2,
        fontSize: 18, color: "000000", align: "left",
      });
    }
  } catch {
    // ignore cover load errors
  }

  // ------------- PRODUCT SLIDES -------------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left: product image (contained in a box)
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        // Keep aspect with "contain" inside this box
        s.addImage({
          data: dataUrl,
          x: 0.5, y: 0.7, w: 5.6, h: 4.2,
          sizing: { type: "contain", w: 5.6, h: 4.2 }
        } as any);
      }
    } catch {}

    // Right: name + SKU + description + specs
    const rightX = 6.2;
    s.addText(title(p.name), { x: rightX, y: 0.7, w: 6.2, h: 0.6, fontSize: 22, bold: true });
    if (clean(p.code)) {
      s.addText(`SKU: ${p.code}`, { x: rightX, y: 1.3, w: 6.2, h: 0.35, fontSize: 12 });
    }

    // description
    const desc = clean(p.description);
    if (desc) {
      s.addText(desc, { x: rightX, y: 1.7, w: 6.2, h: 1.0, fontSize: 12 });
    }

    // specs (as bullets)
    const specLines = bullets(p.specsBullets);
    if (specLines.length) {
      s.addText(specLines.map((t) => `• ${t}`).join("\n"), {
        x: rightX, y: 2.8, w: 6.2, h: 2.1, fontSize: 12
      });
    }

    // links
    let linkY = 5.1;
    if (p.url) {
      s.addText("Product page", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.url }
      });
      linkY += 0.4;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: rightX, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl }
      });
    }

    if (clean(p.category)) {
      s.addText(`Category: ${p.category}`, { x: rightX, y: 5.9, w: 6.2, h: 0.35, fontSize: 12 });
    }
  }

  // ------------- BACK PAGES (warranty then service) -------------
  for (const url of BACK_URLS) {
    try {
      const img = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(title(projectName)).replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}