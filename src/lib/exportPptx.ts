// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // 16:9 width (in)
const FULL_H = 5.625;  // 16:9 height (in)

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Fetch a (same-origin) URL (including /api/file-proxy?url=...) and return a data URL
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

  // ---------- COVERS ----------
  // Slide 1: project + client over first bathroom photo
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 3, offset: 1, color: "000000" },
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.45, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 3, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // Slide 2: remaining details over second bathroom photo
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      if (lines.length) {
        s2.addText(lines.join("\n"), {
          x: 0.6, y: 0.6, w: 8.8, h: 2.0,
          fontSize: 20, color: "FFFFFF",
          lineSpacing: 20,
          shadow: { type: "outer", blur: 3, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left: product image (keep aspect; do NOT crop)
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data,
          x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 }, // show full image, no stretch/crop
        } as any);
      } catch {}
    }

    // Right: text column
    s.addText(p.name || "—", { x: 6.2, y: 0.65, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.25, w: 6.2, h: 0.35, fontSize: 12 });
    }

    // Description (dedicated box so it won't hide specs)
    let nextY = 1.7;
    if (p.description) {
      s.addText(p.description, {
        x: 6.2, y: nextY, w: 6.2, h: 1.5,
        fontSize: 12, valign: "top", shrinkText: true,
      });
      nextY += 1.65;
    }

    // Specifications (real bullets, separate block)
    if (p.specsBullets && p.specsBullets.length) {
      s.addText("Specifications", {
        x: 6.2, y: nextY, w: 6.2, h: 0.35, fontSize: 13, bold: true,
      });
      nextY += 0.4;

      s.addText(p.specsBullets.slice(0, 10).join("\n"), {
        x: 6.2, y: nextY, w: 6.2, h: 2.15,
        fontSize: 12, bullet: { type: "bullet" }, lineSpacing: 20, valign: "top",
      });
      nextY += 2.2;
    }

    // Links (after text blocks)
    let linkY = Math.max(nextY + 0.1, 5.6);
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12,
        underline: true, color: "0563C1", hyperlink: { url: p.url },
      });
      linkY += 0.4;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12,
        underline: true, color: "0563C1", hyperlink: { url: p.pdfUrl },
      });
    }

    // Category (bottom-left under image)
    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666",
      });
    }
  }

  // ---------- BACK PAGES ----------
  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
