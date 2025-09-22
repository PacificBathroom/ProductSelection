// api/file-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  try {
    const url = String(req.query.url || '');
    if (!url) return res.status(400).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Missing url' });

    const upstream = await fetch(url, { redirect: 'follow' });
    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .setHeader('Access-Control-Allow-Origin', '*')
        .json({ error: `Upstream ${upstream.status} ${upstream.statusText}` });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.send(buf);
  } catch (e: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: e?.message || 'proxy error' });
  }
}
