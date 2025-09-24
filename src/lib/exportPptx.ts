// src/lib/exportPptx.ts
import type { Product } from "../types";

// 16:9 slide size used by pptxgenjs (inches)
const FULL_W = 10;
const FULL_H = 5.625;

// Where your cover/back images live (you already added these in /public/branding)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// -------- helpers --------
async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}

async function urlToDataUrl(url: string): Promise<string> {
  // Use no-store so we don’t reuse a busted cached image while you iterate
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return blobToDataUrl(await r.blob());
}

function cleanText(s?: string) {
  return (s ?? "").toString().trim();
}

// Cap paragraphs so long descriptions don’t run off the slide
function clampText(s: string, maxChars = 900) {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1).trimEnd() + "…";
}

type ExportOpts = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
  items: Product[];
};

export async function exportPptx(opts: ExportOpts) {
  if (!opts.items?.length) throw new Error("No products selected.");

  // lazy import so it doesn’t bloat your main bundle
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ---------- COVERS (two bathroom photos with overlayed text) ----------
  for (const url of COVER_URLS) {
    const s = pptx.addSlide();
    try {
      const dataUrl = await urlToDataUrl(url);
      // full-bleed image
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch { /* ignore */ }

    // overlay text panel so it always shows (no “big black box”)
    const title = cleanText(opts.projectName) || "Project Selection";
    const client = cleanText(opts.clientName);
    const contact = cleanText(opts.contactName);
    const email = cleanText(opts.email);
    const phone = cleanText(opts.phone);
    const date  = cleanText(opts.date);

    const chunks = [
      { text: title, options: { fontSize: 34, bold: true } },
      client ?   { text: `\nClient: ${client}`, options: { fontSize: 20 } } : null,
      contact ?  { text: `\nPrepared by: ${contact}`, options: { fontSize: 16 } } : null,
      email ?    { text: `\nEmail: ${email}`, options: { fontSize: 14 } } : null,
      phone ?    { text: `\nPhone: ${phone}`, options: { fontSize: 14 } } : null,
      date ?     { text: `\nDate: ${date}`, options: { fontSize: 14 } } : null,
    ].filter(Boolean) as any[];

    // put the panel on the left so it reads like your Bryant example
    s.addText(chunks, {
      x: 0.6, y: 0.6, w: 6.2, h: 4.4,
      color: "FFFFFF",
      fontSize: 18,
      align: "left",
      fill: { color: "000000", transparency: 35 }, // readable overlay
      margin: 14,
    });
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of opts.items) {
    const s = pptx.addSlide();

    // left image box
    const imgX = 0.5, imgY = 0.8, imgW = 5.5, imgH = 4.1;
    try {
      const imgUrl = p.imageProxied || p.imageUrl || "";
      if (imgUrl) {
        const dataUrl = await urlToDataUrl(imgUrl);
        s.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH, sizing: { type: "contain", w: imgW, h: imgH } } as any);
      }
    } catch { /* ignore image errors */ }

    // right content
    const name = cleanText(p.name) || "—";
    const sku  = cleanText(p.code);
    const desc = clampText(cleanText(p.description), 700);
    const bullets = (p.specsBullets ?? []).map(cleanText).filter(Boolean).slice(0, 12); // up to 12 bullets

    // Title
    s.addText(name, { x: 6.2, y: 0.7, w: 3.8, h: 0.7, fontSize: 22, bold: true, color: "111111" });

    // SKU
    if (sku) s.addText(`SKU: ${sku}`, { x: 6.2, y: 1.35, w: 3.8, h: 0.4, fontSize: 12, color: "444444" });

    // Description (clamped)
    if (desc) {
      s.addText(desc, {
        x: 6.2, y: 1.8, w: 3.8, h: 1.2,
        fontSize: 12, color: "222222",
        lineSpacing: 18,
      });
    }

    // Bullet specs (these were missing before)
    if (bullets.length) {
      s.addText(
        bullets.map(t => ({ text: t, options: { bullet: true, fontSize: 12 } })),
        { x: 6.2, y: 3.1, w: 3.8, h: 2.1, fontSize: 12, color: "222222", lineSpacing: 18 }
      );
    }

    // Links
    let linkY = 5.4;
    if (p.url) {
      s.addText("Product page", { x: 6.2, y: linkY, w: 3.8, h: 0.3, fontSize: 12, color: "1155CC", underline: true, hyperlink: { url: p.url } });
      linkY += 0.35;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", { x: 6.2, y: linkY, w: 3.8, h: 0.3, fontSize: 12, color: "1155CC", underline: true, hyperlink: { url: p.pdfUrl } });
      linkY += 0.35;
    }
    if (p.category) {
      s.addText(`Category: ${p.category}`, { x: 6.2, y: linkY + 0.15, w: 3.8, h: 0.3, fontSize: 11, color: "666666" });
    }
  }

  // ---------- BACK PAGES (Warranty then Service) ----------
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const dataUrl = await urlToDataUrl(url);
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch { /* ignore */ }
  }

  const filename = `${(cleanText(opts.projectName) || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}