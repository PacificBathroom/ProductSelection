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

/* ---------- helpers ---------- */

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

function fitIntoBox(imgW: number, imgH: number, x: number, y: number, w: number, h: number) {
  const rImg = imgW / imgH;
  const rBox = w / h;
  let outW = w, outH = h;
  if (rImg >= rBox) outH = outW / rImg;
  else outW = outH * rImg;
  return { x: x + (w - outW) / 2, y: y + (h - outH) / 2, w: outW, h: outH };
}

async function getImageDims(dataUrl: string) {
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

async function addContainedImage(slide: any, dataUrl: string, box: { x: number; y: number; w: number; h: number }) {
  const dims = await getImageDims(dataUrl);
  if (!dims) {
    slide.addImage({ data: dataUrl, ...box } as any);
    return;
  }
  slide.addImage({ data: dataUrl, ...fitIntoBox(dims.w, dims.h, box.x, box.y, box.w, box.h) } as any);
}

function splitBullets(s: string) {
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
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

function deriveBulletsFromProduct(p: any): string[] {
  if (Array.isArray(p.specsBullets) && p.specsBullets.length)
    return uniqueKeepOrder(p.specsBullets.map(String)).slice(0, 10);

  const out: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    const key = k.toLowerCase();
    if (!/(spec|feature|bullet|point|highlight|detail|benefit)/.test(key)) continue;
    if (Array.isArray(v)) out.push(...v.map(x => String(x).trim()).filter(Boolean));
    else if (typeof v === 'string') out.push(...splitBullets(v));
  }
  if (!out.length && typeof p.description === 'string')
    out.push(...splitBullets(p.description));
  return uniqueKeepOrder(out).slice(0, 10);
}

function guessPreviewFromPdf(pdfUrl?: string) {
  if (!pdfUrl) return;
  const last = pdfUrl.split('/').pop() || '';
  const base = last.replace(/\.pdf(\?.*)?$/i, '');
  if (!base) return;
  const stems = [base, base.replace(/\s+/g, '_'), base.replace(/\s+/g, '')];
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  for (const s of stems) for (const e of exts) return `/specs/${s}.${e}`;
}

/* ---------- main ---------- */

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
  sCover.addText(projectName, { x: 0.5, y: 0.8, w: 9, h: 0.8, fontSize: 28, bold: true, color: '003366' });
  const lines: string[] = [];
  if (clientName) lines.push('Client: ' + clientName);
  if (contactName) lines.push('Your contact: ' + contactName + (company ? ', ' + company : ''));
  if (email) lines.push('Email: ' + email);
  if (phone) lines.push('Phone: ' + phone);
  if (date) lines.push('Date: ' + date);
  if (lines.length)
    sCover.addText(lines.join('\n'), { x: 0.5, y: 1.7, w: 9, h: 2, fontSize: 18, color: '333333', lineSpacing: 20 });

  // PRODUCTS + SPECIFICATIONS
  for (const p of items) {
    /* product slide */
    const s = pptx.addSlide();
    s.addText(p.name || p.code || 'Untitled Product', {
      x: 0.5, y: 0.35, w: 9, h: 0.6, fontSize: 26, bold: true, color: '003366'
    });

    const IMG_BOX = { x: 0.5, y: 1.05, w: 5.2, h: 3.9 };
    const RIGHT_X = 6.0;
    const RIGHT_W = 3.5;

    const imgUrl = (p as any).imageProxied || (p as any).imageUrl || (p as any).image;
    if (imgUrl) {
      const data = await urlToDataUrl(imgUrl);
      if (data) await addContainedImage(s, data, IMG_BOX);
    }

    if (p.description)
      s.addText(p.description, {
        x: RIGHT_X, y: 1.05, w: RIGHT_W, h: 1.9,
        fontSize: 13, color: '444444', lineSpacing: 18, valign: 'top', shrinkText: true
      });

    const bullets = deriveBulletsFromProduct(p);
    if (bullets.length)
      s.addText(bullets.join('\n'), {
        x: RIGHT_X, y: 3.05, w: RIGHT_W, h: 2.0,
        fontSize: 13, lineSpacing: 18, valign: 'top', shrinkText: true, bullet: true
      });

    if (p.code)
      s.addText('Code: ' + p.code, { x: 0.5, y: 5.25, w: 4.8, h: 0.3, fontSize: 12, color: '444444' });
    if (p.pdfUrl)
      s.addText('Spec Sheet (PDF)', {
        x: 6, y: 5.25, w: 3.5, h: 0.3,
        fontSize: 12, color: '1155CC', align: 'right', hyperlink: { url: p.pdfUrl }
      });

    /* specification slide immediately after */
    const spec = pptx.addSlide();
    spec.addText((p.name || p.code || '—') + ' — Specifications', {
      x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 24, bold: true, color: '003366'
    });

    if (bullets.length)
      spec.addText(bullets.join('\n'), {
        x: 0.5, y: 1.2, w: 5.0, h: 4.2, fontSize: 14, lineSpacing: 20, valign: 'top', shrinkText: true, bullet: true
      });
    else
      spec.addText('No specifications available.', { x: 0.5, y: 1.2, w: 5.0, h: 1.0, fontSize: 14, color: '888888' });

    const previewGuess = guessPreviewFromPdf(p.pdfUrl);
    let placed = false;
    if (previewGuess) {
      const data = await urlToDataUrl(previewGuess);
      if (data) {
        await addContainedImage(spec, data, { x: 5.6, y: 1.2, w: 3.8, h: 3.8 });
        placed = true;
      }
    }
    if (!placed && imgUrl) {
      const data = await urlToDataUrl(imgUrl);
      if (data) await addContainedImage(spec, data, { x: 5.6, y: 1.2, w: 3.8, h: 3.8 });
    }
    if (p.pdfUrl)
      spec.addText('Open Spec PDF', {
        x: 5.6, y: 5.2, w: 3.8, h: 0.4,
        fontSize: 12, color: '1155CC', align: 'right', hyperlink: { url: p.pdfUrl }
      });
  }

  // BACK PAGES
  for (const url of backImageUrls) {
    const s = pptx.addSlide();
    const data = await urlToDataUrl(url);
    if (data) s.background = { data };
  }

  await pptx.writeFile({ fileName: (projectName || 'Product Selection') + '.pptx' });
}
