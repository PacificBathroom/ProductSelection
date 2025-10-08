// src/lib/exportPptx.ts
import type { Product } from '../types';
import PptxGenJS from 'pptxgenjs';

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

/* Helpers */

async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('FileReader failed'));
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
      img.onerror = () => err(new Error('image load error'));
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
  slide.addImage({ data: dataUrl, ...fitIntoBox(dims.w, dims.h, box.x, box.y, box.w, box.h) } as any);
}

function splitBullets(s: string): string[] {
  return s
    .split(/\r?\n|•|\u2022|;|,|\||\/|—|–|\s-\s|^-| - |-{1,2}/gm)
    .map(t => t.replace(/^[•\u2022\-–—]\s*/, '').trim())
    .filter(Boolean);
}

function uniqueKeepOrder(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function deriveBulletsFromProduct(p: any): string[] {
  if (Array.isArray(p.specsBullets) && p.specsBullets.length) {
    return uniqueKeepOrder(p.specsBullets.map(String)).slice(0, 10);
  }
  const candidates: string[] = [];
  for (const kv of Object.keys(p)) {
    const key = String(kv).toLowerCase();
    if (!/(spec|feature|bullet|point|highlight|detail|benefit)/.test(key)) continue;
    const v: any = (p as any)[kv];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        const s = String(item || '').trim();
        if (s) candidates.push(s);
      }
    } else if (typeof v === 'string') {
      candidates.push(...splitBullets(v));
    }
  }
  if (!candidates.length && typeof p.description === 'string') {
    candidates.push(...splitBullets(p.description));
  }
  return uniqueKeepOrder(candidates).slice(0, 10);
}

function guessPreviewFromPdf(pdfUrl?: string): string | undefined {
  if (!pdfUrl) return;
  const last = pdfUrl.split('/').pop() || '';
  const base = last.replace(/\.pdf(\?.*)?$/i, '');
  if (!base) return;
  const stems = [base, base.replace(/\s+/g, '_'), base.replace(/\s+/g, '')];
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  for (const s of stems) for (const e of exts) return '/specs/' + s + '.' + e;
  return;
}

/* Main */

