// src/lib/exportPptx.ts
import type { Product } from "../types";
import { getMergedSpecs } from "./specs";

// 16:9 default slide size in pptxgenjs (inches)
const FULL_W = 10;
const FULL_H = 5.625;

// brand images (make sure these files exist in /public/branding)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Layout constants (keep everything within 10in width!)
const MARGIN = 0.4;
const GAP = 0.3;
const LEFT_W = 4.8;
const RIGHT_X = MARGIN + LEFT_W + GAP;     // 0.4 + 4.8 + 0.3 = 5.5
const RIGHT_W = FULL_W - RIGHT_X - MARGIN; // 10 - 5.5 - 0.4 = 4.1

// Areas
const TITLE_Y = MARGIN;
const TITLE_H = 0.6;
const SKU_Y = TITLE_Y + TITLE_H + 0.1; // 1.1
const SKU_H = 0.35;

const DESC_Y = SKU_Y + SKU_H + 0.15; // ~1.6
const DESC_H_WITH_SPECS = 1.25;      // height when specs also shown
const DESC_H_NO_SPECS   = 3.65;      // height when no specs

const SPECS_Y = DESC_Y + DESC_H_WITH_SPECS + 0.2; // ~3.05
const SPECS_H = 2.0;

const LINKS_Y = FULL_H - MARGIN - 0.9; // near bottom-right
const LINK_H = 0.35;

const LEFT_IMG_X = MARGIN;
const LEFT_IMG_Y = MARGIN;
const LEFT_IMG_W = LEFT_W;
const LEFT_IMG_H = 4.1; // fits comfortably within slide height

// Convert a (same-origin) URL to data URL. Works with our /api/* proxies too.
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

  // ========== COVER 1 ==========
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({
        data: img,
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      // Overlay text (white with soft shadow for contrast)
      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: FULL_W - 1.2, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.45, w: FULL_W - 1.2, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // ========== COVER 2 ==========
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({
        data: img,
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: FULL_W - 1.2, h: 2.0,
        fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  // ========== PRODUCT SLIDES ==========
  for (const p of items) {
    const s = pptx.addSlide();

    // Left image (non-cropping)
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data,
          x: LEFT_IMG_X, y: LEFT_IMG_Y,
          w: LEFT_IMG_W, h: LEFT_IMG_H,
          sizing: { type: "contain", w: LEFT_IMG_W, h: LEFT_IMG_H }, // keep aspect
        } as any);
      } catch {}
    }

    // Right column
    const name = (p.name || "—").trim();
    const sku  = (p.code || "").trim();
    const desc = (p.description || "").trim();

    const mergedSpecs = getMergedSpecs(p); // sheet bullets, fallback from specs.ts
    const hasSpecs = mergedSpecs.length > 0;

    // Title
    s.addText(name, {
      x: RIGHT_X, y: TITLE_Y, w: RIGHT_W, h: TITLE_H,
      fontSize: 20, bold: true, valign: "middle",
      shrinkText: true,
    });

    // SKU
    if (sku) {
      s.addText(`SKU: ${sku}`, {
        x: RIGHT_X, y: SKU_Y, w: RIGHT_W, h: SKU_H,
        fontSize: 12, valign: "middle",
      });
    }

    // Description block
    s.addText(desc || "", {
      x: RIGHT_X, y: DESC_Y, w: RIGHT_W,
      h: hasSpecs ? DESC_H_WITH_SPECS : DESC_H_NO_SPECS,
      fontSize: 12, valign: "top",
      shrinkText: true, // auto-fit within box
    });

    // Specs block (real bullets)
    if (hasSpecs) {
      s.addText(mergedSpecs.join("\n"), {
        x: RIGHT_X, y: SPECS_Y, w: RIGHT_W, h: SPECS_H,
        fontSize: 12, valign: "top",
        bullet: true, // real bullets
        lineSpacing: 18,
        shrinkText: true,
      });
    }

    // Links
    let y = LINKS_Y;
    if (p.url) {
      s.addText("Product page", {
        x: RIGHT_X, y, w: RIGHT_W, h: LINK_H,
        fontSize: 12, underline: true, hyperlink: { url: p.url },
      });
      y += 0.42;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: RIGHT_X, y, w: RIGHT_W, h: LINK_H,
        fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl },
      });
    }

    // Category (left bottom, optional)
    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: LEFT_IMG_X, y: LEFT_IMG_Y + LEFT_IMG_H + 0.2,
        w: LEFT_IMG_W, h: 0.3,
        fontSize: 10, color: "666666",
      });
    }
  }

  // ========== BACK PAGES ==========
  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({
        data, x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
