// src/lib/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;          // 16:9 width (in)
const FULL_H = 5.625;       // 16:9 height (in)

const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* ---------------------- helpers ---------------------- */

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// naive word-wrapping + clamping with ellipsis
function wrapAndClamp(text = "", maxLines: number, maxCharsPerLine: number): string {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxCharsPerLine) {
      cur = (cur ? cur + " " : "") + w;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  // ellipsis if we dropped words
  const used = lines.join(" ").length;
  const total = words.join(" ").length;
  if (total > used) {
    const last = lines[lines.length - 1] || "";
    lines[lines.length - 1] = last.length > 1 ? last.replace(/.{0,3}$/, "…") : "…";
  }
  return lines.join("\n");
}

function clampBullets(bullets: string[], maxBullets: number, maxCharsEach: number): string[] {
  return (bullets || [])
    .filter(Boolean)
    .map(b => b.replace(/^[•\-\u2022\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, maxBullets)
    .map(b => (b.length > maxCharsEach ? b.slice(0, maxCharsEach - 1) + "…" : b));
}

// Try to pull bullets from (1) sheet, (2) src/lib/specs.ts, (3) a sibling .txt next to /public/specs/XYZ.pdf
async function resolveBullets(p: Product): Promise<string[]> {
  // (1) direct from sheet
  if (p.specsBullets && p.specsBullets.length) return p.specsBullets;

  // (2) mapping in repo
  try {
    const mod: any = await import("./specs");
    if (typeof mod.bulletsFor === "function") {
      const fromMap = mod.bulletsFor(p);
      if (Array.isArray(fromMap) && fromMap.length) return fromMap;
    }
  } catch { /* mapping not present – ok */ }

  // (3) /public/specs/NAME.txt (one bullet per line)
  //     If p.pdfUrl looks like /specs/NAME.pdf, try NAME.txt and NAME.json
  const local = (p.pdfUrl || "").startsWith("/specs/") ? p.pdfUrl : "";
  if (local && /\.pdf$/i.test(local)) {
    const base = local.replace(/\.pdf$/i, "");
    for (const ext of [".txt", ".json"]) {
      try {
        const r = await fetch(`${base}${ext}`, { cache: "no-store" });
        if (!r.ok) continue;
        if (ext === ".txt") {
          const t = (await r.text()).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          if (t.length) return t;
        } else {
          const j = await r.json();
          const arr = Array.isArray(j) ? j : Array.isArray(j?.bullets) ? j.bullets : [];
          if (arr.length) return arr as string[];
        }
      } catch { /* try next */ }
    }
  }
  return [];
}

/* ---------------------- main ---------------------- */

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
  projectName = "Product Presentation",
  clientName = "",
  contactName = "",
  email = "",
  phone = "",
  date = "",
  items,
}: ExportArgs) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  /* ---------- COVERS ---------- */

  // Slide 1: project + client over photo
  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      s1.addText(projectName, {
        x: 0.6, y: 0.6, w: 8.8, h: 1.0,
        fontSize: 32, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
      if (clientName) {
        s1.addText(`Client: ${clientName}`, {
          x: 0.6, y: 1.4, w: 8.8, h: 0.6,
          fontSize: 20, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
        });
      }
    } catch {}
  }

  // Slide 2: remaining details over photo
  if (COVER_URLS[1]) {
    try {
      const s2 = pptx.addSlide();
      const data = await urlToDataUrl(COVER_URLS[1]);
      s2.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);

      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email)       lines.push(`Email: ${email}`);
      if (phone)       lines.push(`Phone: ${phone}`);
      if (date)        lines.push(`Date: ${date}`);

      s2.addText(lines.join("\n"), {
        x: 0.6, y: 0.6, w: 8.8, h: 2.0,
        fontSize: 20, color: "FFFFFF", lineSpacing: 20,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {}
  }

  /* ---------- PRODUCT SLIDES ---------- */

  for (const p of items) {
    const s = pptx.addSlide();

    // Image (no crop / no stretch)
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        s.addImage({
          data, x: 0.5, y: 0.7, w: 5.5, h: 4.1,
          sizing: { type: "contain", w: 5.5, h: 4.1 },
        } as any);
      } catch {}
    }

    // Title + SKU
    s.addText(p.name || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (p.code)
      s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.3, w: 6.2, h: 0.35, fontSize: 12, color: "555555" });

    // Description (wrapped & clamped)
    const desc = wrapAndClamp(p.description || "", /*maxLines*/ 6, /*maxCharsPerLine*/ 74);
    if (desc) {
      s.addText(desc, {
        x: 6.2, y: 1.7, w: 6.2, h: 1.6,
        fontSize: 12, valign: "top",
      });
    }

    // Specifications bullets (from sheet / specs.ts / specs/*.txt)
    const rawBullets = await resolveBullets(p);
    const bullets = clampBullets(rawBullets, /*maxBullets*/ 8, /*maxCharsEach*/ 110);
    if (bullets.length) {
      s.addText(bullets, {
        x: 6.2, y: 3.5, w: 6.2, h: 1.9,
        fontSize: 12, bullet: { type: "bullet" }, valign: "top",
      });
    }

    // Links
    let linkY = 5.6;
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y: linkY, w: 6.2, h: 0.3, fontSize: 12,
        underline: true, hyperlink: { url: p.url },
      });
      linkY += 0.35;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY, w: 6.2, h: 0.3, fontSize: 12,
        underline: true, hyperlink: { url: p.pdfUrl },
      });
    }

    // Category (small, under image)
    if (p.category) {
      s.addText(`Category: ${p.category}`, {
        x: 0.5, y: 5.1, w: 5.5, h: 0.3, fontSize: 10, color: "666666",
      });
    }
  }

  /* ---------- BACK PAGES ---------- */

  for (const url of BACK_URLS) {
    try {
      const s = pptx.addSlide();
      const data = await urlToDataUrl(url);
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
