// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./lib/exportPptx";

// small helpers
const includes = (h: string, n: string) => h.toLowerCase().includes(n.toLowerCase());
const title = (s?: string) => (s ?? "").trim() || "—";

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
    if (sort === "name") a.sort((x, y) => (x.name || "").localeCompare(y.name || ""));
    return a;
  }, [items, q, cat, sort]);

  // header form
  const [projectName, setProjectName] = useState("Product Presentation");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");

  // export
  async function onExportClick() {
    if (selectedList.length === 0) {
      alert("Select at least one product.");
      return;
    }

    // helpful logs
    console.log("[export] projectName:", projectName);
    console.log("[export] clientName:", clientName);
    console.log("[export] contact:", { contactName, email, phone, address, date });
    console.log("[export] selectedList length:", selectedList.length);
    console.log("[export] first item:", selectedList[0]);

    await exportPptx({
      projectName,
      clientName,
      contactName,
      email,
      phone,
      address,
      date: date || new Date().toLocaleDateString(),
      items: selectedList,
    });
  }

  // debug export to validate exporter independently of sheet data
  async function onDebugExport() {
    const fakeItem: any = {
      name: "Debug Product",
      code: "SAMPLE",
      description: "This is a debug product to verify PPT export.",
      imageUrl: "",
      imageProxied: "",
      specsBullets: ["One", "Two", "Three"],
      PdfKey: "sample", // requires public/specs/sample.pdf in your repo
      category: "Debug",
      contact: {
        name: "Alex Debug",
        email: "alex@example.com",
        phone: "0400 000 000",
        address: "123 Example St",
      },
    };

    await exportPptx({
      projectName: "DEBUG PROJECT",
      clientName: "DEBUG CLIENT",
      contactName: "Casey Exporter",
      email: "casey@example.com",
      phone: "0400 000 001",
      address: "Suite 1, 123 Test Rd",
      date: new Date().toLocaleDateString(),
      items: [fakeItem],
    });
  }

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

        {/* Address row */}
        <div className="grid2">
          <label>
            <div>Address</div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Suite 1, 123 Example St, Brisbane QLD"
            />
          </label>
          <div /> {/* spacer to keep grid balanced */}
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
        <select
          className="category"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
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
        <button className="primary" onClick={onExportClick}>
          Export PPTX
        </button>
        <button onClick={onDebugExport} title="Exports a sample deck to verify the exporter">
          Debug Export
        </button>
      </div>

      {/* status */}
      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p>Loading…</p>}

      {/* grid */}
      <div className="grid">
        {(visible ?? []).map((p: Product, i: number) => {
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
                    {p.specsBullets.slice(0, 4).map((s: string, j: number) => (
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
