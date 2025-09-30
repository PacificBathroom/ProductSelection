import type { Product } from "../types";

const FULL_W = 10;
const FULL_H = 5.625;
const COVER_URLS = ["/branding/cover.jpg", "/branding/cover2.jpg"];
const BRAND_BLUE = "1E3A8A";

// ---------- helpers ----------
async function urlToDataUrl(rawUrl: string): Promise<string> {
  // encode spaces etc. so `/specs/S Trap.png` works
  const url = encodeURI(rawUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

function contain(iw: number, ih: number, x: number, y: number, W: number, H: number) {
  const rImg = iw / ih, rBox = W / H;
  let w: number, h: number;
  if (rImg >= rBox) { w = W; h = w / rImg; } else { h = H; w = h * rImg; }
  return { x: x + (W - w) / 2, y: y + (H - h) / 2, w, h };
}

async function addContainedImage(slide: any, dataUrl: string, box: {x:number;y:number;w:number;h:number}) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = contain(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

function slugifyNameForGuess(name?: string) {
  if (!name) return "";
  // keep letters/digits/spaces so "S Trap" still tries with the space too
  const nice = name.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const tight = nice.replace(/ /g, ""); // also try no-space form
  return { nice, tight };
}

function guessPreviewCandidates(pdfUrl?: string, code?: string, pdfKey?: string, name?: string): string[] {
  const out: string[] = [];
  const pushVariants = (base: string) => {
    if (!base) return;
    out.push(`/specs/${base}.png`, `/specs/${base}.jpg`, `/specs/${base}.jpeg`, `/specs/${base}.webp`);
  };

  // from /specs/Name.pdf
  if (pdfUrl?.startsWith("/specs/")) {
    const base = pdfUrl.replace(/^\/specs\//, "").replace(/\.pdf(\?.*)?$/i, "");
    pushVariants(base);
  }

  // from ?url=…Name.pdf
  const m = pdfUrl?.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = (decoded.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
      pushVariants(base);
    } catch {}
  }

  // raw external
  if (pdfUrl && /^https?:\/\//i.test(pdfUrl)) {
    const base = (pdfUrl.split("/").pop() || "").replace(/\.pdf(\?.*)?$/i, "");
    pushVariants(base);
  }

  // SKU / PdfKey
  pushVariants(code || "");
  pushVariants(pdfKey || "");

  // name guesses (with and without space)
  const { nice, tight } = slugifyNameForGuess(name);
  pushVariants(nice);
  pushVariants(tight);

  // de-dupe
  return Array.from(new Set(out));
}

async function firstExistingImageData(cands: string[]): Promise<string | undefined> {
  for (const c of cands) {
    try { return await urlToDataUrl(c); } catch {}
  }
  return undefined;
}

// ---------- main ----------
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

  // covers
  if (COVER_URLS[0]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[0]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
      s.addText(projectName, { x: 0.6, y: 0.6, w: 8.8, h: 1, fontSize: 34, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
      if (clientName) {
        s.addText(`Client: ${clientName}`, { x: 0.6, y: 1.5, w: 8.8, h: 0.7, fontSize: 22, color: "FFFFFF",
          shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
      }
    } catch {}
  }
  if (COVER_URLS[1]) {
    try {
      const s = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[1]);
      s.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
      const lines: string[] = [];
      if (contactName) lines.push(`Prepared by: ${contactName}`);
      if (email) lines.push(`Email: ${email}`);
      if (phone) lines.push(`Phone: ${phone}`);
      if (date) lines.push(`Date: ${date}`);
      s.addText(lines.join("\n"), { x: 0.6, y: 0.6, w: 8.8, h: 2, fontSize: 22, color: "FFFFFF",
        lineSpacing: 20, shadow: { type: "outer", blur: 2, offset: 1, color: "000000" } });
    } catch {}
  }

  // product slides
  for (const p of items) {
    const s = pptx.addSlide();

    // footer bar
    s.addText("", { x: 0, y: FULL_H - 0.28, w: FULL_W, h: 0.28, fill: { color: BRAND_BLUE } });

    // layout
    const padX = 0.5;
    const topY = 0.55;
    const leftW = 5.4;
    const colGap = 0.35;
    const rightX = padX + leftW + colGap;
    const rightW = FULL_W - rightX - padX;

    const IMG_H = 3.2;  // product image height
    const SPEC_H = 2.1; // bigger spec preview

    // right column text
    s.addText(p.name || "—", { x: rightX, y: topY, w: rightW, h: 0.8, fontSize: 28, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: rightX, y: topY + 0.72, w: rightW, h: 0.35, fontSize: 12 });

    const bullets = (p.specsBullets ?? []).slice(0, 6).map(b => `• ${b}`).join("\n");
    const body = [p.description, bullets].filter(Boolean).join("\n\n");
    s.addText(body, {
      x: rightX, y: topY + 1.1, w: rightW, h: 3.4,
      fontSize: 13, lineSpacing: 18, valign: "top", shrinkText: true,
    });

    // left: product image
    if (p.imageProxied) {
      try {
        const data = await urlToDataUrl(p.imageProxied);
        await addContainedImage(s, data, { x: padX, y: topY + 0.15, w: leftW, h: IMG_H });
      } catch {}
    }

    // left: spec preview (from many guesses)
    const candidates = guessPreviewCandidates(p.pdfUrl, p.code, p.pdfKey, p.name);
    const specData = await firstExistingImageData(candidates);
    if (specData) {
      await addContainedImage(s, specData, { x: padX, y: topY + 0.15 + IMG_H + 0.2, w: leftW, h: SPEC_H });
    }
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
