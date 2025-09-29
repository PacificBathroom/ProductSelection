// src/lib/exportPptx.ts
import type { Product } from "../types";
import { bulletsFromRepo } from "./specs"; // <-- specs stored in repo

const FULL_W = 10;      // 16:9 width (inches) for pptxgenjs default
const FULL_H = 5.625;   // 16:9 height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Convert a URL (same-origin or /api/file-proxy) into a data URL for pptxgen
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

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

  // -------- Cover 1: photo + project/client --------
  if (COVER_URLS[0]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[0]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
      if (clientName) {
        s.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // -------- Cover 2: photo + prepared by/email/phone/date --------
  if (COVER_URLS[1]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[1]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      if (lines.length) {
        s.addText(lines.join("\n"), {
          x: 0.6, y: 0.6, w: 8.8, h: 2.0,
          fontSize: 20, color: "FFFFFF", lineSpacing: 20,
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // -------- Product slides --------
  for (const p of items) {
    const slide = pptx.addSlide();

    // Left: image (keep aspect; no cropping)
    if (p.imageProxied) {
      try {
        const img = await urlToDataUrl(p.imageProxied);
        slide.addImage({
          data: img,
          x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 }  // << prevents cropping
        } as any);
      } catch {}
    }

    // Right: title + SKU
    slide.addText(p.name || "—", {
      x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true
    });
    if (p.code) {
      slide.addText(`SKU: ${p.code}`, {
        x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12
      });
    }

    // Merge bullets:
    // - Sheet bullets (p.specsBullets)
    // - Repo bullets (via src/lib/specs.ts) based on Code/PdfKey
    const repo = bulletsFromRepo(p);                 // from GitHub repo
    const sheet = p.specsBullets ?? [];
    // de-duplicate & trim
    const merged = Array.from(new Set([...sheet, ...repo])).slice(0, 12);

    // Right: description
    if (p.description) {
      slide.addText(p.description, {
        x: 6.2, y: 1.9, w: 6.2, h: 1.1,
        fontSize: 12, valign: "top", shrinkText: true
      });
    }

    // Right: real bullets block (separate box so description doesn’t push them off page)
    if (merged.length) {
      slide.addText(merged, {
        x: 6.2, y: 3.1, w: 6.2, h: 2.5,
        fontSize: 12,
        bullet: { type: "bullet" }, // true bullet list
        valign: "top"
      });
    }

    // Links
    let linkY = 5.8;
    if (p.url) {
      slide.addText("Product page", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35,
        fontSize: 12, underline: true, hyperlink: { url: p.url }
      });
      linkY += 0.4;
    }
    if (p.pdfUrl) {
      slide.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35,
        fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl }
      });
    }

    // Category (small note under the image)
    if (p.category) {
      slide.addText(`Category: ${p.category}`, {
        x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666"
      });
    }
  }

  // -------- Back pages --------
  for (const url of BACK_URLS) {
    try {
      const bg = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
