import type { Product } from "../types";

// 16:9 default in pptxgenjs (inches)
const FULL_W = 10;
const FULL_H = 5.625;

// Public images in /public/branding/...
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

// Helpers to embed images
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => {
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

// Join description + bullets into wrapped text
function buildSpecsText(p: Product): { title: string; lines: string[] } {
  const title = (p.name ?? p.code ?? "—").trim() || "—";

  const out: string[] = [];
  if (p.description) out.push(p.description);

  if (p.specsBullets && p.specsBullets.length) {
    // prepend bullets only if they are not already bullet-ish
    const bullets = p.specsBullets.map((s) => s.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
    if (bullets.length) {
      out.push("• " + bullets.join("\n• "));
    }
  }

  if (p.category) out.push(`\nCategory: ${p.category}`);
  return { title, lines: out };
}

export async function exportPptx(opts: {
  items: Product[];
  projectName: string;
  clientName: string;
  contactName: string;
  email: string;
  phone: string;
  date: string;
}) {
  if (!opts.items?.length) {
    alert("Select at least one product.");
    return;
  }

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ---------- Covers (two photos, both with overlay text) ----------
  const overlayRuns = [
    { text: opts.projectName || "Project Selection", options: { fontSize: 30, bold: true, color: "FFFFFF" } },
    { text: opts.clientName  ? `\nClient: ${opts.clientName}` : "",   options: { fontSize: 18, color: "FFFFFF" } },
    { text: opts.contactName ? `\nPrepared by: ${opts.contactName}` : "", options: { fontSize: 16, color: "FFFFFF" } },
    { text: opts.email       ? `\nEmail: ${opts.email}` : "",        options: { fontSize: 14, color: "FFFFFF" } },
    { text: opts.phone       ? `\nPhone: ${opts.phone}` : "",        options: { fontSize: 14, color: "FFFFFF" } },
    { text: opts.date        ? `\nDate: ${opts.date}` : "",          options: { fontSize: 14, color: "FFFFFF" } },
  ];

  for (const url of COVER_URLS) {
    const s = pptx.addSlide();
    try {
      const dataUrl = await urlToDataUrl(url);
      // full-bleed image, not stretched
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch { /* ignore */ }
    // dark band + white overlay text (bottom)
    s.addText(overlayRuns, {
      x: 0.5, y: FULL_H - 1.9, w: FULL_W - 1.0, h: 1.6,
      align: "left",
      fill: { color: "000000" }, // black background behind the text
      color: "FFFFFF",
      bold: true,
    });
  }

  // ---------- Product slides ----------
  for (const p of opts.items) {
    const s = pptx.addSlide();

    // left: image (contain to avoid stretch)
    if (p.imageProxied) {
      try {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data: dataUrl,
          x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 },
        } as any);
      } catch { /* ignore */ }
    }

    const { title, lines } = buildSpecsText(p);

    // right: title + sku
    s.addText(title, { x: 6.2, y: 0.7, w: 3.8, h: 0.7, fontSize: 20, bold: true, color: "222222" });
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.35, w: 3.8, h: 0.4, fontSize: 12, color: "444444" });
    }

    // right: description/specs block, wrapped & compact
    if (lines.length) {
      s.addText(lines.join("\n"), {
        x: 6.2, y: 1.8, w: 3.8, h: 3.9,
        fontSize: 12,
        color: "222222",
        // Helps large blobs fit better (pptxgenjs option)
        shrinkText: true,
      } as any);
    }

    // links row
    const linkY = 5.9;
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y: linkY, w: 3.8, h: 0.35, fontSize: 12,
        underline: true,
        hyperlink: { url: p.url },
        color: "1155CC",
      });
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY + 0.35, w: 3.8, h: 0.35, fontSize: 12,
        underline: true,
        // use your pdf proxy so it always downloads/opens reliably
        hyperlink: { url: `/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}` },
        color: "1155CC",
      });
    }
  }

  // ---------- Back pages ----------
  for (const url of BACK_URLS) {
    const s = pptx.addSlide();
    try {
      const dataUrl = await urlToDataUrl(url);
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch { /* ignore */ }
  }

  const safe = (opts.projectName || "Selection").replace(/[^\w-]+/g, "_");
  await pptx.writeFile({ fileName: `${safe}.pptx` });
}
