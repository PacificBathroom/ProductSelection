// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;     // pptxgen default 16:9 width (in)
const FULL_H = 5.625;  // pptxgen default 16:9 height

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Convert a same-origin URL (including /api/file-proxy?url=...) to a data URL
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
  // Slide 1: photo + project/client
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
        });
      }
    } catch {}
  }

  // Slide 2: photo + the rest (prepared by, email, phone, date)
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

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.0,
        fontSize: 20, color: "FFFFFF",
        lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" }
      });
    } catch {}
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left image (non-cropping)
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data, x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 }  // keep aspect, no stretch
        } as any);
      } catch {}
    }

    // Right text block
    const bullets =
      (p.specsBullets ?? [])
        .slice(0, 8)
        .map((b) => `• ${b}`)
        .join("\n");

    const body = [p.description, bullets].filter(Boolean).join("\n\n");

    s.addText(p.name || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });

    s.addText(body, {
      x: 6.2, y: 1.9, w: 6.2, h: 3.7,
      fontSize: 12,
      valign: "top",
      shrinkText: true, // auto-fit to the box
    });

    let linkY = 5.8;
    if (p.url)
      s.addText("Product page", { x: 6.2, y: linkY,   w: 6.2, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    if (p.pdfUrl)
      s.addText("Spec sheet (PDF)", { x: 6.2, y: linkY + 0.4, w: 6.2, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });

    if (p.category)
      s.addText(`Category: ${p.category}`, { x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666" });
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
