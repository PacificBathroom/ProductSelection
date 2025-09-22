import { useEffect, useState } from "react";
import { fetchProducts } from "./lib/products";
import type { Product } from "./types";

export default function App() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ps = await fetchProducts("Products!A:Z"); // adjust your tab/range
        setItems(ps);
      } catch (e: any) {
        setError(e?.message || "fetch error");
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, Arial, sans-serif" }}>
      <h1>Product Selection</h1>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!items && !error && <p>Loading…</p>}

      {items && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {items.map((p, i) => (
            <div key={(p.code || p.name || String(i)) + i} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
              {p.imageProxied && (
                <img
                  src={p.imageProxied}
                  alt={p.name || p.code || "product"}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                />
              )}
              <div style={{ fontWeight: 600 }}>{p.name || p.code || "Unnamed product"}</div>
              {p.code && <div style={{ opacity: 0.7, fontSize: 13 }}>{p.code}</div>}
              {p.description && <p style={{ fontSize: 14 }}>{p.description}</p>}
              {p.specsBullets && p.specsBullets.length > 0 && (
                <ul style={{ paddingLeft: 16, margin: "8px 0", fontSize: 13 }}>
                  {p.specsBullets.slice(0, 4).map((s, j) => <li key={j}>{s}</li>)}
                </ul>
              )}
              {p.pdfUrl && (
                <a
                  href={`/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  View spec sheet (PDF)
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
