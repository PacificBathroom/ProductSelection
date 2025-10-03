/* /api/img.js - minimal same-origin image proxy */
module.exports = async function (req, res) {
  const url = String((req.query && req.query.url) || "");
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "Missing or invalid ?url=" });
    return;
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.status(upstream.status).send(text || "Upstream error");
      return;
    }
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=31536000");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "proxy error" });
  }
};
