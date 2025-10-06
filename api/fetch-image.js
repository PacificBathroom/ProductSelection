export default async function handler(req, res) {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send("Missing ?url=");
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).send("Upstream failed");
    const type = r.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("Proxy error: " + (e?.message || e));
  }
}
