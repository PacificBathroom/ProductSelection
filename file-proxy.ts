// netlify/functions/file-proxy.ts
import type { Handler } from "@netlify/functions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }
    const url = event.queryStringParameters?.url;
    if (!url) return { statusCode: 400, headers: CORS, body: "Missing url" };

    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
      },
    });
    if (!upstream.ok) {
      return { statusCode: upstream.status, headers: CORS, body: `Upstream ${upstream.status}` };
    }

    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const buf = await upstream.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": ct, "Cache-Control": "public, max-age=86400" },
      body: b64,
      isBase64Encoded: true,   // <-- critical
    };
  } catch (e: any) {
    return { statusCode: 500, headers: CORS, body: e?.message || "Proxy error" };
  }
};
