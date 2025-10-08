// src/lib/exportPptx.ts
import type { Product } from "../types";
import PptxGenJS from "pptxgenjs";

/* ---------- Types ---------- */
export type ExportArgs = {
  projectName?: string;
  clientName?: string;
  contactName?: string;  // shown as "Your contact"
  company?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
  coverImageUrls?: string[]; // background(s) for first slide (use [0])
  backImageUrls?: string[];  // extra back pages
};

/* ---------- Helpers ---------- */

// fetch URL -> data:URL (works for same-origin and proxied URLs)
async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("FileReader failed"));
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function fitIntoBox(
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const rImg = imgW / imgH;
  const rBox = w / h;
  let outW: number, outH: number;
  if (rImg >= rBox) {
    outW = w;
    outH = outW / rImg;
  } else {
    outH = h;
    outW = outH * rImg;
  }
  return { x: x + (w - outW) / 2, y: y + (h - outH) / 2, w: outW, h: outH };
}

async function getImageDims(dataUrl: string): Promise<{ w: number; h: number } | undefined> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((ok, err) => {
      img.onload = () => ok();
      img.onerror = () => err(new Error("image load error"));
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } catch { return undefined; }
}

async function addContainedImage(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number }
) {
  const dims = await getImageDims(dataUrl);
  if (!dims) {
    slide.addImage({ data: dataUrl, ...box } as any);
    return;
  }
  slide.addImage({ data: dataUrl, ...fitIntoBox(dims.w, dims.h, box.x, box.y, box.w, box.h) } as any);
}

/** Split text into likely bullet points */
function splitBullets(s: string): string[] {
  return s
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map(t => t.replace(/^[•\u2022\-–—]\s*/, "").trim())
    .filter(Boolean);
}

/** Keep first appearance of each (case-insensitive) */
function uniqueKeepOrder(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

/** Derive bullets from any likely field, not only `specsBullets`. */
function deriveBulletsFromProduct(p: any): string[] {
  // 1) Use explicit bullets when present
  if (Array.isArray(p.specsBullets) && p.specsBullets.length) {
    return uniqueKeepOrder(p.specsBullets.map(String)).slice(0, 8);
  }

  // 2) Look for fields that sound like specs/features
  const candidates: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    const key = String(k).toLowerCase();
    if (!/(spec|feature|bullet|point|highlight|detail|benefit)/.test(key)) continue;

    if (Array.isArray(v)) {
      for (const item of v) {
        const s = String(item || "").trim();
        if (s) candidates.push(s);
      }
    } else if (typeof v === "string") {
      candidates.push(...splitBullets(v));
    }
  }

  // 3) Fallback: carve bullets from description
  if (!candidates.length && typeof p.description === "string") {
    candidates.push(...splitBullets(p.description));
  }

  return uniqueKeepOrder(candidates).slice(0, 8);
}

/* ---------- Main ---------- */
export async function exportPptx({
  projectName = "Product Presentation",
  clientName = "",
  contactName = "",
  company = "",
  email = "",
  phone = "",
  date = "",
  items,
  coverImageUrls = ["/branding/cover.jpg"],
  backImageUrls = ["/branding/warranty.jpg", "/branding/service.jpg"],
}: ExportArgs) {
  const pptx = new PptxGenJS();

  /* COVER */
  const sCover = pptx.addSlide();
  try {
    const coverSrc = coverImageUrls[0];
    if (coverSrc) {
      const coverBg = await urlToDataUrl(coverSrc);
      if (coverBg) sCover.background = { data: coverBg };
    }
  } catch {}
  sCover.addText(projectName || "Product Presentation", {
    x: 0.5, y: 0.8, w: 9, h: 0.8, fontSize: 28, bold: true, color: "003366",
  });
  const lines: string[] = [];
  if (clientName) lines.push(`Client: ${clientName}`);
  if (contactName) lines.push(`Your contact: ${contactName}${company ? `, ${company}` : ""}`);
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Phone: ${phone}`);
  if (date) lines.push(`Date: ${date}`);
  if (lines.length) {
    sCover.addText(lines.join("\n"), {
      x: 0.5, y: 1.7, w: 9, h: 2.0, fontSize: 18, color: "333333", lineSpacing: 20,
    });
  }

  /* PRODUCT SLIDES */
  let anyBullets = false;

  for (const p of items) {
    const s = pptx.addSlide();

    // Title (top)
    s.addText(p.name || p.code || "Untitled Product", {
      x: 0.5, y: 0.35, w: 9.0, h: 0.6,
      fontSize: 26, bold: true, color: "003366",
    });

    // Two-column layout: image left, text right
    const IMG_BOX  = { x: 0.5, y: 1.05, w: 5.2, h: 3.9 };
    const RIGHT_X  = 6.0;
    const RIGHT_W  = 3.5;
    const DESC_BOX = { x: RIGHT_X, y: 1.05, w: RIGHT_W, h: 1.8 };
    const BUL_BOX  = { x: RIGHT_X, y: 2.95, w: RIGHT_W, h: 2.1 };

    // Image (prefer proxied)
    const imgUrl = (p as any).imageProxied || (p as any).imageUrl || (p as any).image;
    if (imgUrl) {
      try {
        const data = await urlToDataUrl(imgUrl);
        if (data) await addContainedImage(s, data, IMG_BOX);
      } catch {}
    }

    // Description (shrink to fit)
    if (p.description) {
      s.addText(p.description, {
        ...DESC_BOX,
        fontSize: 13,
        color: "444444",
        lineSpacing: 18,
        valign: "top",
        shrinkText: true,
      });
    }

    // Specs bullets (robust run-array form)
    const bullets = deriveBulletsFromProduct(p as any);
    if (bullets.length) {
      anyBullets = true;
      s.addText(
        bullets.map(text => ({ text, options: { bullet: true } })),
        {
          ...BUL_BOX,
          fontSize: 13,
          lineSpacing: 18,
          valign: "top",
          shrinkText: true,
          paraSpaceBefore: 0,
          paraSpaceAfter: 6,
        }
      );
    } else {
      s.addText("Specifications: n/a", {
        ...BUL_BOX,
        fontSize: 12,
        color: "888888",
        valign: "top",
      });
    }

    // Footer: code + spec link
    if (p.code) {
      s.addText(`Code: ${p.code}`, {
        x: 0.5, y: 5.25, w: 4.8, h: 0.3,
        fontSize: 12, color: "444444",
      });
    }
    if (p.pdfUrl) {
      s.addText("Spec Sheet (PDF)", {
        x: 6.0, y: 5.25, w: 3.5, h: 0.3,
        fontSize: 12, color: "1155CC", align: "right",
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  /* BACK PAGES */
  for (const url of backImageUrls) {
    const s = pptx.addSlide();
    try {
      const data = await urlToDataUrl(url);
      if (data) s.background = { data };
    } catch {}
  }

  /* DIAGNOSTICS (one slide if nothing produced bullets) */
  if (!anyBullets && items.length) {
    const s = pptx.addSlide();
    s.addText("Diagnostics — specs not detected", {
      x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 20, bold: true, color: "AA0000",
    });
    const sample = items.slice(0, 3).map((p, i) => {
      const keys = Object.keys(p as any);
      const preview = keys.slice(0, 20).join(", ");
      const b = deriveBulletsFromProduct(p as any);
      return `Item ${i + 1}: ${p.name || p.code}\nKeys: ${preview}\nDerived bullets: ${b.length}`;
    }).join("\n\n");
    s.addText(sample, { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 12, color: "333333" });
  }

  await pptx.writeFile({ fileName: `${projectName || "Product Selection"}.pptx` });
}
