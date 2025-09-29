import type { Product } from "../types";
import { bulletsFor } from "./specs"; // optional fallback map you can edit

const FULL_W = 10;
const FULL_H = 5.625;

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Layout boxes (inches)
const RECT = {
  img:   { x: 0.5, y: 0.7, w: 5.5, h: 4.1 },
  title: { x: 6.2, y: 0.7, w: 6.2, h: 0.6 },
  sku:   { x: 6.2, y: 1.2, w: 6.2, h: 0.35 },
  desc:  { x: 6.2, y: 1.6, w: 6.2, h: 1.6 },   // description box
  specs: { x: 6.2, y: 3.3, w: 6.2, h: 1.9 },   // bullets box (separate area)
  link1: { x: 6.2, y: 5.4, w: 6.2, h: 0.35 },
  link2: { x: 6.2, y: 5.8, w: 6.2, h: 0.35 },
};

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

// very simple truncation as a final safety net
function truncate(s: string, maxChars = 700): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length <= maxChars ? t : t.slice(0, maxChars - 1).trimEnd() + "…";
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
      const s1 = pptx.addSlide();
      s1.addImage({
        data: await urlToDataUrl(COVER_URLS[0]),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // Slide 2: rest of contact info on photo
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      s2.addImage({
        data: await urlToDataUrl(COVER_URLS[1]),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);

      const lines = [
        contactName ? `Prepared by: ${contactName}` : "",
        email       ? `Email: ${email}`             : "",
        phone       ? `Phone: ${phone}`             : "",
        date        ? `Date: ${date}`               : "",
      ].filter(Boolean);

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.0,
        fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left image — keep aspect ratio, no cropping
    if (p.imageProxied) {
      try {
        s.addImage({
          data: await urlToDataUrl(p.imageProxied),
          ...RECT.img,
          sizing: { type: "contain", w: RECT.img.w, h: RECT.img.h },
        } as any);
      } catch {}
    }

    // Title + SKU
    s.addText(p.name || "—", { ...RECT.title, fontSize: 20, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { ...RECT.sku, fontSize: 12 });

    // Description (own box, auto-fit & truncate to avoid overflow)
    if (p.description) {
      s.addText(truncate(p.description), {
        ...RECT.desc,
        fontSize: 12,
        valign: "top",
        autoFit: true,        // shrink to fit the shape
        lineSpacing: 16,
        margin: [4, 2, 2, 2],
      });
    }

    // Specs bullets – use sheet first; if empty, use fallback map
    const specs =
      (p.specsBullets && p.specsBullets.length ? p.specsBullets : bulletsFor(p)).slice(0, 8);

    if (specs.length) {
      s.addText(specs.map(t => `• ${t}`).join("\n"), {
        ...RECT.specs,
        fontSize: 12,
        valign: "top",
        autoFit: true,
        lineSpacing: 16,
      });
    }

    // Links
    if (p.url)    s.addText("Product page",    { ...RECT.link1, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    if (p.pdfUrl) s.addText("Spec sheet (PDF)",{ ...RECT.link2, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });

    // Optional category tag under the image
    if (p.category)
      s.addText(`Category: ${p.category}`, { x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666" });
  }

  // ---------- BACK PAGES ----------
  for (const url of BACK_URLS) {
    try {
      const s = pptx.addSlide();
      s.addImage({
        data: await urlToDataUrl(url),
        x: 0, y: 0, w: FULL_W, h: FULL_H,
        sizing: { type: "cover", w: FULL_W, h: FULL_H },
      } as any);
    } catch {}
  }

  await pptx.writeFile({
    fileName: `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`,
  });
}
