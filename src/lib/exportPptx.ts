// src/lib/exportPptx.ts
import type { Product } from "../types";
import { getMergedSpecs } from "./specs";

// 16:9 slide size
const FULL_W = 10;
const FULL_H = 5.625;

// Assets in /public/branding
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Layout
const MARGIN = 0.4;
const GAP = 0.3;
const LEFT_W = 4.8;
const RIGHT_X = MARGIN + LEFT_W + GAP;     // 0.4 + 4.8 + 0.3 = 5.5
const RIGHT_W = FULL_W - RIGHT_X - MARGIN; // 10 - 5.5 - 0.4 = 4.1

const TITLE_Y = MARGIN;
const TITLE_H = 0.6;
const SKU_Y   = TITLE_Y + TITLE_H + 0.10;
const SKU_H   = 0.35;

const DESC_Y  = SKU_Y + SKU_H + 0.15;
const DESC_H_WITH_SPECS = 1.25;
const DESC_H_NO_SPECS   = 3.65;

const LINKS_Y = FULL_H - MARGIN - 0.9;
const LINK_H  = 0.35;

const LEFT_IMG_X = MARGIN;
const LEFT_IMG_Y = MARGIN;
const LEFT_IMG_W = LEFT_W;
const LEFT_IMG_H = 4.1;

// Spec slide layout
const SPEC_TITLE_Y = MARGIN;
const SPEC_TITLE_H = 0.6;
const SPEC_NAME_Y  = SPEC_TITLE_Y + SPEC_TITLE_H + 0.1;
const SPEC_NAME_H  = 0.45;
const SPEC_BOX_Y   = SPEC_NAME_Y + SPEC_NAME_H + 0.2;
const SPEC_BOX_H   = FULL_H - SPEC_BOX_Y - MARGIN - 0.6;
const SPEC_LINK_Y  = FULL_H - MARGIN - 0.4;

// Spec-PDF slide layout (third slide)
const PDF_TITLE_Y = MARGIN;
const PDF_TITLE_H = 0.6;
const PDF_NAME_Y  = PDF_TITLE_Y + PDF_TITLE_H + 0.1;
const PDF_NAME_H  = 0.45;
const PDF_BTN_Y   = PDF_NAME_Y + PDF_NAME_H + 0.4;
const PDF_BTN_H   = 0.9;

// Convert URL (supports /api/* proxies) to data URL
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

  // ===== Cover 1 =====
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
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

  // ===== Cover 2 =====
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
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

  // ===== Products =====
  for (const p of items) {
    const name = (p.name || "—").trim();
    const sku  = (p.code || "").trim();
    const desc = (p.description || "").trim();

    // Merge sheet bullets + local fallbacks (src/lib/specs.ts)
    const mergedSpecs = getMergedSpecs(p);
    const haveSpecs = mergedSpecs.length > 0;

    // ---- Slide A: image + overview ----
    const s = pptx.addSlide();

    // Non-cropping image
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data,
          x: LEFT_IMG_X, y: LEFT_IMG_Y, w: LEFT_IMG_W, h: LEFT_IMG_H,
          sizing: { type: "contain", w: LEFT_IMG_W, h: LEFT_IMG_H },
        } as any);
      } catch {}
    }

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

    // Description (shorter if we’re adding a spec slide)
    s.addText(desc, {
      x: RIGHT_X, y: DESC_Y, w: RIGHT_W,
      h: haveSpecs || p.pdfUrl ? DESC_H_WITH_SPECS : DESC_H_NO_SPECS,
      fontSize: 12, valign: "top",
      shrinkText: true,
    });

    // Links
    let linkY = LINKS_Y;
    if (p.url) {
      s.addText("Product page", {
        x: RIGHT_X, y: linkY, w: RIGHT_W, h: LINK_H,
        fontSize: 12, underline: true, hyperlink: { url: p.url },
      });
      linkY += 0.42;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: RIGHT_X, y: linkY, w: RIGHT_W, h: LINK_H,
        fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl },
      });
    }

    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: LEFT_IMG_X, y: LEFT_IMG_Y + LEFT_IMG_H + 0.2,
        w: LEFT_IMG_W, h: 0.3,
        fontSize: 10, color: "666666",
      });
    }

    // ---- Slide B: Specifications ----
    const needsSpecSlide = haveSpecs || !!p.pdfUrl;
    if (needsSpecSlide) {
      const sp = pptx.addSlide();

      sp.addText("Specifications", {
        x: MARGIN, y: SPEC_TITLE_Y, w: FULL_W - 2 * MARGIN, h: SPEC_TITLE_H,
        fontSize: 22, bold: true, valign: "bottom",
      });

      sp.addText(name + (sku ? `  —  ${sku}` : ""), {
        x: MARGIN, y: SPEC_NAME_Y, w: FULL_W - 2 * MARGIN, h: SPEC_NAME_H,
        fontSize: 14, color: "666666", valign: "middle",
      });

      if (haveSpecs) {
        sp.addText(mergedSpecs.join("\n"), {
          x: MARGIN, y: SPEC_BOX_Y, w: FULL_W - 2 * MARGIN, h: SPEC_BOX_H,
          fontSize: 12, bullet: true, lineSpacing: 18, valign: "top",
          shrinkText: true,
        });
      } else {
        sp.addText("Specifications are available in the spec sheet.", {
          x: MARGIN, y: SPEC_BOX_Y, w: FULL_W - 2 * MARGIN, h: SPEC_BOX_H,
          fontSize: 14, italic: true, color: "666666",
        });
      }

      if (p.pdfUrl) {
        sp.addText("Open spec sheet (PDF)", {
          x: MARGIN, y: SPEC_LINK_Y, w: FULL_W - 2 * MARGIN, h: 0.35,
          fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl },
        });
      }
    }

    // ---- Slide C: Spec Sheet (big button) ----
    if (p.pdfUrl) {
      const sp2 = pptx.addSlide();

      sp2.addText("Spec Sheet", {
        x: MARGIN, y: PDF_TITLE_Y, w: FULL_W - 2 * MARGIN, h: PDF_TITLE_H,
        fontSize: 22, bold: true, valign: "bottom",
      });

      sp2.addText(name + (sku ? `  —  ${sku}` : ""), {
        x: MARGIN, y: PDF_NAME_Y, w: FULL_W - 2 * MARGIN, h: PDF_NAME_H,
        fontSize: 14, color: "666666", valign: "middle",
      });

      // Big button-style text box with hyperlink
      sp2.addText("Open Spec Sheet (PDF)", {
        x: MARGIN, y: PDF_BTN_Y, w: FULL_W - 2 * MARGIN, h: PDF_BTN_H,
        fontSize: 20, bold: true, color: "FFFFFF",
        align: "center", valign: "middle",
        fill: { color: "1D4ED8" }, // blue button
        hyperlink: { url: p.pdfUrl },
        line: { color: "1D4ED8" },
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });

      // Small note at the bottom
      sp2.addText("Click to open the full technical sheet.", {
        x: MARGIN, y: FULL_H - MARGIN - 0.35, w: FULL_W - 2 * MARGIN, h: 0.35,
        fontSize: 12, color: "666666", align: "center",
      });
    }
  }

  // ===== Back pages =====
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
