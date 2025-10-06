// src/lib/exportPptx.ts
import type { Product } from "../types";
import PptxGenJS from "pptxgenjs";

const FULL_W = 10;
const FULL_H = 5.625;

const COVER_URL = "/branding/cover.jpg";
const BACK_URLS = ["/branding/warranty.jpg", "/branding/service.jpg"];

// helper: convert URL -> dataURL
async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
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

export async function exportPptx({
  projectName,
  clientName,
  contactName,
  email,
  phone,
  date,
  items,
}: {
  projectName: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
}) {
  const pptx = new PptxGenJS();

  /* ---------- COVER ---------- */
  const cover = pptx.addSlide();
  try {
    const coverBg = await urlToDataUrl(COVER_URL);
    if (coverBg) cover.background = { data: coverBg };
  } catch {}
  cover.addText(projectName, {
    x: 0.5,
    y: 0.8,
    w: 9,
    fontSize: 28,
    bold: true,
    color: "003366",
  });
  if (clientName)
    cover.addText(`Client: ${clientName}`, { x: 0.5, y: 1.5, w: 9, fontSize: 18 });
  if (contactName)
    cover.addText(`Contact: ${contactName}`, { x: 0.5, y: 2.0, w: 9, fontSize: 18 });
  if (email)
    cover.addText(`Email: ${email}`, { x: 0.5, y: 2.5, w: 9, fontSize: 18 });
  if (phone)
    cover.addText(`Phone: ${phone}`, { x: 0.5, y: 3.0, w: 9, fontSize: 18 });
  if (date)
    cover.addText(`Date: ${date}`, { x: 0.5, y: 3.5, w: 9, fontSize: 18 });

  /* ---------- PRODUCT SLIDES ---------- */
  for (const p of items) {
    const slide = pptx.addSlide();

    // image
    const imgUrl =
      p.imageProxied || p.imageUrl || p.image || undefined;
    if (imgUrl) {
      try {
        const dataUrl = await urlToDataUrl(imgUrl);
        if (dataUrl)
          slide.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: 3.5 });
      } catch {}
    }

    // product info
    slide.addText(p.name || p.code || "Untitled Product", {
      x: 0.5,
      y: 3.6,
      w: 9,
      fontSize: 22,
      bold: true,
      color: "003366",
    });

    if (p.code)
      slide.addText(`Code: ${p.code}`, { x: 0.5, y: 4.1, w: 9, fontSize: 16 });
    if (p.description)
      slide.addText(p.description, {
        x: 0.5,
        y: 4.5,
        w: 9,
        fontSize: 14,
        color: "444",
      });

    if (p.specsBullets?.length) {
      const bullets = p.specsBullets.slice(0, 4).map((s) => `• ${s}`).join("\n");
      slide.addText(bullets, { x: 0.5, y: 5.0, w: 9, fontSize: 14 });
    }

    if (p.pdfUrl)
      slide.addText(`Spec Sheet: ${p.pdfUrl}`, {
        x: 0.5,
        y: 5.7,
        w: 9,
        fontSize: 12,
        color: "0000EE",
        hyperlink: { url: p.pdfUrl },
      });
  }

  /* ---------- BACK SLIDES ---------- */
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const data = await urlToDataUrl(url);
      if (data) s.background = { data };
    } catch {}
  }

  await pptx.writeFile({ fileName: `${projectName || "Product Selection"}.pptx` });
}
