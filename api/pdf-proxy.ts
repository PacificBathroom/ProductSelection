// api/pdf-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = String(req.query.url || '');
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return res.status(r.status).json({ error: `Upstream ${r.status} ${r.statusText}` });

    const contentType = r.headers.get('content-type') ?? 'application/pdf';
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'pdf proxy error' });
  }
}
