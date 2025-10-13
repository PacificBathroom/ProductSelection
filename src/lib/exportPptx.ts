// src/lib/exportPptx.ts
import type { Product } from "../types";
import PptxGenJS from "pptxgenjs";

/* ---------- Types ---------- */
export type ExportArgs = {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  company?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
  coverImageUrls?: string[];
  backImageUrls?: string[];
};

/* ---------- Helpers ---------- */

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
  imgW: number, imgH: number,
  x: number, y: number, w: number, h: number
) {
  const rImg = imgW / imgH;
  const rBox = w / h;
  let outW: number, outH: number;
  if (rImg >= rBox) { outW = w; outH = outW / rImg; }
  else { outH = h; outW = outH * rImg; }
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

function splitBullets(s: string): string[] {
  return (s || "")
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map(t => t.replace(/^[•\u2022\-–—]\s*/, "").trim())
    .filter(Boolean);
}

function uniqueKeepOrder(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

function deriveBulletsFromProduct(p: any, opts: { allowFromDescription?: boolean } = {}): string[] {
  const { allowFromDescription = false } = opts;

  if (Array.isArray(p.specsBullets) && p.specsBullets.length) {
    return uniqueKeepOrder(p.specsBullets.map(String)).slice(0, 8);
  }

  const candidates: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
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

  if (!candidates.length && allowFromDescription && typeof p.description === "string") {
    candidates.push(...splitBullets(p.description));
  }

  return uniqueKeepOrder(candidates).slice(0, 8);
}


/** Try to find a SPEC image (technical drawing) for a product. */
function findSpecImageUrl(p: any): string | undefined {
  // 1) explicit fields if present
  const explicit =
    p.specImage || p.specImg || p.specsImageUrl || p.specsImg ||
    p.specDrawing || p.drawing || p.techDrawing;
  if (explicit) return String(explicit);

  // 2) file by SKU/code in /public/specs
  const code = (p.code || "").toString().trim();
  if (code) {
    const exts = ["png", "jpg", "jpeg", "webp", "svg"];
    // return first candidate (the loader will fail gracefully if not found)
    return `/specs/${code}.${exts[0]}`;
  }

  // 3) file by PDF name in /public/specs
  if (p.pdfUrl) {
    const last = String(p.pdfUrl).split("/").pop() || "";
    const base = last.replace(/\.pdf(\?.*)?$/i, "");
    if (base) return `/specs/${base}.png`;
  }

  return undefined;
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

  /* PRODUCT + SPEC slides (pair per item) */
  for (const p of items) {
    // ---------- Product slide ----------
    const s = pptx.addSlide();

    s.addText(p.name || p.code || "Untitled Product", {
      x: 0.5, y: 0.35, w: 9.0, h: 0.6, fontSize: 26, bold: true, color: "003366",
    });

    const IMG_BOX  = { x: 0.5, y: 1.05, w: 5.2, h: 3.9 };
    const RIGHT_X  = 6.0;
    const RIGHT_W  = 3.5;
    const DESC_BOX = { x: RIGHT_X, y: 1.05, w: RIGHT_W, h: 1.8 };
    const BUL_BOX  = { x: RIGHT_X, y: 2.95, w: RIGHT_W, h: 2.1 };

    const imgUrl = (p as any).imageProxied || (p as any).imageUrl || (p as any).image;
    if (imgUrl) {
      try {
        const data = await urlToDataUrl(imgUrl);
        if (data) await addContainedImage(s, data, IMG_BOX);
      } catch {}
    }

 // --- existing ---
if (p.description) {
  s.addText(p.description, {
    ...DESC_BOX,
    fontSize: 13, color: "444444", lineSpacing: 18, valign: "top", shrinkText: true,
  });
}

// Derive bullets, but do NOT use description as a source on the product slide
const bullets = deriveBulletsFromProduct(p as any, { allowFromDescription: false });

// Skip bullets if they collapse to the same text as the description
const normalize = (t?: string) => (t || "").replace(/\s+/g, " ").trim().toLowerCase();
if (
  bullets.length &&
  normalize(bullets.join(" ")) !== normalize(p.description)
) {
  const runs = bullets.map(text => ({ text, options: { bullet: true } }));
  s.addText(runs, { ...BUL_BOX, fontSize: 13, lineSpacing: 18, valign: "top", shrinkText: true });
}


    if (p.code) {
      s.addText(`Code: ${p.code}`, { x: 0.5, y: 5.25, w: 4.8, h: 0.3, fontSize: 12, color: "444444" });
    }
    if (p.pdfUrl) {
      s.addText("Spec Sheet (PDF)", {
        x: 6.0, y: 5.25, w: 3.5, h: 0.3, fontSize: 12, color: "1155CC", align: "right",
        hyperlink: { url: p.pdfUrl },
      });
    }

    // ---------- Spec slide (right after product) ----------
    const specSlide = pptx.addSlide();
    specSlide.addText(`${p.name || p.code || "—"} — Specifications`, {
      x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 28, bold: true, color: "0A3A6E",
    });

    const specUrl = findSpecImageUrl(p as any);
    let specAdded = false;

    if (specUrl) {
      try {
        const data = await urlToDataUrl(specUrl);
        if (data) {
          await addContainedImage(specSlide, data, { x: 0.8, y: 1.3, w: 8.6, h: 3.8 });
          specAdded = true;
        }
      } catch {}
    }

    if (!specAdded) {
      // fall back to the product image but clearly label it; this makes the issue visible
      const fallback = imgUrl;
      if (fallback) {
        const data = await urlToDataUrl(fallback);
        if (data) await addContainedImage(specSlide, data, { x: 0.8, y: 1.3, w: 8.6, h: 3.8 });
      }
      specSlide.addText(
        "Spec drawing not found. Place an image at /public/specs/<SKU>.png (or .jpg/.webp).",
        { x: 0.8, y: 5.3, w: 8.6, h: 0.8, fontSize: 14, color: "AA0000", align: "center" }
      );
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

  await pptx.writeFile({ fileName: `${projectName || "Product Selection"}.pptx` });
}
