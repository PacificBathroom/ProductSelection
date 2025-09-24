import type { Product } from "../types";

// Slide size (pptxgenjs default 16:9)
const FULL_W = 10;
const FULL_H = 5.625;
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// --- helpers ---
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise(res => { const r = new FileReader(); r.onloadend = () => res(String(r.result)); r.readAsDataURL(b); });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

type HeaderInfo = {
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
};

function overlayText(h: HeaderInfo) {
  return [
    { text: (h.projectName || "Project Selection") + "\n", options: { fontSize: 30, bold: true } },
    { text: h.clientName  ? `Client: ${h.clientName}\n` : "", options: { fontSize: 18 } },
    { text: h.contactName ? `Prepared by: ${h.contactName}\n` : "", options: { fontSize: 16 } },
    { text: h.email       ? `Email: ${h.email}\n` : "", options: { fontSize: 14 } },
    { text: h.phone       ? `Phone: ${h.phone}\n` : "", options: { fontSize: 14 } },
    { text: h.date        ? `Date: ${h.date}` : "", options: { fontSize: 14 } },
  ];
}

// full-bleed background image WITHOUT stretching (keeps aspect)
async function addFullImageSlide(pptx: any, url: string) {
  const s = pptx.addSlide();
  try {
    const dataUrl = await urlToDataUrl(url);
    s.addImage({
      data: dataUrl,
      x: 0, y: 0, w: FULL_W, h: FULL_H,
      sizing: { type: "contain", w: FULL_W, h: FULL_H } as any, // contain => no distortion
    });
  } catch {}
  return s;
}

export async function exportSelectionToPptx(selected: Product[], header: HeaderInfo) {
  if (!selected.length) {
    alert("Select at least one product.");
    return;
  }

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // --- 1) Covers: two photos + text overlay on each ---
  for (const url of COVER_URLS) {
    const s = await addFullImageSlide(pptx, url);
    s.addText(overlayText(header), {
      x: 0.6, y: 0.6, w: 8.8, h: 2.6,
      fill: { color: "FFFFFF" }, line: { color: "FFFFFF" }, // readable panel
    });
  }

  // --- 2) Product slides ---
  for (const p of selected) {
    const s = pptx.addSlide();

    // image (no stretching)
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: dataUrl,
          x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 } as any,
        });
      }
    } catch {}

    // left texts
    const name = (p.name ?? "").trim() || "—";
    const sku  = p.code ? `SKU: ${p.code}` : "";

    const desc = (p.description ?? "").trim();
    const descShort = desc.length > 600 ? desc.slice(0, 600) + "…" : desc;

    const specs = (p.specsBullets ?? []).map(s => s.replace(/^[-•\u2022]\s*/, "")).filter(Boolean);
    const specsText = specs.slice(0, 8).map(b => `• ${b}`).join("\n");

    s.addText(name, { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (sku) s.addText(sku, { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });

    // description block
    if (descShort) {
      s.addText(descShort, { x: 6.2, y: 1.9, w: 6.2, h: 1.3, fontSize: 12 });
    }

    // specs block
    if (specsText) {
      s.addText(specsText, { x: 6.2, y: 3.3, w: 6.2, h: 2.0, fontSize: 12 });
    }

    // links
    let linkY = 5.5;
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true, hyperlink: { url: p.url },
      });
      linkY += 0.4;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 12, underline: true,
        hyperlink: { url: p.pdfUrl },
      });
      linkY += 0.4;
    }

    if (p.category) {
      s.addText(`Category: ${p.category}`, { x: 6.2, y: linkY, w: 6.2, h: 0.35, fontSize: 11 });
    }
  }

  // --- 3) Back pages: warranty then service ---
  for (const url of BACK_URLS) {
    await addFullImageSlide(pptx, url);
  }

  const filename = `${(header.projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
