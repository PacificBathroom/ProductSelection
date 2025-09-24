import { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";

// ---- helpers ---------------------------------------------------------------

const includes = (h: string, n: string) =>
  h.toLowerCase().includes(n.toLowerCase());
const title = (s?: string) => (s ?? "").trim() || "—";

async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

// pptx slide size (pptxgenjs 16:9 default)
const FULL_W = 10;
const FULL_H = 5.625;

// ----------------------------------------------------------------------------

export default function App() {
  // load products
  const [items, setItems] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ps = await fetchProducts("Products!A:Z");
        setItems(ps);
      } catch (e: any) {
        setErr(e?.message || "fetch error");
      }
    })();
  }, []);

  // selection
  const keyOf = (p: Product) => (p.code || p.name || "") + "::" + (p.url || "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(
    () => (items ?? []).filter((p) => selected[keyOf(p)]),
    [items, selected]
  );
  const toggle = (p: Product) =>
    setSelected((s) => ({ ...s, [keyOf(p)]: !s[keyOf(p)] }));

  // filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<"sheet" | "name">("sheet");

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of items ?? []) if (p.category) s.add(p.category);
    return ["All", ...Array.from(s).sort()];
  }, [items]);

  const visible = useMemo(() => {
    let a = [...(items ?? [])];
    if (q)
      a = a.filter(
        (p) =>
          includes(p.name ?? "", q) ||
          includes(p.code ?? "", q) ||
          includes(p.description ?? "", q) ||
          includes(p.category ?? "", q)
      );
    if (cat !== "All") a = a.filter((p) => p.category === cat);
    if (sort === "name") a.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return a;
  }, [items, q, cat, sort]);

  // header form
  const [projectName, setProjectName] = useState("Project Selection");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");

  // export PPTX
  async function exportPptx() {
    if (selectedList.length === 0) {
      alert("Select at least one product.");
      return;
    }
    const PptxGenJS = (await import("pptxgenjs")).default as any;
    const pptx = new PptxGenJS();

    // ---- two cover photos
    for (const url of ["/pptx/cover1.jpg", "/pptx/cover2.jpg"]) {
      try {
        const dataUrl = await urlToDataUrl(url);
        const s = pptx.addSlide();
        s.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: FULL_W,
          h: FULL_H,
          sizing: { type: "cover", w: FULL_W, h: FULL_H },
        } as any);
      } catch {}
    }

    // ---- optional title slide
    pptx.addSlide().addText(
      [
        { text: projectName || "Project Selection", options: { fontSize: 28, bold: true } },
        { text: clientName ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
        { text: contactName ? `\nPrepared by: ${contactName}` : "", options: { fontSize: 16 } },
        { text: email ? `\nEmail: ${email}` : "", options: { fontSize: 14 } },
        { text: phone ? `\nPhone: ${phone}` : "", options: { fontSize: 14 } },
        { text: date ? `\nDate: ${date}` : "", options: { fontSize: 14 } },
      ],
      { x: 0.6, y: 0.6, w: 12, h: 6 }
    );

    // ---- product slides
    for (const p of selectedList) {
      const s = pptx.addSlide();

      try {
        if (p.imageProxied) {
          const dataUrl = await urlToDataUrl(p.imageProxied);
          s.addImage({
            data: dataUrl,
            x: 0.5,
            y: 0.7,
            w: 5.5,
            h: 4.1,
            sizing: { type: "contain", w: 5.5, h: 4.1 },
          } as any);
        }
      } catch {}

      const lines: string[] = [];
      if (p.description) lines.push(p.description);
      if (p.specsBullets?.length) lines.push("• " + p.specsBullets.join("\n• "));
      if (p.category) lines.push(`\nCategory: ${p.category}`);

      s.addText(title(p.name), { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
      s.addText(p.code ? `SKU: ${p.code}` : "", { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });
      s.addText(lines.join("\n"), { x: 6.2, y: 1.9, w: 6.2, h: 3.7, fontSize: 12 });

      if (p.url)
        s.addText("Product page", {
          x: 6.2,
          y: 5.8,
          w: 6.2,
          h: 0.4,
          fontSize: 12,
          underline: true,
          hyperlink: { url: p.url },
        });
      if (p.pdfUrl)
        s.addText("Spec sheet (PDF)", {
          x: 6.2,
          y: 6.2,
          w: 6.2,
          h: 0.4,
          fontSize: 12,
          underline: true,
          hyperlink: { url: p.pdfUrl },
        });
    }

    // ---- back pages: warranty then service
    for (const url of ["/pptx/warranty.jpg", "/pptx/service.jpg"]) {
      try {
        const dataUrl = await urlToDataUrl(url);
        const s = pptx.addSlide();
        s.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: FULL_W,
          h: FULL_H,
          sizing: { type: "cover", w: FULL_W, h: FULL_H },
        } as any);
      } catch {}
    }

    const filename = `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
    await pptx.writeFile({ fileName: filename });
  }

  // ---- UI ------------------------------------------------------------------

  return (
    <div className="wrap">
      <h1>Product Selection</h1>

      {/* form */}
      <div className="card form">
        <div className="grid2">
          <label>
            <div>Project name</div>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project Selection"
            />
          </label>
          <label>
            <div>Client name</div>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            <div>Your name (contact)</div>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your Name"
            />
          </label>
          <label>
            <div>Date</div>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="dd/mm/yyyy"
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            <div>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            <div>Phone</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0000 000 000"
            />
          </label>
        </div>
      </div>

      {/* toolbar */}
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search products, SKU, description..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="category" value={cat} onChange={(e) => setCat(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as "sheet" | "name")}
        >
          <option value="sheet">Sheet order</option>
          <option value="name">Name (A–Z)</option>
        </select>

        <div className="spacer" />
        <div className="muted">Selected: {selectedList.length}</div>
        <button className="primary" onClick={exportPptx}>
          Export PPTX
        </button>
      </div>

      {/* status */}
      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p>Loading…</p>}

      {/* grid */}
      <div className="grid">
        {(visible ?? []).map((p, i) => {
          const k = keyOf(p);
          const isSel = !!selected[k];
          return (
            <div className={"card product" + (isSel ? " selected" : "")} key={k + i}>
              <label className="checkbox">
                <input type="checkbox" checked={isSel} onChange={() => toggle(p)} />
              </label>

              <div className="thumb">
                {p.imageProxied ? (
                  <img src={p.imageProxied} alt={p.name || p.code || "product"} />
                ) : (
                  <div className="ph">No image</div>
                )}
              </div>

              <div className="body">
                <div className="name">{title(p.name)}</div>
                {p.code && <div className="sku">SKU: {p.code}</div>}
                {p.description && <p className="desc">{p.description}</p>}

                {p.specsBullets && p.specsBullets.length > 0 && (
                  <ul className="specs">
                    {p.specsBullets.slice(0, 4).map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                )}

                <div className="links">
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      Product page
                    </a>
                  )}
                  {p.pdfUrl && (
                    <a
                      href={`/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Spec sheet (PDF)
                    </a>
                  )}
                </div>

                {p.category && <div className="category">Category: {p.category}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
