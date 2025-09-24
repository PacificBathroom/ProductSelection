// src/lib/exportPptx.ts
import type { Product } from "@/types";

// Slide size (pptxgenjs default 16:9)
const FULL_W = 10;       // inches
const FULL_H = 5.625;

// Brand images (these paths are in /public so they work on Vercel)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Small helpers
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

function saneText(s?: string) {
  return (s ?? "").trim();
}
function title(s?: string) {
  const t = saneText(s);
  return t.length ? t : "—";
}

// Derive bullet points robustly from either SpecsBullets OR Description
function deriveBullets(p: Product): string[] {
  const fromSpecs = (p.specsBullets ?? []).map(s => s.trim()).filter(Boolean);

  if (fromSpecs.length) {
    return fromSpecs.slice(0, 14); // keep it tidy
  }

  // Fallback: parse bullets from Description
  const d = saneText(p.description);
  if (!d) return [];

  // split on newlines or bullet markers (- • •· – — ; .)
  const raw = d
    .split(/\r?\n/)
    .flatMap(line => line.split(/(?:^|\s)[•\-–—]\s+/g))
    .map(s => s.trim())
    .filter(Boolean);

  // If splitting produced nothing meaningful, just return 1–2 trimmed sentences
  if (!raw.length) {
    const sentences = d.split(/(?<=\.)\s+/).map(s => s.trim()).filter(Boolean);
    return sentences.slice(0, 3);
  }

  // De-dup and limit
  const uniq: string[] = [];
  for (const s of raw) {
    if (!s) continue;
    const k = s.toLowerCase();
    if (!uniq.some(u => u.toLowerCase() === k)) uniq.push(s);
    if (uniq.length >= 14) break;
  }
  return uniq;
}

// Full-bleed (or contained) image utility — never stretches
async function addFullSlideImage(pptx: any, url: string, contain = false) {
  const s = pptx.addSlide();
  const dataUrl = await urlToDataUrl(url);
  s.addImage({
    data: dataUrl,
    x: 0, y: 0, w: FULL_W, h: FULL_H,
    sizing: { type: contain ? "contain" : "cover", w: FULL_W, h: FULL_H } as any,
  });
  return s;
}

// Overlay the header details on top of a slide image
function addCoverOverlay(
  slide: any,
  {
    projectName, clientName, contactName, email, phone, date,
  }: {
    projectName?: string; clientName?: string; contactName?: string;
    email?: string; phone?: string; date?: string;
  }
) {
  const lines = [
    title(projectName || "Project Selection"),
    clientName ? `Client: ${clientName}` : "",
    contactName ? `Prepared by: ${contactName}` : "",
    email ? `Email: ${email}` : "",
    phone ? `Phone: ${phone}` : "",
    date ? `Date: ${date}` : "",
  ].filter(Boolean);

  if (!lines.length) return;

  // A dark panel at bottom-left with white text
  slide.addText(
    lines.join("\n"),
    {
      x: 0.4, y: FULL_H - 2.0, w: 6.8, h: 1.7,
      fontSize: 18,
      color: "FFFFFF",
      bold: true,
      valign: "top",
      lineSpacingMultiple: 1.1,
      fill: { color: "000000" },          // panel
      align: "left",
      margin: 14,
    }
  );
}

export async function exportPptx({
  projectName, clientName, contactName, email, phone, date, items,
}: {
  projectName?: string; clientName?: string; contactName?: string;
  email?: string; phone?: string; date?: string; items: Product[];
}) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ---------- 2 x COVERS ----------
  for (const url of COVER_URLS) {
    const slide = await addFullSlideImage(pptx, url, /*contain*/ true);
    addCoverOverlay(slide, { projectName, clientName, contactName, email, phone, date });
  }

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // Left: product image (proxied so CORS is fine)
    if (p.imageProxied) {
      try {
        const imgData = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: imgData,
          x: 0.3, y: 0.6, w: 4.9, h: 4.2,
          sizing: { type: "contain", w: 4.9, h: 4.2 } as any,
        });
      } catch {
        // ignore image fetch errors
      }
    }

    // Right: title + sku
    s.addText(title(p.name), { x: 5.6, y: 0.6, w: 4.2, h: 0.6, fontSize: 22, bold: true });
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: 5.6, y: 1.2, w: 4.2, h: 0.4, fontSize: 12 });
    }
    if (p.category) {
      s.addText(`Category: ${p.category}`, { x: 5.6, y: 1.6, w: 4.2, h: 0.4, fontSize: 12 });
    }

    // Description (shortened so it doesn't overflow)
    const desc = saneText(p.description).slice(0, 600); // cap length
    if (desc) {
      s.addText(desc, {
        x: 5.6, y: 2.1, w: 4.2, h: 1.1,
        fontSize: 12,
        valign: "top",
      });
    }

    // Specs bullets (robust parse + true bullets)
    const bullets = deriveBullets(p);
    if (bullets.length) {
      const bulletTexts = bullets.map(t => ({ text: t, options: { bullet: true, fontSize: 12 } }));
      s.addText(bulletTexts as any, {
        x: 5.6, y: 3.25, w: 4.2, h: 1.9,
        valign: "top",
      });
    }

    // Links
    let linkY = 5.3;
    if (p.url) {
      s.addText("Product page", {
        x: 5.6, y: linkY, w: 4.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.url },
        color: "1d4ed8",
      });
      linkY += 0.4;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 5.6, y: linkY, w: 4.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl },
        color: "1d4ed8",
      });
    }
  }

  // ---------- 2 x BACK PAGES (Warranty then Service) ----------
  for (const url of BACK_URLS) {
    await addFullSlideImage(pptx, url, /*contain*/ true);
  }

  const filename = `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
