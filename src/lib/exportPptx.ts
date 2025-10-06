// src/lib/exportPptx.ts
import type { Product } from "../types";
import PptxGenJS from "pptxgenjs";

const FULL_W = 10;
const FULL_H = 5.625;

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
  coverImageUrls?: string[]; // background(s) for first slide (use [0])
  backImageUrls?: string[];  // extra back pages
};

/* ---------- Helpers ---------- */

// fetch URL -> data:URL
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

// center-fit image into a box
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
  const outX = x + (w - outW) / 2;
  const outY = y + (h - outH) / 2;
  return { x: outX, y: outY, w: outW, h: outH };
}

// probe intrinsic size of an image data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number } | undefined> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((ok, err) => {
      img.onload = () => ok();
      img.onerror = () => err(new Error("image load error"));
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return undefined;
  }
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
  const rect = fitIntoBox(dims.w, dims.h, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// try to guess a preview beside the PDF in /public/specs
function guessPreviewFromPdf(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  const last = pdfUrl.split("/").pop() || "";
  const base = last.replace(/\.pdf(\?.*)?$/i, "");
  if (!base) return;
  const stems = [base, base.replace(/\s+/g, "_"), base.replace(/\s+/g, "")];
  const exts = ["png", "jpg", "jpeg", "webp"];
  // we’ll try loading the first candidate that succeeds
  for (const s of stems) for (const e of exts) return `/specs/${s}.${e}`;
  return;
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
  const contactLines: string[] = [];
  if (clientName) contactLines.push(`Client: ${clientName}`);
  if (contactName) contactLines.push(`Contact: ${contactName}${company ? `, ${company}` : ""}`);
  if (email) contactLines.push(`Email: ${email}`);
  if (phone) contactLines.push(`Phone: ${phone}`);
  if (date) contactLines.push(`Date: ${date}`);
  if (contactLines.length) {
    sCover.addText(contactLines.join("\n"), {
      x: 0.5, y: 1.7, w: 9, h: 2.0, fontSize: 18, color: "333333", lineSpacing: 20,
    });
  }

  /* PRODUCT SLIDES */
  for (const p of items) {
    const s = pptx.addSlide();

    // 1) image (top area)
    const imgUrl = p.imageProxied || p.imageUrl || p.image;
    if (imgUrl) {
      try {
        const imgData = await urlToDataUrl(imgUrl);
        if (imgData) {
          await addContainedImage(s, imgData, { x: 0.5, y: 0.5, w: 9.0, h: 3.2 });
        }
      } catch {}
    }

    // 2) title + code
    s.addText(p.name || p.code || "Untitled Product", {
      x: 0.5, y: 3.9, w: 9.0, h: 0.6, fontSize: 24, bold: true, color: "003366",
    });
    if (p.code) {
      s.addText(`Code: ${p.code}`, {
        x: 0.5, y: 4.55, w: 9.0, h: 0.4, fontSize: 14, color: "444444",
      });
    }

    // 3) description (left column)
    if (p.description) {
      s.addText(p.description, {
        x: 0.5, y: 5.05, w: 5.2, h: 1.3,
        fontSize: 14, color: "444444",
        lineSpacing: 20, valign: "top", shrinkText: true,
      });
    }

    // 4) bullets (right column) – real bullets
    if (p.specsBullets && p.specsBullets.length) {
      s.addText(p.specsBullets.slice(0, 6), {
        x: 5.9, y: 5.05, w: 3.6, h: 1.3,
        fontSize: 14, bullet: true, lineSpacing: 20, valign: "top",
      });
    }

    // 5) spec link
    if (p.pdfUrl) {
      s.addText("Spec Sheet (PDF)", {
        x: 0.5, y: 6.45, w: 3.0, h: 0.35,
        fontSize: 12, color: "1155CC",
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  /* SPEC SLIDES (optional preview next to PDF) */
  for (const p of items) {
    if (!p.pdfUrl) continue;
    const s = pptx.addSlide();
    s.addText(`${p.name || p.code || "—"} — Specifications`, {
      x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 24, bold: true,
    });

    let added = false;
    const previewGuess = guessPreviewFromPdf(p.pdfUrl);
    if (previewGuess) {
      try {
        const data = await urlToDataUrl(previewGuess);
        if (data) {
          await addContainedImage(s, data, { x: 0.25, y: 1.1, w: 9.5, h: 4.25 });
          added = true;
        }
      } catch {}
    }

    if (!added) {
      s.addText(
        "Preview image not found. Add a PNG/JPG next to the PDF in /public/specs with the same filename.",
        { x: 0.6, y: 2.2, w: 8.8, h: 1.0, fontSize: 16, color: "888888" }
      );
    }

    s.addText("Open Spec PDF", {
      x: 0.5, y: 5.6, w: 2.2, h: 0.4, fontSize: 14, color: "1155CC",
      hyperlink: { url: p.pdfUrl },
    });
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
