// src/lib/exportPptx.ts
import type { Product } from "../types";

// Default 16:9 slide size for PptxGenJS
const SLIDE_W = 10;
const SLIDE_H = 5.625;

// Public images you already added (under /public/branding)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

type ExportArgs = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  items: Product[];
};

// --- helpers ---------------------------------------------------------------

function ensureHttp(url?: string): string | undefined {
  if (!url) return;
  if (url.startsWith("/")) return window.location.origin + url;
  return url;
}

async function toDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetch fail ${r.status}`);
  const b = await r.blob();
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onloadend = () => res(String(fr.result));
    fr.readAsDataURL(b);
  });
}

// Try very hard to produce some specs bullets
function getSpecs(p: Product): string[] {
  if (Array.isArray(p.specsBullets) && p.specsBullets.length) {
    return p.specsBullets.map(s => s.trim()).filter(Boolean);
  }
  const raw =
    (p as any).specifications ||
    (p as any).specs ||
    p.description ||
    "";

  return String(raw)
    .split(/\r?\n|[•;]| - |\u2022/g)
    .map(s => s.trim().replace(/^[-•\u2022]\s*/, ""))
    .filter(Boolean);
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

// --- main -----------------------------------------------------------------

export async function exportPptx(args: ExportArgs) {
  const { projectName, clientName, contactName, email, phone, date, items } = args;

  if (!items || items.length === 0) {
    alert("Select at least one product.");
    return;
  }

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ========== COVERS (two bathroom photos with overlaid text) ==========
  for (const [i, url] of COVER_URLS.entries()) {
    try {
      const dataUrl = await toDataUrl(ensureHttp(url)!);
      const s = pptx.addSlide();

      // full-bleed background photo
      s.addImage({
        data: dataUrl,
        x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
        sizing: { type: "cover", w: SLIDE_W, h: SLIDE_H }
      });

      // a soft translucent band to help readability
      s.addShape(pptx.ShapeType.rect, {
        x: 0.45, y: 0.45, w: SLIDE_W - 0.9, h: 2.2,
        fill: { color: "FFFFFF", transparency: 30 },
        line: { color: "FFFFFF" }
      });

      // Title + details (both cover 1 and 2)
      const lines = [
        { text: "Product Presentation for", options: { fontSize: 18, bold: true, color: "000000" } },
        { text: `\n${projectName || "Project Selection"}`, options: { fontSize: 32, bold: true, color: "000000" } },
        { text: clientName ? `\n${clientName}` : "", options: { fontSize: 22, color: "000000" } },
        { text: "\nYour Pacific Bathroom Contact", options: { fontSize: 14, bold: true, color: "000000" } },
        { text: contactName ? `\n${contactName}` : "", options: { fontSize: 14, color: "000000" } },
        {
          text:
            (email || phone)
              ? `\n${[email, phone].filter(Boolean).join("  ·  ")}`
              : "",
          options: { fontSize: 12, color: "000000" }
        },
        { text: date ? `\n${date}` : "", options: { fontSize: 12, color: "000000" } },
      ];

      s.addText(lines, {
        x: 0.75, y: 0.6, w: SLIDE_W - 1.5, h: 2.0,
        align: "left", valign: "top"
      });

      // Optional small footer note on slide 2
      if (i === 1) {
        s.addText("Selections prepared by Pacific Bathroom", {
          x: 0.75, y: SLIDE_H - 0.8, w: SLIDE_W - 1.5, h: 0.4,
          fontSize: 10, color: "444444", align: "left"
        });
      }

    } catch { /* allow missing image */ }
  }

  // ========== PRODUCT SLIDES ==========
  for (const p of items) {
    const s = pptx.addSlide();

    // image area (left)
    const imgX = 0.5, imgY = 0.9, imgW = 4.8, imgH = 3.7;

    try {
      // Prefer proxied image, otherwise raw image URL
      const src = ensureHttp(p.imageProxied || p.imageUrl);
      if (src) {
        const imgData = await toDataUrl(src);
        s.addImage({
          data: imgData,
          x: imgX, y: imgY, w: imgW, h: imgH,
          sizing: { type: "contain", w: imgW, h: imgH }
        });
      } else {
        // placeholder box
        s.addShape(pptx.ShapeType.rect, {
          x: imgX, y: imgY, w: imgW, h: imgH,
          fill: { color: "F3F4F6" }, line: { color: "DDDDDD" }
        });
        s.addText("No image", {
          x: imgX, y: imgY + imgH / 2 - 0.2, w: imgW, h: 0.4,
          align: "center", color: "999999"
        });
      }
    } catch {
      // image fetch failed – draw placeholder
      s.addShape(pptx.ShapeType.rect, {
        x: imgX, y: imgY, w: imgW, h: imgH,
        fill: { color: "F3F4F6" }, line: { color: "DDDDDD" }
      });
      s.addText("Image unavailable", {
        x: imgX, y: imgY + imgH / 2 - 0.2, w: imgW, h: 0.4,
        align: "center", color: "999999"
      });
    }

    // right column text
    const colX = 5.4, colW = 4.2;

    // title + code
    s.addText((p.name || "—"), { x: colX, y: 0.7, w: colW, h: 0.6, fontSize: 22, bold: true });
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: colX, y: 1.25, w: colW, h: 0.4, fontSize: 12, color: "555555" });
    }

    // description (clamped so it never overflows)
    const desc = clamp(p.description || "", 550);
    if (desc) {
      s.addText(desc, {
        x: colX, y: 1.7, w: colW, h: 1.4,
        fontSize: 12, color: "111111", align: "left", valign: "top"
      });
    }

    // specs list (up to 8)
    const specs = getSpecs(p).slice(0, 8);
    if (specs.length) {
      const runs = specs.map(t => ({ text: `• ${t}\n`, options: { fontSize: 12, color: "111111" } }));
      s.addText(runs, {
        x: colX, y: 3.2, w: colW, h: 1.9,
        align: "left", valign: "top"
      });
    }

    // links
    let linkY = 5.3;
    if (p.url) {
      s.addText("Product page", {
        x: colX, y: linkY, w: colW, h: 0.3, fontSize: 12, underline: true,
        hyperlink: { url: p.url }
      });
      linkY += 0.35;
    }
    if (p.pdfUrl) {
      // Pass through your PDF proxy to avoid CORS
      const pdf = `/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`;
      s.addText("Spec sheet (PDF)", {
        x: colX, y: linkY, w: colW, h: 0.3, fontSize: 12, underline: true,
        hyperlink: { url: pdf }
      });
    }
  }

  // ========== BACK PAGES ==========
  for (const url of BACK_URLS) {
    try {
      const dataUrl = await toDataUrl(ensureHttp(url)!);
      const s = pptx.addSlide();
      s.addImage({
        data: dataUrl,
        x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
        sizing: { type: "cover", w: SLIDE_W, h: SLIDE_H }
      });
    } catch { /* ignore */ }
  }

  const filename = `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
