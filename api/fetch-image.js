// api/fetch-image.js
export default async function handler(req, res) {
  try {
    const url = req.query.url;
    if (!url) {
      res.status(400).send("Missing ?url=");
      return;
    }

    // IMPORTANT: basic allowlist (optional but recommended)
    const allowed = [/^https?:\/\//i];
    if (!allowed.some((re) => re.test(url))) {
      res.status(400).send("Blocked URL");
      return;
    }

    const r = await fetch(url, {
      // you can add headers here if the origin needs them
    });

    if (!r.ok) {
      res.status(r.status).send(`Upstream fetch failed: ${r.statusText}`);
      return;
    }

    // Forward content type and cache bits
    const type = r.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=3600");

    // CORS so canvas/fetch() can read it
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream it back
    const arrayBuf = await r.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuf));
  } catch (e) {
    res.status(500).send("Proxy error: " + (e?.message || e));
  }
}
