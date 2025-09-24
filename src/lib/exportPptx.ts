// src/lib/exportPptx.ts
import type { Product } from "../types";

/* Theme */
const THEME = {
  fontH: "Calibri",
  fontB: "Calibri",
  color: {
    ink: "1F2937",
    sub: "475569",
    band: "F1F5F9",
    link: "2563EB",
    footer: "64748B",
    overlay: "000000",
    overlayAlpha: 30,   // 0-100 (30% opacity)
    overlayText: "FFFFFF",
  },
};

/* Slide geometry (16:9) */
const FULL_W = 10;
const FULL_H = 5.625;
const PAD = 0.5;

// Product layout
const IMG_BOX  = { x: PAD,  y: 1.05, w: 5.3, h: 3.9 };
const NAME_BOX = { x: 5.6,  y: 1.05, w: 4.2, h: 0.6 };
const SKU_BOX  = { x: 5.6,  y: 1.65, w: 4.2, h: 0.4 };
const DESC_BOX = { x: 5.6,  y: 2.10, w: 4.2, h: 1.35 };
const SPEC_BOX = { x: 5.6,  y: 3.55, w: 4.2, h: 1.75 };
const LINK_BOX = { x: 5.6,  y: 5.40, w: 4.2, h: 0.8 };

/* Asset paths served from /public */
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* Helpers */
function clampChars(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Split bullets on newline, semicolon, bullet dot, pipe, comma, or **2+ spaces**
function splitFlex(text: string) {
  return text
    .split(/[\r\n;•|,]+|\s{2,}/g)
    .map(t => t.trim())
    .filter(Boolean);
}

// Build bullets from any product fields that might contain specs
function getSpecLines(p: Product) {
  // 1) If already an array, use it
  if (Array.isArray(p.specsBullets) && p.specsBullets.length) {
    return p.specsBullets.map(s => String(s).trim()).filter(Boolean);
  }
  // 2) Try common fields (SpecsBullets, specs, etc.)
  const candidates = [
    (p as any).SpecsBullets,
    (p as any).specsBullets,
    (p as any).specs,
    (p as any).Specs,
  ].map(v => (v == null ? "" : String(v))).filter(Boolean);

  // 3) If still empty, fall back to the product description (your sheet often puts specs-like text there)
  if (!candidates.length && p.description) candidates.push(p.description);

  const raw = candidates.find(t => t && t.trim()) || "";
  return splitFlex(raw);
}

function bulletsText(lines: string[], maxItems: number) {
  const items = (lines ?? []).slice(0, maxItems);
  return items.length ? "• " + items.join("\n• ") : "";
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

/* Footer */
function addFooter(s: any, pageNum?: number) {
  const text = pageNum ? `Page ${pageNum}  |  Pacific Bathroom` : `Pacific Bathroom`;
  s.addText(text, {
    x: PAD, y: FULL_H - 0.35, w: FULL_W - PAD * 2, h: 0.3,
    fontSize: 9, color: THEME.color.footer, align: "right", fontFace: THEME.fontB,
  });
}

/* Grouping */
function groupByCategory(products: Product[]) {
  const order: string[] = [];
  const map: Record<string, Product[]> = {};
  for (const p of products) {
    const cat = (p.category || "Other").trim();
    if (!map[cat]) { map[cat] = []; order.push(cat); }
    map[cat].push(p);
  }
  return { order, map };
}

/* Slides */

type FormDataLike = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
};

// Cover with **non-stretched** image and overlay band text
async function addCoverSlide(pptx: any, url: string, form: FormDataLike) {
  const s = pptx.addSlide();

  // Black background so letterboxing looks deliberate
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: FULL_W, h: FULL_H,
    fill: { color: "000000" }, line: { color: "000000" }
  });

  // Image with "contain" so it never stretches
  try {
    const dataUrl = await urlToDataUrl(url);
    s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "contain", w: FULL_W, h: FULL_H } as any });
  } catch {}

  // Overlay band + text (Project + Client)
  const bandH = 1.2;
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: FULL_H - bandH, w: FULL_W, h: bandH,
    fill: { color: THEME.color.overlay, transparency: 100 - THEME.color.overlayAlpha },
    line: { color: THEME.color.overlay }
  });

  const title = form.projectName || "Project Selection";
  const client = form.clientName ? `Client: ${form.clientName}` : "";

  s.addText(
    [
      { text: title,  options: { fontSize: 24, bold: true, color: THEME.color.overlayText, fontFace: THEME.fontH } },
      { text: client ? `\n${client}` : "", options: { fontSize: 16, color: THEME.color.overlayText, fontFace: THEME.fontB } },
    ],
    { x: PAD, y: FULL_H - bandH + 0.22, w: FULL_W - PAD * 2, h: bandH - 0.3, valign: "middle" }
  );
}

