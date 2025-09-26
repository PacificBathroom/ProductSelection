// /api/file-proxy.ts (Vercel)
import type { VercelRequest, VercelResponse } from "@vercel/node";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).setHeader("Access-Control-Allow-Origin", "*").end();

  try {
    const url = String(req.query.url || "");
    if (!url) return res.status(400).setHeader("Access-Control-Allow-Origin", "*").json({ error: "Missing url" });

    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      return res.status(upstream.status).setHeader("Access-Control-Allow-Origin", "*")
        .json({ error: `Upstream ${upstream.status} ${upstream.statusText}` });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);
    // Return binary as-is; client can read it as blob
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).setHeader("Access-Control-Allow-Origin", "*").json({ error: String(e?.message || e) });
  }
}
