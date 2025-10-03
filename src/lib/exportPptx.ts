// src/lib/exportPptx.ts
import type { Product } from "../types";
import { store } from "../state/storeAccess";

/* ------------------------------ constants ------------------------------ */

const FULL_W = 10;     // pptxgen 16:9 width (in)
const FULL_H = 5.625;  // pptxgen 16:9 height (in)

const COVER_URLS = ["/branding/cover.jpg"]; // first entry used as cover background
const BACK_URLS  = ["/branding/warranty.jpg", "/branding/service.jpg"];

/* -------------------------------- types -------------------------------- */

export type ExportArgs = {
  projectName?: string;

  clientName?: string;
  clientAddress?: string;

  contactName?: string;
  contactAddress?: string;

  email?: string;
  phone?: string;

  date?: string;

  salesRepName?: string;
  salesRepEmail?: string;
  salesRepPhone?: string;

  quoteNumber?: string;
  reference?: string;
  notes?: string;

  // Arbitrary extra fields from the app (key -> value)
  extra?: Record<string, string | undefined>;

  items: Product[];
};

/* ------------------------------- helpers ------------------------------- */

// Same-origin or proxied URL -> data URL
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("FileReader error"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

// Read natural (pixel) dimensions from a data URL
async function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await new Promise<void>((ok, err) => {
    img.onload = () => ok();
    img.onerror = () => err(new Error("image load error"));
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// Fit an image into a box while preserving aspect ratio; return centered rect
function fitIntoBox(
  imgW: number, imgH: number,
  boxX: number, boxY: number, boxW: number, boxH: number
): { x: number; y: number; w: number; h: number } {
  const rImg = imgW / imgH;
  const rBox = boxW / boxH;
  let w: number, h: number;
  if (rImg >= rBox) { w = boxW; h = w / rImg; }
  else { h = boxH; w = h * rImg; }
  const x = boxX + (boxW - w) / 2;
  const y = boxY + (boxH - h) / 2;
  return { x, y, w, h };
}

// Add a centered, non-cropped image into a box (data URL input)
async function addContainedImage(
  slide: any,
  dataUrl: string,
  box: { x: number; y: number; w: number; h: number }
) {
  const { w: iw, h: ih } = await getImageDims(dataUrl);
  const rect = fitIntoBox(iw, ih, box.x, box.y, box.w, box.h);
  slide.addImage({ data: dataUrl, ...rect } as any);
}

// From a pdf url, guess basename (without extension)
function guessSpecBaseFromPdf(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  if (pdfUrl.startsWith("/specs/")) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  const m = pdfUrl.match(/[?&]url=([^&]+)/);
  if (m) {
    try {
      const decoded = decodeURIComponent(m[1]);
      const base = decoded.split("/").pop() || "";
      return base.replace(/\.pdf(\?.*)?$/i, "");
    } catch { /* ignore */ }
  }
  if (/^https?:\/\//i.test(pdfUrl)) {
    const base = pdfUrl.split("/").pop() || "";
    return base.replace(/\.pdf(\?.*)?$/i, "");
  }
  return;
}

// Try multiple extensions and name variants to find a preview next to the PDF
async function findSpecPreviewUrl(pdfUrl?: string, sku?: string): Promise<string | undefined> {
  const key = guessSpecBaseFromPdf(pdfUrl) || sku;
  if (!key) return;
  const stems = [key, key.replace(/\s+/g, "_"), key.replace(/\s+/g, "")];
  const exts = ["png", "jpg", "jpeg", "webp"];
  for (const stem of stems) {
    for (const ext of exts) {
      const url = `/specs/${stem}.${ext}`;
      try {
        await urlToDataUrl(url);
        return url;
      } catch { /* try next */ }
    }
  }
  return;
}

// Accept many possible field names for spec PDFs
function coalescePdfUrl(p: any): string | undefined {
  return (
    p.pdfUrl ||
    p.specPdf ||
    p.specPDF ||
    p.spec ||
    p.specSheet ||
    p["Spec PDF"] ||
    p["Spec sheet"] ||
    p["Spec sheet (PDF)"] ||
    p["PDF"] ||
    undefined
  );
}

/* --------------------------------- main --------------------------------- */

export async function exportPptx({
  projectName = "Product Presentation",

  clientName = "",
  clientAddress = "",

  contactName = "",
  contactAddress = "",

  email = "",
  phone = "",

  date = "",

  salesRepName = "",
  salesRepEmail = "",
  salesRepPhone = "",

  quoteNumber = "",
  reference = "",
  notes = "",

  extra,
  items,
}: ExportArgs) {
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  /* ---------------------------------- COVER --------------------------------- */

  if (COVER_URLS[0]) {
    try {
      const s1 = pptx.addSlide();
      const bg = await urlToDataUrl(COVER_URLS[0]);
      s1.addImage({ data: bg, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);

      // Title
      s1.addText(projectName || "Product Presentation", {
        x: 0.6, y: 0.5, w: 8.8, h: 1.0,
        fontSize: 34, bold: true, color: "FFFFFF",
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });

      // Combine all fields + any extras + items count
      const details: Record<string, string | undefined> = {
        "Client": clientName,
        "Client Address": clientAddress,
        "Contact": contactName,
        "Contact Address": contactAddress,
        "Email": email,
        "Phone": phone,
        "Sales Rep": salesRepName,
        "Rep Email": salesRepEmail,
        "Rep Phone": salesRepPhone,
        "Quote #": quoteNumber,
        "Reference": reference,
        "Date": date,
        "Notes": notes,
        ...(typeof extra === "object" && extra ? extra : {}),
        "Items selected": String(items?.length ?? 0),
      };

      const lines = Object.entries(details)
        .filter(([, v]) => v && String(v).trim().length > 0)
        .map(([k, v]) => `${k}: ${v}`);

      // Render all details in one auto-shrinking block
      s1.addText(lines.join("\n"), {
        x: 0.6, y: 1.4, w: 8.8, h: 3.4,
        fontSize: 20, color: "FFFFFF", valign: "top",
        lineSpacing: 24, shrinkText: true,
        shadow: { type: "outer", blur: 2, offset: 1, color: "000000" },
      });
    } catch {
      // ignore cover errors to still produce a deck
    }
  }

  /* --------------------------- PRODUCT + SPEC SLIDES -------------------------- */

  for (const p of items) {
    // ---- Product slide
    {
      const s = pptx.addSlide();

      // Large product image on the left
      if ((p as any).imageProxied || (p as any).imageUrl) {
        try {
          const src = (p as any).imageProxied || (p as any).imageUrl;
          const imgData = await urlToDataUrl(src);
          await addContainedImage(s, imgData, { x: 0.4, y: 0.85, w: 5.6, h: 3.9 });
        } catch { /* continue without image */ }
      }

      // Title on the right
      s.addText(p.name || "—", {
        x: 6.3, y: 0.7, w: 3.9, h: 0.9, fontSize: 30, bold: true,
      });

      // Body + bullets on the right
      const bullets = (p.specsBullets ?? []).slice(0, 8).map((b) => `• ${b}`).join("\n");
      const bodyParts: string[] = [];
      if (p.description) bodyParts.push(p.description);
      if (bullets) bodyParts.push(bullets);
      const body = bodyParts.join("\n\n");

      s.addText(body || "", {
        x: 6.3, y: 1.8, w: 3.9, h: 3.2,
        fontSize: 14, lineSpacing: 18, valign: "top", shrinkText: true,
      });

      // SKU bottom-right so it never collides with the copy
      if (p.code) {
        s.addText(p.code, {
          x: 8.9, y: 5.25, w: 1.0, h: 0.3, fontSize: 12, color: "666666", align: "right",
        });
      }
    }

    // ---- Specification slide (robust)
    const pdfUrl: string | undefined = coalescePdfUrl(p as any);
    if (pdfUrl) {
      const s2 = pptx.addSlide();
      s2.addText(`${p.name || "—"} — Specifications`, {
        x: 0.5, y: 0.4, w: 9.0, h: 0.6, fontSize: 28, bold: true,
      });

      let addedImage = false;

      // 1) Explicit preview image if provided on the product
      const explicitPreview: string | undefined =
        (p as any).specPreviewUrl || (p as any).imagePreviewUrl;

      try {
        if (explicitPreview) {
          const prevData = await urlToDataUrl(explicitPreview);
          await addContainedImage(s2, prevData, { x: 0.25, y: 1.1, w: 9.5, h: 4.25 });
          addedImage = true;
        }
      } catch { /* ignore and try auto-discovery */ }

      // 2) Otherwise, try to auto-discover an image beside the PDF in /public/specs
      if (!addedImage) {
        try {
          const previewUrl = await findSpecPreviewUrl(pdfUrl, p.code);
          if (previewUrl) {
            const prevData = await urlToDataUrl(previewUrl);
            await addContainedImage(s2, prevData, { x: 0.25, y: 1.1, w: 9.5, h: 4.25 });
            addedImage = true;
          }
        } catch { /* fall through */ }
      }

      // Always add a clickable link to the source PDF (top-right under title)
      try {
        s2.addText("Open Spec PDF", {
          x: 7.6, y: 0.45, w: 1.9, h: 0.4,
          fontSize: 14, color: "0A66C2", underline: true,
          hyperlink: { url: pdfUrl },
          align: "right",
        });
      } catch { /* ignore */ }

      if (!addedImage) {
        s2.addText(
          "Spec preview image not found.\n" +
            "Tip: add PNG/JPG to /public/specs using the PDF’s basename (e.g. PMB420.png),\n" +
            "or set product.specPreviewUrl.",
          { x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 18, color: "888888" }
        );
      }
    }
  }

  /* -------------------------------- BACK PAGES -------------------------------- */

  for (const url of BACK_URLS) {
    try {
      const data = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data, x: 0, y: 0, w: FULL_W, h: FULL_H } as any);
    } catch { /* ignore */ }
  }

  const filename = `${(projectName || "Product_Presentation").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}

/* ---------------------------- convenience wrappers --------------------------- */

/** Use the current app state (contact/project) from the store. */
export async function exportDeckFromStore(items: Product[]) {
  const { contact, project } = store.get();
  return exportPptx({
    projectName: project.projectName || "Product Presentation",
    clientName: project.clientName || "",
    contactName: `${contact.contactName}${contact.title ? ", " + contact.title : ""}`,
    email: contact.email || "",
    phone: contact.phone || "",
    date: project.presentationDate || "",
    items,
  });
}

/** Legacy zero-arg wrapper; exports a cover-only deck using current store state. */
export async function exportDeck() {
  const { contact, project } = store.get();
  return exportPptx({
    projectName: project.projectName || "Product Presentation",
    clientName: project.clientName || "",
    contactName: `${contact.contactName}${contact.title ? ", " + contact.title : ""}`,
    email: contact.email || "",
    phone: contact.phone || "",
    date: project.presentationDate || "",
    items: [],
  });
}
