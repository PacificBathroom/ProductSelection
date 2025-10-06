// exportPptx.ts — complete, drop-in replacement
// PptxGenJS-powered export with:
//  • Robust image loading (handles CORS via /api/img.js proxy)
//  • Cover slide populated from current app inputs
//  • Product slides w/ bullets + category + warranties
//  • Optional back pages (warranty/service)
//  • No "X products selected" text anywhere
//  • Defensive sizing for all images so blanks don’t occur
//
// Usage (example):
//   import { exportSelectionPptx } from "./exportPptx";
//   await exportSelectionPptx(productsArray, {
//     projectName: form.projectName,
//     clientName: form.clientName,
//     siteAddress: form.siteAddress,
//     preparedFor: form.preparedFor,
//     preparedBy: form.preparedBy,
//     contactName: form.contactName,
//     contactPhone: form.contactPhone,
//     contactEmail: form.contactEmail,
//     brandLogoUrl: "/branding/logo.png",
//     coverImageUrls: ["/branding/cover.jpg"],
//     backImageUrls: ["/branding/warranty.jpg", "/branding/service.jpg"],
//   });

import PptxGenJS from "pptxgenjs";

/* ----------------------------- Types ------------------------------ */
export type Product = {
  name: string;
  sku?: string;
  description?: string; // multi-line bullets allowed
  bullets?: string[];   // alt bullets (if provided, takes precedence)
  image?: string;       // primary image url
  image2?: string;      // optional extra image
  categoryPath?: string; // e.g. "Bathrooms > Accessories > ..."
  warrantyFinish?: string; // e.g. "20 years replacement warranty on finishes"
  warrantyLabour?: string; // e.g. "2 years on labour"
  specs?: string;        // optional specs text
};

export type ExportOptions = {
  // Cover fields from the app inputs
  projectName?: string;
  clientName?: string;
  siteAddress?: string;
  preparedFor?: string;
  preparedBy?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  brandLogoUrl?: string;
  coverImageUrls?: string[]; // background images for cover (first existing used)
  backImageUrls?: string[];  // optional final pages (warranty / service)
  fileName?: string;         // optional override
};

/* --------------------------- Constants --------------------------- */
const FULL_W = 10;      // 16:9 width (in)
const FULL_H = 5.625;   // 16:9 height (in)

// Product image frame
const IMG_X = 0.6;
const IMG_Y = 1.0;
const IMG_W = 3.8;
const IMG_H = 3.8;

/* ------------------------ Helper functions ----------------------- */

// Prefer local/same-origin when possible. Anything else is proxied via /api/img.js.
function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, window.location.origin);
    // If same-origin path we can use directly; else go through proxy.
    if (u.origin === window.location.origin) return u.toString();
    return `/api/img.js?u=${encodeURIComponent(u.toString())}`;
  } catch {
    // If it's a bare path like "/img/a.jpg" just return it
    if (url.startsWith("/")) return url;
    // As a last resort, proxy whatever string we were given
    return `/api/img.js?u=${encodeURIComponent(url)}`;
  }
}