function addCategorySlide(pptx: any, category: string, pageNum: number) {
  const s = pptx.addSlide();
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 2.0, w: FULL_W, h: 1.2, fill: { color: THEME.color.band }, line: { color: THEME.color.band } });
  s.addText(category, {
    x: 0.6, y: 2.25, w: FULL_W - 1.2, h: 0.7,
    fontSize: 28, bold: true, color: THEME.color.ink, fontFace: THEME.fontH,
  });
  addFooter(s, pageNum);
}

async function addProductSlide(pptx: any, p: Product, pageNum: number) {
  const s = pptx.addSlide();

  // Image left (contain)
  try {
    if (p.imageProxied) {
      const dataUrl = await urlToDataUrl(p.imageProxied);
      s.addImage({ data: dataUrl, ...IMG_BOX, sizing: { type: "contain", w: IMG_BOX.w, h: IMG_BOX.h } as any });
    }
  } catch {}

  // Title + SKU
  s.addText((p.name ?? "—").trim(), { ...NAME_BOX, fontSize: 20, bold: true, color: THEME.color.ink, fontFace: THEME.fontH });
  if (p.code) s.addText(`SKU: ${p.code}`, { ...SKU_BOX, fontSize: 12, color: THEME.color.sub, fontFace: THEME.fontB });

  // Description (shorter clamp to prevent overflow)
  const desc = clampChars(p.description ?? "", 320);
  if (desc) s.addText(desc, { ...DESC_BOX, fontSize: 12, color: THEME.color.sub, valign: "top", fontFace: THEME.fontB });

  // SPECS (robust)
  const specLines = getSpecLines(p);
  const specs = bulletsText(specLines, 6);
  if (specs) s.addText(specs, { ...SPEC_BOX, fontSize: 12, color: THEME.color.sub, valign: "top", fontFace: THEME.fontB });

  // Links
  let linkY = LINK_BOX.y;
  if (p.url) {
    s.addText("Product page", {
      x: LINK_BOX.x, y: linkY, w: LINK_BOX.w, h: 0.35, fontSize: 12,
      underline: true, color: THEME.color.link, fontFace: THEME.fontB, hyperlink: { url: p.url },
    });
    linkY += 0.35;
  }
  if (p.pdfUrl) {
    const pdf = `/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`;
    s.addText("Spec sheet (PDF)", {
      x: LINK_BOX.x, y: linkY, w: LINK_BOX.w, h: 0.35, fontSize: 12,
      underline: true, color: THEME.color.link, fontFace: THEME.fontB, hyperlink: { url: pdf },
    });
  }

  addFooter(s, pageNum);
}

/* Main export */
export async function exportPptxBryant(selectedProducts: Product[], form: FormDataLike) {
  if (!selectedProducts?.length) { alert("Select at least one product."); return; }
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();
  let pageNum = 1;

  // Exactly two covers with overlay text (no extra title slide)
  for (const url of COVER_URLS) {
    await addCoverSlide(pptx, url, form);
    pageNum++;
  }

  // Category dividers + product pages
  const { order, map } = groupByCategory(selectedProducts);
  for (const cat of order) {
    addCategorySlide(pptx, cat, pageNum++);
    for (const p of map[cat]) await addProductSlide(pptx, p, pageNum++);
  }

  // Back pages (warranty then service), non-stretch
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    // black bg
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: FULL_W, h: FULL_H, fill: { color: "000000" }, line: { color: "000000" } });
    try {
      const dataUrl = await urlToDataUrl(url);
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "contain", w: FULL_W, h: FULL_H } as any });
    } catch {}
    pageNum++;
  }

  const filename = `${(form.projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
