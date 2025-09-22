import { useEffect, useState } from "react";
import { sheetsUrl, proxyUrl } from "./lib/api";

export default function App() {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(sheetsUrl);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json() as { values?: string[][] };
        setRows(data.values ?? []);
      } catch (e: any) {
        setError(e?.message || "fetch error");
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Product Selection</h1>
      <p>Vercel + Vite + API functions are ready.</p>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {rows && rows.length > 0 && (
        <>
          <p>Rows loaded: {rows.length}</p>
          <table border={1} cellPadding={6}>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  {r.slice(0, 5).map((c, j) => <td key={j}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <p>Proxy image test:</p>
        <img src={proxyUrl("https://picsum.photos/200")} alt="proxy test" />
      </div>
    </div>
  );
}
