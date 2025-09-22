import { useEffect, useState } from "react";
import { fetchProducts } from "./lib/products";
import type { Product } from "./types";

export default function App() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // adjust the tab name if not "Products"
        const ps = await fetchProducts("Products!A:Z");
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
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16
        }}>
          {items.map((p, i) => (
            <div key={(p.code || p.name || String(i)) + i}
                 style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              {p.imageProxied && (
                <img
                  src={p.imageProxied}
                  alt={p.name || p.code || "product"}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                />
              )}
              <div style={{ fontWeight: 700 }}>{p.name || p.code || "Unnamed product"}</div>
              {p.code && <div style={{ opacity: 0.7, fontSize: 13 }}>{p.code}</div>}
              {p.description && <p style={{ fontSize: 14, marginTop: 8 }}>{p.description}</p>}
              {p.specsBullets && p.specsBullets.length > 0 && (
                <ul style={{ paddingLeft: 16, margin: "8px 0", fontSize: 13 }}>
                  {p.specsBullets.slice(0, 6).map((s, j) => <li key={j}>{s}</li>)}
                </ul>
              )}
              <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 13 }}>
                {p.pdfUrl && (
                  <a href={`/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`} target="_blank" rel="noreferrer">
                    View spec sheet (PDF)
                  </a>
                )}
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    Product page
                  </a>
                )}
              </div>
              {p.contact && (p.contact.name || p.contact.email || p.contact.phone) && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  <div>Contact: {p.contact.name || "—"}</div>
                  {p.contact.email && <div>Email: {p.contact.email}</div>}
                  {p.contact.phone && <div>Phone: {p.contact.phone}</div>}
                  {p.contact.address && <div style={{ whiteSpace: "pre-wrap" }}>{p.contact.address}</div>}
                </div>
              )}
              {p.category && (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                  Category: {p.category}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