export async function exportPptx({
  projectName = 'Product Presentation',
  clientName = '',
  contactName = '',
  company = '',
  email = '',
  phone = '',
  date = '',
  items,
  coverImageUrls = ['/branding/cover.jpg'],
  backImageUrls = ['/branding/warranty.jpg', '/branding/service.jpg'],
}: ExportArgs) {
  const pptx = new PptxGenJS();

  // COVER
  const sCover = pptx.addSlide();
  try {
    const coverSrc = coverImageUrls[0];
    if (coverSrc) {
      const coverBg = await urlToDataUrl(coverSrc);
      if (coverBg) sCover.background = { data: coverBg };
    }
  } catch {}
  sCover.addText(projectName || 'Product Presentation', {
    x: 0.5, y: 0.8, w: 9, h: 0.8, fontSize: 28, bold: true, color: '003366',
  });
  const lines: string[] = [];
  if (clientName) lines.push('Client: ' + clientName);
  if (contactName) lines.push('Your contact: ' + contactName + (company ? ', ' + company : ''));
  if (email) lines.push('Email: ' + email);
  if (phone) lines.push('Phone: ' + phone);
  if (date) lines.push('Date: ' + date);
  if (lines.length) {
    sCover.addText(lines.join('\n'), {
      x: 0.5, y: 1.7, w: 9, h: 2.0, fontSize: 18, color: '333333', lineSpacing: 20,
    });
  }

  // PRODUCT SLIDES
  for (const p of items) {
    const s = pptx.addSlide();

    s.addText(p.name || p.code || 'Untitled Product', {
      x: 0.5, y: 0.35, w: 9.0, h: 0.6, fontSize: 26, bold: true, color: '003366',
    });

    const IMG_BOX  = { x: 0.5, y: 1.05, w: 5.2, h: 3.9 };
    const RIGHT_X  = 6.0;
    const RIGHT_W  = 3.5;
    const DESC_BOX = { x: RIGHT_X, y: 1.05, w: RIGHT_W, h: 1.9 };
    const BUL_BOX  = { x: RIGHT_X, y: 3.05, w: RIGHT_W, h: 2.0 };

    const imgUrl = (p as any).imageProxied || (p as any).imageUrl || (p as any).image;
    if (imgUrl) {
      try {
        const data = await urlToDataUrl(imgUrl);
        if (data) await addContainedImage(s, data, IMG_BOX);
      } catch {}
    }

    if (p.description) {
      s.addText(p.description, {
        x: DESC_BOX.x, y: DESC_BOX.y, w: DESC_BOX.w, h: DESC_BOX.h,
        fontSize: 13, color: '444444', lineSpacing: 18, valign: 'top', shrinkText: true,
      });
    }

    const bullets = deriveBulletsFromProduct(p as any);
    if (bullets.length) {
      // use newline string with bullet: true (very TS-safe)
      s.addText(bullets.join('\n'), {
        x: BUL_BOX.x, y: BUL_BOX.y, w: BUL_BOX.w, h: BUL_BOX.h,
        fontSize: 13, lineSpacing: 18, valign: 'top', shrinkText: true, bullet: true,
      });
    }

    if (p.code) {
      s.addText('Code: ' + p.code, {
        x: 0.5, y: 5.25, w: 4.8, h: 0.3, fontSize: 12, color: '444444',
      });
    }
    if (p.pdfUrl) {
      s.addText('Spec Sheet (PDF)', {
        x: 6.0, y: 5.25, w: 3.5, h: 0.3, fontSize: 12, color: '1155CC', align: 'right',
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  // SPECIFICATION SLIDES (one per product)
  for (const p of items) {
    const s = pptx.addSlide();

    s.addText((p.name || p.code || '—') + ' — Specifications', {
      x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 24, bold: true, color: '003366',
    });

    const bullets = deriveBulletsFromProduct(p as any);
    if (bullets.length) {
      s.addText(bullets.join('\n'), {
        x: 0.5, y: 1.2, w: 5.0, h: 4.2, fontSize: 14, lineSpacing: 20, valign: 'top', shrinkText: true, bullet: true,
      });
    } else {
      s.addText('No specifications available.', {
        x: 0.5, y: 1.2, w: 5.0, h: 1.0, fontSize: 14, color: '888888',
      });
    }

    let previewPlaced = false;
    const previewGuess = guessPreviewFromPdf(p.pdfUrl);
    if (previewGuess) {
      try {
        const data = await urlToDataUrl(previewGuess);
        if (data) {
          await addContainedImage(s, data, { x: 5.6, y: 1.2, w: 3.8, h: 3.8 });
          previewPlaced = true;
        }
      } catch {}
    }
    if (!previewPlaced) {
      const imgUrl = (p as any).imageProxied || (p as any).imageUrl || (p as any).image;
      if (imgUrl) {
        try {
          const data = await urlToDataUrl(imgUrl);
          if (data) await addContainedImage(s, data, { x: 5.6, y: 1.2, w: 3.8, h: 3.8 });
        } catch {}
      }
    }

    if (p.pdfUrl) {
      s.addText('Open Spec PDF', {
        x: 5.6, y: 5.2, w: 3.8, h: 0.4, fontSize: 12, color: '1155CC', align: 'right',
        hyperlink: { url: p.pdfUrl },
      });
    }
  }

  // BACK PAGES
  for (const url of backImageUrls) {
    const s = pptx.addSlide();
    try {
      const data = await urlToDataUrl(url);
      if (data) s.background = { data };
    } catch {}
  }

  await pptx.writeFile({ fileName: (projectName || 'Product Selection') + '.pptx' });
}
