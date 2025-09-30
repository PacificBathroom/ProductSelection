// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;       // 16:9 width (inches)
const FULL_H = 5.625;    // 16:9 height (inches)

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// ---------- helpers ----------
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url} -> ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

function truncate(s: string, max = 900) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Try to locate an image preview for the spec (same basename as the PDF) */
async function findSpecPreview(p: Product): Promise<string | null> {
  const url = p.pdfUrl || "";
  const cand: string[] = [];

  // If it's already /specs/<name>.pdf (same-origin), try sibling image files:
  if (/^\/specs\/.+\.pdf(\?.*)?$/i.test(url)) {
    const base = url.replace(/\.pdf(\?.*)?$/i, "");
    cand.push(`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`);
  }

  // Also allow a guess by code (if present):
  if (p.code) {
    const base = `/specs/${p.code}`;
    cand.push(`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`);
  }

  // Try each candidate until one fetches correctly
  for (const c of cand) {
    try {
      const res = await fetch(c);
      if (res.ok) {
        // convert to data URL so pptxgen can embed it
        return await urlToDataUrl(c);
      }
    } catch {
      // continue to next candidate
    }
  }
  return null;
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
  // Slide 1: project + client on photo
  if (COVER_URLS[0]) {
    try {
      const s = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[0]);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

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

  // Slide 2: contact details on photo
  if (COVER_URLS[1]) {
    try {
      const s = pptx.addSlide();
      const img = await urlToDataUrl(COVER_URLS[1]);
      s.addImage({ data: img, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.2,
        fontSize: 20, color: "FFFFFF", lineSpacing: 18,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
    } catch {}
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    // Slide A: product photo + info (no cropping / auto-shrink)
    {
      const s = pptx.addSlide();

      // Title + SKU
      s.addText(p.name || "—", { x: 0.5, y: 0.4, w: 9.0, h: 0.6, fontSize: 22, bold: true });
      if (p.code) s.addText(`SKU: ${p.code}`, { x: 0.5, y: 0.95, w: 9.0, h: 0.4, fontSize: 12, color: "555555" });

      // Left: product image (contain = no stretch/crop)
      if (p.imageProxied) {
        try {
          const data = await urlToDataUrl(p.imageProxied);
          s.addImage({
            data, x: 0.5, y: 1.5, w: 4.8, h: 3.6,
            sizing: { type: "contain", w: 4.8, h: 3.6 }
          } as any);
        } catch {}
      }

      // Right: description + up to 8 bullets
      const bullets = (p.specsBullets ?? []).slice(0, 8).map(b => `• ${b}`).join("\n");
      const body = [truncate(p.description || "", 850), bullets].filter(Boolean).join("\n\n");

      s.addText(body, {
        x: 5.6, y: 1.5, w: 3.9, h: 3.6,
        fontSize: 12, valign: "top", shrinkText: true
      });

      // Links (if any)
      let linkY = 5.3;
      if (p.url) {
        s.addText("Product page", {
          x: 0.5, y: linkY, w: 4.8, h: 0.3,
          fontSize: 12, underline: true, hyperlink: { url: p.url }
        });
        linkY += 0.35;
      }
      if (p.pdfUrl) {
        s.addText("Spec sheet (PDF)", {
          x: 0.5, y: linkY, w: 4.8, h: 0.3,
          fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl }
        });
      }

      if (p.category) {
        s.addText(`Category: ${p.category}`, {
          x: 5.6, y: 5.3, w: 3.9, h: 0.3, fontSize: 10, color: "666666"
        });
      }
    }

    // Slide B: specification image preview (first/best available)
    {
      const s = pptx.addSlide();
      s.addText(`${p.name || "—"} — Specifications`, {
        x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 18, bold: true
      });

      let placed = false;

      try {
        const specImgDataUrl = await findSpecPreview(p);
        if (specImgDataUrl) {
          // Big centered image, contained
          s.addImage({
            data: specImgDataUrl,
            x: 0.5, y: 1.0, w: 9.0, h: 4.2,
            sizing: { type: "contain", w: 9.0, h: 4.2 }
          } as any);
          placed = true;
        }
      } catch {
        // ignore, we’ll show the link fallback
      }

      if (!placed) {
        s.addText("No preview image available for this spec.", {
          x: 0.5, y: 2.2, w: 9.0, h: 0.5, fontSize: 14, color: "7a7a7a"
        });
      }
      if (p.pdfUrl) {
        s.addText("Open full spec (PDF)", {
          x: 0.5, y: 4.8, w: 9.0, h: 0.4, fontSize: 12, underline: true,
          hyperlink: { url: p.pdfUrl }
        });
      }
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
