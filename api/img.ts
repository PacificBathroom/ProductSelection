mkdir -p api
cat > api/img.ts <<'TS'
// api/img.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = String(req.query.url || "");
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Missing or invalid ?url=" });
    return;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(r.status).send(text || "Upstream error");
      return;
    }
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=31536000");
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/octet-stream");
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(200).send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "proxy error" });
  }
}
TS
