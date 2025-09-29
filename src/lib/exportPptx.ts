import type PptxGenJS from "pptxgenjs";
import type { Product } from "../types";

// Slide size (pptxgenjs default 16:9)
const FULL_W = 10;
const FULL_H = 5.625;

// Where your brand images live (already in your repo)
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/** Convert a URL to a DataURL, with proxy + error handling */
async function urlToDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  const tries = [
    url,
    `/api/file-proxy?url=${encodeURIComponent(url)}`, // CORS-safe fallback
  ];
  for (const u of tries) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const blob = await res.blob();
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      if (typeof data === "string" && data.startsWith("data:image")) return data;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Normalize a “specs” field into bullet strings */
function normalizeBullets(specs?: string[] | string): string[] {
  const raw = Array.isArray(specs) ? specs.join("\n") : (specs || "");
  return raw
    .split(/[\r\n]+|[|;•]+|^\s*-\s*/g)        // split on newlines, pipes, semicolons, bullets, leading dashes
    .map(s => s.replace(/^\W+/, "").replace(/\W+$/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** If sheet "Name" accidentally contains a URL, fall back to code */
function displayName(p: Product): string {
  const n = (p.name || "").trim();
  if (/^https?:\/\//i.test(n)) return p.code || "—";
  return n || "—";
}

/** Left image / right text layout constants */
const IMG_BOX = { x: 0.5, y: 0.8, w: 5.6, h: 3.9 };
const TXT_X = 6.2;

type ExportArgs = {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  date?: string;
  items: Product[];
};

export async function exportPptx({
  projectName,
  clientName,
  contactName,
  email,
  phone,
  date,
  items,
}: ExportArgs) {
  // lazy import so it’s only pulled when you export
  const PptxGen = (await import("pptxgenjs")).default as typeof PptxGenJS;
  const pptx = new PptxGen();

  // ---------- COVER 1 (project + client) ----------
  await addCoverSlide(pptx, COVER_URLS[0], [
    { text: projectName || "Product Presentation", options: { fontSize: 28, bold: true } },
    { text: clientName ? `Client: ${clientName}` : "", options: { fontSize: 20 } },
  ]);

  // ---------- COVER 2 (contact details) ----------
  await addCoverSlide(pptx, COVER_URLS[1], [
    { text: contactName ? `Prepared by: ${contactName}` : "", options: { fontSize: 18 } },
    { text: email ? `Email: ${email}` : "", options: { fontSize: 16 } },
    { text: phone ? `Phone: ${phone}` : "", options: { fontSize: 16 } },
    { text: date ? `Date: ${date}` : "", options: { fontSize: 16 } },
  ]);

  // ---------- PRODUCT SLIDES ----------
  for (const p of items) {
    const s = pptx.addSlide();

    // image (contain, never stretched)
    const imgUrl = p.imageProxied || p.image || p.imageUrl;
    const dataUrl = await urlToDataUrl(imgUrl);
    if (dataUrl) {
      s.addImage({
        data: dataUrl,
        ...IMG_BOX,
        sizing: { type: "contain", w: IMG_BOX.w, h: IMG_BOX.h } as any,
      });
    }

    // title + SKU
    s.addText(displayName(p), {
      x: TXT_X,
      y: 0.7,
      w: 3.8,
      h: 0.6,
      fontSize: 20,
      bold: true,
    });
    if (p.code) {
      s.addText(`SKU: ${p.code}`, { x: TXT_X, y: 1.4, w: 3.8, h: 0.35, fontSize: 12 });
    }

    // description + specs (auto shrink to fit; real bullets)
    const bullets = normalizeBullets(p.specsBullets);
    const combined = [
      (p.description || "").trim(),
      bullets.length ? bullets.map(b => `• ${b}`).join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    s.addText(combined || " ", {
      x: TXT_X,
      y: 1.9,
      w: 3.8,
      h: 3.7,
      fontSize: 12,
      shrinkText: true,
      valign: "top",
    } as any);

    // links
    const linkY = 5.85;
    let y = linkY;
    if (p.url) {
      s.addText("Product page", {
        x: TXT_X,
        y,
        w: 3.8,
        h: 0.35,
        fontSize: 12,
        underline: true,
        hyperlink: { url: p.url },
      });
      y += 0.4;
    }
    if (p.pdfUrl) {
      const pdf = p.pdfUrl.startsWith("/specs/")
        ? p.pdfUrl
        : `/api/file-proxy?url=${encodeURIComponent(p.pdfUrl)}`;
      s.addText("Spec sheet (PDF)", {
        x: TXT_X,
        y,
        w: 3.8,
        h: 0.35,
        fontSize: 12,
        underline: true,
        hyperlink: { url: pdf },
      });
      y += 0.4;
    }

    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: TXT_X,
        y,
        w: 3.8,
        h: 0.35,
        fontSize: 11,
        color: "666666",
      });
    }
  }

  // ---------- BACK PAGES ----------
  for (const url of BACK_URLS) {
    await addCoverSlide(pptx, url, []); // full-bleed image only
  }

  const fname = `${(projectName || "Product_Presentation").replace(/[^\w\-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: fname });
}

/** Full-bleed image with a soft bottom overlay for text */
async function addCoverSlide(
  pptx: PptxGenJS,
  imageUrl: string,
  lines: { text: string; options?: PptxGenJS.TextPropsOptions }[]
) {
  const s = pptx.addSlide();
  const bg = await urlToDataUrl(imageUrl);
  if (bg) {
    s.addImage({
      data: bg,
      x: 0,
      y: 0,
      w: FULL_W,
      h: FULL_H,
      sizing: { type: "cover", w: FULL_W, h: FULL_H } as any,
    });
  }
  if (lines.some(l => l.text)) {
    // translucent band for legibility
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: FULL_H - 1.7,
      w: FULL_W,
      h: 1.7,
      fill: { color: "000000", transparency: 50 },
      line: "none",
    });
    s.addText(
      lines.filter(l => l.text).map(l => ({
        text: l.text,
        options: { color: "FFFFFF", breakLine: true, ...l.options },
      })),
      { x: 0.6, y: FULL_H - 1.55, w: FULL_W - 1.2, h: 1.4 }
    );
  }
}
