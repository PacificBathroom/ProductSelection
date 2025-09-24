// src/lib/exportPptx.ts
import type { Product } from "../types";

/* ========= Bryant-ish theme ========= */
const THEME = {
  fontH: "Calibri",
  fontB: "Calibri",
  color: {
    ink: "1F2937",
    sub: "475569",
    band: "F1F5F9",
    link: "2563EB",
    footer: "64748B",
    overlay: "000000", // for cover text backing
    overlayAlpha: 30,  // 0-100 (30% opacity)
    overlayText: "FFFFFF"
  },
};

/* ========= Slide geometry (16:9) ========= */
const FULL_W = 10;
const FULL_H = 5.625;
const PAD = 0.5;

// Product layout
const IMG_BOX  = { x: PAD,  y: 1.05, w: 5.3, h: 3.9 };
const NAME_BOX = { x: 5.6,  y: 1.05, w: 4.2, h: 0.6 };
const SKU_BOX  = { x: 5.6,  y: 1.65, w: 4.2, h: 0.4 };
const DESC_BOX = { x: 5.6,  y: 2.10, w: 4.2, h: 1.5 };
const SPEC_BOX = { x: 5.6,  y: 3.70, w: 4.2, h: 1.6 };
const LINK_BOX = { x: 5.6,  y: 5.40, w: 4.2, h: 0.8 };

/* ========= Static asset paths (public/) ========= */
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ========= Helpers ========= */
function clampChars(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Split bullets regardless of delimiter: newline, semicolon, bullet dot, pipe, or comma.
function splitBullets(source?: string | string[]) {
  if (!source) return [];
  if (Array.isArray(source)) return source.filter(Boolean).map(x => String(x).trim()).filter(Boolean);
  return String(source)
    .split(/[\r\n;•|,]+/g)
    .map(t => t.trim())
    .filter(Boolean);
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

/* ========= Footer ========= */
function addFooter(s: any, pageNum?: number) {
  const text = pageNum ? `Page ${pageNum}  |  Pacific Bathroom` : `Pacific Bathroom`;
  s.addText(text, {
    x: PAD, y: FULL_H - 0.35, w: FULL_W - PAD * 2, h: 0.3,
    fontSize: 9, color: THEME.color.footer, align: "right", fontFace: THEME.fontB,
  });
}

/* ========= Grouping ========= */
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

/* ========= Slides ========= */

// NEW: Cover with full bleed image + overlay text (Project + Client)
type FormDataLike = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
};

async function addCoverSlide(pptx: any, url: string, form: FormDataLike) {
  const s = pptx.addSlide();
  try {
    const dataUrl = await urlToDataUrl(url);
    s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } as any });
  } catch { /* ignore image fetch errors */ }

  // Semi-transparent overlay band so text is readable on any photo
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
    { x: PAD, y: FULL_H - bandH + 0.2, w: FULL_W - PAD * 2, h: bandH - 0.3, valign: "middle" }
  );
}

function addTitleSlide(pptx: any, form: FormDataLike) {
  const s = pptx.addSlide();
  s.addText(
    [
      { text: form.projectName || "Project Selection", options: { fontSize: 30, bold: true, color: THEME.color.ink, fontFace: THEME.fontH } },
      { text: form.clientName ? `\nClient: ${form.clientName}` : "", options: { fontSize: 18, color: THEME.color.sub, fontFace: THEME.fontB } },
      { text: form.contactName ? `\nPrepared by: ${form.contactName}` : "", options: { fontSize: 16, color: THEME.color.sub, fontFace: THEME.fontB } },
      { text: form.email ? `\nEmail: ${form.email}` : "", options: { fontSize: 14, color: THEME.color.sub, fontFace: THEME.fontB } },
      { text: form.phone ? `\nPhone: ${form.phone}` : "", options: { fontSize: 14, color: THEME.color.sub, fontFace: THEME.fontB } },
      { text: form.date ? `\nDate: ${form.date}` : "", options: { fontSize: 14, color: THEME.color.sub, fontFace: THEME.fontB } },
    ],
    { x: PAD, y: PAD, w: FULL_W - PAD * 2, h: FULL_H - PAD * 2 }
  );
  addFooter(s);
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

  // Image left
  try {
    if (p.imageProxied) {
      const dataUrl = await urlToDataUrl(p.imageProxied);
      s.addImage({ data: dataUrl, ...IMG_BOX, sizing: { type: "contain", w: IMG_BOX.w, h: IMG_BOX.h } as any });
    }
  } catch {}

  // Title + SKU
  s.addText((p.name ?? "—").trim(), { ...NAME_BOX, fontSize: 20, bold: true, color: THEME.color.ink, fontFace: THEME.fontH });
  if (p.code) s.addText(`SKU: ${p.code}`, { ...SKU_BOX, fontSize: 12, color: THEME.color.sub, fontFace: THEME.fontB });

  // Description (clamped)
  const desc = clampChars(p.description ?? "", 450);
  if (desc) s.addText(desc, { ...DESC_BOX, fontSize: 12, color: THEME.color.sub, valign: "top", fontFace: THEME.fontB });

  // SPECS — accept array or single string with mixed delimiters
  const candidate =
    (p.specsBullets && p.specsBullets.length ? p.specsBullets : undefined) ??
    (p as any).specsRaw ??
    (p as any).specsbullets ??
    (p as any).SpecsBullets ??
    "";

  const specLines = splitBullets(candidate);
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

/* ========= Public API ========= */
export async function exportPptxBryant(selectedProducts: Product[], form: FormDataLike) {
  if (!selectedProducts?.length) { alert("Select at least one product."); return; }
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  let pageNum = 1;

  // COVERS with overlay text (Project + Client on both)
  for (const url of COVER_URLS) {
    await addCoverSlide(pptx, url, form);
    pageNum++;
  }

  // Title page
  addTitleSlide(pptx, form);
  pageNum++;

  // Category dividers + product pages
  const { order, map } = groupByCategory(selectedProducts);
  for (const cat of order) {
    addCategorySlide(pptx, cat, pageNum++);
    for (const p of map[cat]) await addProductSlide(pptx, p, pageNum++);
  }

  // Back pages
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const dataUrl = await urlToDataUrl(url);
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } as any });
    } catch {}
    pageNum++;
  }

  const filename = `${(form.projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
