// src/lib/exportPptx.ts
import type { Product } from "../types";

// Slide size for 16:9 (pptxgen default)
const FULL_W = 10;
const FULL_H = 5.625;

// Branding image paths (must exist under public/branding)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Helpers
function safe(s?: string) { return (s ?? "").trim(); }
function sanitizeFileName(s: string) {
  const base = safe(s) || "Selection";
  return base.replace(/[^\w\-]+/g, "_") + ".pptx";
}
async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => {
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

// Clamp text to a number of lines for PPT sizing safety
function clampLines(txt: string, maxLines: number): string {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, maxLines).join("\n");
}

export async function exportPptx(args: {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  items: Product[];
}) {
  const { projectName, clientName, contactName, email, phone, date, items } = args;

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ---------- COVERS with overlay text ----------
  for (const path of COVER_URLS) {
    const s = pptx.addSlide();

    try {
      const img = await urlToDataUrl(path);
      // Full-bleed background; use 'cover' to avoid distortion
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {
      // ignore background image failure
    }

    // Overlay text block (top-left)
    const overlayX = 0.6;
    const overlayY = 0.6;
    const overlayW = 6.4;
    const overlayH = 3.4;

    const lines = [
      { text: "Product Presentation for", options: { fontSize: 18, color: "FFFFFF", bold: true } },
      { text: safe(projectName),         options: { fontSize: 30, color: "FFFFFF", bold: true } },
      { text: safe(clientName) ? `\nClient: ${safe(clientName)}` : "", options: { fontSize: 16, color: "FFFFFF" } },
      { text: safe(contactName) ? `\nPrepared by: ${safe(contactName)}` : "", options: { fontSize: 14, color: "FFFFFF" } },
      { text: safe(email) ? `\nEmail: ${safe(email)}` : "", options: { fontSize: 12, color: "FFFFFF" } },
      { text: safe(phone) ? `\nPhone: ${safe(phone)}` : "", options: { fontSize: 12, color: "FFFFFF" } },
      { text: safe(date) ? `\nDate: ${safe(date)}` : "", options: { fontSize: 12, color: "FFFFFF" } },
    ];

    // Optional semi-transparent panel for readability
    s.addShape(pptx.ShapeType.rect, {
      x: overlayX - 0.2, y: overlayY - 0.2, w: overlayW + 0.4, h: overlayH + 0.4,
      fill: { color: "000000" }, transparency: 50, line: { color: "000000" }
    });

    s.addText(lines, {
      x: overlayX, y: overlayY, w: overlayW, h: overlayH,
      align: "left", valign: "top", margin: 8
    });
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left image area
    const imgX = 0.5, imgY = 0.9, imgW = 5.4, imgH = 4.0;

    if (p.imageProxied) {
      try {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        // contain = fit without stretching
        s.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH, sizing: { type: "contain", w: imgW, h: imgH } } as any);
      } catch {
        // ignore image failure
      }
    } else {
      // simple placeholder box if no image
      s.addShape(pptx.ShapeType.rect, {
        x: imgX, y: imgY, w: imgW, h: imgH,
        fill: { color: "F3F4F6" }, line: { color: "DDDDDD" }
      });
      s.addText("No image", { x: imgX, y: imgY + imgH / 2 - 0.2, w: imgW, h: 0.4, align: "center", color: "888888" });
    }

    // Right content area
    const rightX = 6.2, rightW = 3.2;

    // Title
    s.addText(safe(p.name) || "—", {
      x: rightX, y: 0.7, w: rightW, h: 0.6, fontSize: 20, bold: true
    });

    // SKU
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: rightX, y: 1.4, w: rightW, h: 0.35, fontSize: 12 });
    }

    // Description (clamped)
    if (p.description) {
      const desc = clampLines(p.description, 7); // ~7 lines fits the box
      s.addText(desc, { x: rightX, y: 1.85, w: rightW, h: 1.4, fontSize: 12 });
    }

    // Specs bullets: prefer explicit bullets; else try deriving
    let bullets = Array.isArray(p.specsBullets) ? p.specsBullets : [];
    if (!bullets.length && p.description) {
      bullets = (p.description.split(/\r?\n|[•;]|\u2022/g) || [])
        .map(s => s.trim())
        .filter(Boolean);
    }
    if (bullets.length) {
      const bulletText = bullets.slice(0, 8).map(b => `• ${b}`).join("\n");
      s.addText(bulletText, { x: rightX, y: 3.35, w: rightW, h: 1.7, fontSize: 12 });
    }

    // Category
    if (p.category) {
      s.addText(`Category: ${p.category}`, { x: rightX, y: 5.1, w: rightW, h: 0.3, fontSize: 11 });
    }

    // Links
    let linkY = 5.5;
    if (p.url) {
      s.addText("Product page", {
        x: rightX, y: linkY, w: rightW, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.url }
      });
      linkY += 0.35;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: rightX, y: linkY, w: rightW, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl }
      });
    }
  }

  // ---------- BACK PAGES ----------
  for (const path of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const img = await urlToDataUrl(path);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch { /* ignore */ }
  }

  await pptx.writeFile({ fileName: sanitizeFileName(projectName) });
}
