// src/lib/exportPptx.ts
import type { Product } from "../types";

// Slide & layout constants (16:9)
const FULL_W = 10;
const FULL_H = 5.625;
const PAD = 0.5;

// Product layout boxes (tuned to match the Bryant-style slides)
const IMG_BOX  = { x: PAD,  y: 1.05, w: 5.3, h: 3.9 };
const NAME_BOX = { x: 5.6,  y: 1.05, w: 4.2, h: 0.6 };
const SKU_BOX  = { x: 5.6,  y: 1.65, w: 4.2, h: 0.4 };
const DESC_BOX = { x: 5.6,  y: 2.10, w: 4.2, h: 1.5 };
const SPEC_BOX = { x: 5.6,  y: 3.70, w: 4.2, h: 1.6 };
const LINK_BOX = { x: 5.6,  y: 5.40, w: 4.2, h: 0.8 };

// Cover / back images (served by Vercel from /public)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Helpers
function clampChars(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
function splitBullets(s?: string) {
  return (s ?? "")
    .split(/\r?\n|;|•/g) // newline OR semicolon OR bullet
    .map(t => t.trim())
    .filter(Boolean);
}
function bulletsText(lines: string[], maxItems: number) {
  const items = (lines ?? []).slice(0, maxItems);
  return items.length ? "• " + items.join("\n• ") : "";
}

// Convert a URL to base64 for pptxgenjs images
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

// Optional: consistent footer (page number + brand)
function addFooter(s: any, pageNum?: number) {
  const text = pageNum ? `Page ${pageNum}  |  Pacific Bathroom` : `Pacific Bathroom`;
  s.addText(text, { x: PAD, y: FULL_H - 0.35, w: FULL_W - PAD*2, h: 0.3, fontSize: 9, color: "666666", align: "right" });
}

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

async function addFullBleedImageSlide(pptx: any, url: string) {
  const s = pptx.addSlide();
  try {
    const dataUrl = await urlToDataUrl(url);
    s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } as any });
  } catch {/* ignore image issues */}
  return s;
}

function addTitleSlide(pptx: any, form: FormDataLike) {
  const s = pptx.addSlide();
  s.addText(
    [
      { text: form.projectName || "Project Selection", options: { fontSize: 30, bold: true } },
      { text: form.clientName ? `\nClient: ${form.clientName}` : "", options: { fontSize: 18 } },
      { text: form.contactName ? `\nPrepared by: ${form.contactName}` : "", options: { fontSize: 16 } },
      { text: form.email ? `\nEmail: ${form.email}` : "", options: { fontSize: 14 } },
      { text: form.phone ? `\nPhone: ${form.phone}` : "", options: { fontSize: 14 } },
      { text: form.date ? `\nDate: ${form.date}` : "", options: { fontSize: 14 } },
    ],
    { x: PAD, y: PAD, w: FULL_W - PAD*2, h: FULL_H - PAD*2 }
  );
  addFooter(s);
}

function addCategorySlide(pptx: any, category: string, pageNum: number) {
  const s = pptx.addSlide();
  // Simple band across slide for a clean section header (Bryant uses clear section dividers).
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 2.0, w: FULL_W, h: 1.2, fill: { color: "F3F4F6" }, line: { color: "F3F4F6" } });
  s.addText(category, { x: 0.6, y: 2.25, w: FULL_W - 1.2, h: 0.7, fontSize: 28, bold: true });
  addFooter(s, pageNum);
}

async function addProductSlide(pptx: any, p: Product, pageNum: number) {
  const s = pptx.addSlide();

  // Left image (contained)
  try {
    if (p.imageProxied) {
      const dataUrl = await urlToDataUrl(p.imageProxied);
      s.addImage({ data: dataUrl, ...IMG_BOX, sizing: { type: "contain", w: IMG_BOX.w, h: IMG_BOX.h } as any });
    }
  } catch {/* ignore */}

  // Right content
  s.addText((p.name ?? "—").trim(), { ...NAME_BOX, fontSize: 20, bold: true });
  if (p.code) s.addText(`SKU: ${p.code}`, { ...SKU_BOX, fontSize: 12 });

  const desc = clampChars(p.description ?? "", 450);
  if (desc) s.addText(desc, { ...DESC_BOX, fontSize: 12, valign: "top" });

  const specLines = (p.specsBullets && p.specsBullets.length) ? p.specsBullets : splitBullets(p.specsRaw);
  const specs = bulletsText(specLines ?? [], 6);
  if (specs) s.addText(specs, { ...SPEC_BOX, fontSize: 12, valign: "top" });

  // Links
  let linkY = LINK_BOX.y;
  if (p.url) {
    s.addText("Product page", { x: LINK_BOX.x, y: linkY, w: LINK_BOX.w, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    linkY += 0.35;
  }
  if (p.pdfUrl) {
    // Keep using your API pdf-proxy so the file opens reliably
    const pdf = `/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`;
    s.addText("Spec sheet (PDF)", { x: LINK_BOX.x, y: linkY, w: LINK_BOX.w, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: pdf } });
  }

  addFooter(s, pageNum);
}

type FormDataLike = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
};

// MAIN EXPORT FUNCTION
export async function exportPptxBryant(selectedProducts: Product[], form: FormDataLike) {
  if (!selectedProducts?.length) { alert("Select at least one product."); return; }
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  let pageNum = 1;

  // 1) Photo covers (2 bathroom images)
  for (const url of COVER_URLS) {
    await addFullBleedImageSlide(pptx, url);
    pageNum++;
  }

  // 2) Title slide with project/client/contact (like Bryant)
  addTitleSlide(pptx, form);
  pageNum++;

  // 3) Category sections + product slides
  const { order, map } = groupByCategory(selectedProducts);
  for (const cat of order) {
    addCategorySlide(pptx, cat, pageNum++);
    for (const p of map[cat]) {
      await addProductSlide(pptx, p, pageNum++);
    }
  }

  // 4) Back pages: Warranty (2-year) then Service Guarantee
  for (const url of BACK_URLS) {
    await addFullBleedImageSlide(pptx, url);
    pageNum++;
  }

  // File name
  const filename = `${(form.projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