// Fetch any URL (local or proxied) into a data URL.
async function urlToDataUrl(url?: string): Promise<string | undefined> {
  const norm = normalizeImageUrl(url);
  if (!norm) return undefined;
  const res = await fetch(norm);
  if (!res.ok) return undefined;
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("FileReader error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// Read natural (pixel) dimensions from a data URL, so we can preserve aspect.
function getImageDims(dataUrl: string): Promise<{ w: number; h: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

function splitBullets(v?: string | string[]): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(/\r?\n|•/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeText(v?: string, fallback = ""): string {
  return (v ?? fallback).toString();
}

function fileNameFrom(options: ExportOptions): string {
  const parts = [
    "Selection",
    options.projectName,
    options.clientName,
  ].filter(Boolean) as string[];
  const base = parts.join(" - ") || "Selection";
  return `${base}.pptx`;
}

/* ---------------------------- Slides ----------------------------- */

async function addCoverSlide(pptx: PptxGenJS, opt: ExportOptions) {
  const slide = pptx.addSlide();

  // Background image (first that loads)
  const coverBg = opt.coverImageUrls?.[0];
  const coverData = await urlToDataUrl(coverBg);
  if (coverData) {
    slide.addImage({ data: coverData, x: 0, y: 0, w: FULL_W, h: FULL_H });
  } else {
    // fallback block color
    slide.background = { color: "FFFFFF" };
  }

  // Brand logo (optional, top-right)
  const logoData = await urlToDataUrl(opt.brandLogoUrl);
  if (logoData) {
    slide.addImage({ data: logoData, x: FULL_W - 2.0, y: 0.25, w: 1.5, h: 1.0, maintainAspectRatio: true });
  }

  // Headline (Project / Client)
  const headline = [opt.projectName, opt.clientName].filter(Boolean).join(" — ");
  slide.addText(headline || "Product Selection", {
    x: 0.6, y: 0.6, w: FULL_W - 1.2, h: 0.8,
    fontSize: 28, bold: true, color: "203040",
  });

  // Details block
  const lines: string[] = [];
  if (opt.siteAddress) lines.push(`Site: ${opt.siteAddress}`);
  if (opt.preparedFor) lines.push(`Prepared for: ${opt.preparedFor}`);
  if (opt.preparedBy) lines.push(`Prepared by: ${opt.preparedBy}`);
  if (opt.contactName) lines.push(`Contact: ${opt.contactName}`);
  if (opt.contactPhone) lines.push(`Phone: ${opt.contactPhone}`);
  if (opt.contactEmail) lines.push(`Email: ${opt.contactEmail}`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);

  slide.addText(lines.join("\n"), {
    x: 0.6, y: 1.6, w: FULL_W - 1.2, h: 2.0,
    fontSize: 14, color: "203040",
  });
}

async function addProductSlide(pptx: PptxGenJS, p: Product) {
  const slide = pptx.addSlide();

  // Title
  slide.addText(safeText(p.name, "Unnamed Product"), {
    x: 0.6, y: 0.4, w: FULL_W - 1.2, h: 0.5,
    fontSize: 20, bold: true, color: "000000",
  });

  // SKU
  if (p.sku) {
    slide.addText(`SKU: ${p.sku}`, { x: 0.6, y: 0.9, w: FULL_W - 1.2, h: 0.3, fontSize: 12, color: "555555" });
  }

  // Images (up to 2) — contain within fixed frame, maintain aspect ratio
  const imgUrls = [p.image, p.image2].map(normalizeImageUrl).filter(Boolean) as string[];
  let placedAny = false;
  for (let i = 0; i < imgUrls.length; i++) {
    const data = await urlToDataUrl(imgUrls[i]);
    if (!data) continue;
    const dims = await getImageDims(data);
    // contain fit
    let w = IMG_W, h = IMG_H, x = IMG_X, y = IMG_Y;
    if (dims && dims.w && dims.h) {
      const rFrame = IMG_W / IMG_H;
      const rImg = dims.w / dims.h;
      if (rImg >= rFrame) {
        // image is wider -> full width, shrink height
        w = IMG_W; h = IMG_W / rImg; y = IMG_Y + (IMG_H - h) / 2;
      } else {
        // image is taller -> full height, shrink width
        h = IMG_H; w = IMG_H * rImg; x = IMG_X + (IMG_W - w) / 2;
      }
    }
    slide.addImage({ data, x, y, w, h });
    placedAny = true;
    // place second image to the right half if two provided
    if (i === 0 && imgUrls.length > 1) {
      // shift frame to the right for second image
      (globalThis as any)._exportPptx_nextImgPos = { x: IMG_X + IMG_W + 0.5, y: IMG_Y };
    }
    if (i === 1 && (globalThis as any)._exportPptx_nextImgPos) {
      // reset for next slide
      (globalThis as any)._exportPptx_nextImgPos = undefined;
    }
  }

  // Description bullets (prefer p.bullets else split description)
  const bullets = p.bullets && p.bullets.length > 0 ? p.bullets : splitBullets(p.description);
  if (bullets.length) {
    slide.addText(bullets.map((t) => `• ${t}`).join("\n"), {
      x: placedAny ? IMG_X + IMG_W + 0.6 : 0.6,
      y: 1.2,
      w: placedAny ? FULL_W - (IMG_X + IMG_W + 1.2) : FULL_W - 1.2,
      h: 2.6,
      fontSize: 14,
      color: "000000",
    });
  }

  // Category path & warranties
  const metaLines: string[] = [];
  if (p.categoryPath) metaLines.push(`Category: ${p.categoryPath}`);
  if (p.warrantyFinish) metaLines.push(p.warrantyFinish);
  if (p.warrantyLabour) metaLines.push(p.warrantyLabour);
  if (p.specs) metaLines.push(p.specs);

  if (metaLines.length) {
    slide.addText(metaLines.join("\n"), {
      x: 0.6, y: FULL_H - 1.5, w: FULL_W - 1.2, h: 1.0,
      fontSize: 10, color: "444444",
    });
  }
}

async function addBackSlides(pptx: PptxGenJS, urls: string[] | undefined) {
  if (!urls?.length) return;
  for (const u of urls) {
    const data = await urlToDataUrl(u);
    const s = pptx.addSlide();
    if (data) {
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H });
    }
  }
}

/* ----------------------------- Export ---------------------------- */

export async function exportSelectionPptx(products: Product[], options: ExportOptions = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  await addCoverSlide(pptx, options);

  for (const p of products) {
    await addProductSlide(pptx, p);
  }

  await addBackSlides(pptx, options.backImageUrls);

  const name = options.fileName || fileNameFrom(options);
  await pptx.writeFile({ fileName: name });
}
