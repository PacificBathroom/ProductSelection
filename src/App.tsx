// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./lib/exportPptx";
import { SettingsProvider, useSettings } from "./state/SettingsProvider";
import SettingsBridge from "./state/SettingsBridge";
import ContactProjectForm from "./components/ContactProjectForm";

/* helpers */
const textIncludes = (hay: string | undefined, needle: string) =>
  (hay ?? "").toLowerCase().includes(needle.toLowerCase());
const keyOf = (p: Product) => (p.code || p.name || "") + "::" + ((p as any).url || "");
const safeTitle = (s?: string) => (s ?? "").trim() || "—";

/* --------------------------- main product section --------------------------- */
function MainProductPage() {
  const { contact, project } = useSettings();

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
    if (q) {
      a = a.filter(
        (p) =>
          textIncludes(p.name, q) ||
          textIncludes(p.code, q) ||
          textIncludes(p.description, q) ||
          textIncludes(p.category, q)
      );
    }
    if (cat !== "All") a = a.filter((p) => p.category === cat);
    if (sort === "name") a.sort((x, y) => (x.name || "").localeCompare(y.name || ""));
    return a;
  }, [items, q, cat, sort]);

  // export
  async function onExportClick() {
    const list = selectedList.length ? selectedList : visible;
    if (!list.length) {
      alert("No products to export.");
      return;
    }
    await exportPptx({
      projectName: project.projectName || "Product Presentation",
      clientName: project.clientName || "",
      contactName: `${contact.contactName}${contact.title ? ", " + contact.title : ""}`,
      email: contact.email,
      phone: contact.phone,
      date: project.presentationDate || "",
      items: list,
    });
  }

  return (
    <>
      {/* toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
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
              <option key={c} value={c}>{c}</option>
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
        </div>
        <div className="toolbar-right">
          <span className="muted">Selected: {selectedList.length}</span>
          <button className="primary" onClick={onExportClick}>Export PPTX</button>
        </div>
      </div>

      {/* status */}
      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p className="muted">Loading…</p>}

      {/* product grid */}
      <div className="grid">
        {(visible ?? []).map((p: Product, i: number) => {
          const k = keyOf(p);
          const isSel = !!selected[k];
          const pdfUrl = (p as any).pdfUrl as string | undefined;
          const pageUrl = (p as any).url as string | undefined;

          return (
            <div className={"card product" + (isSel ? " selected" : "")} key={k + i}>
              <label className="checkbox">
                <input type="checkbox" checked={isSel} onChange={() => toggle(p)} />
              </label>

              <div className="thumb">
                {p.imageProxied || (p as any).imageUrl ? (
                  <img
                    src={p.imageProxied || (p as any).imageUrl}
                    alt={p.name || p.code || "product"}
                  />
                ) : (
                  <div className="ph">No image</div>
                )}
              </div>

              <div className="body">
                <div className="name">{safeTitle(p.name)}</div>
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
                  {pageUrl && (
                    <a href={pageUrl} target="_blank" rel="noreferrer">
                      Product page
                    </a>
                  )}
                  {pdfUrl && (
                    <a
                      href={`/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`}
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
    </>
  );
}

/* ------------------------------- app wrapper ------------------------------- */
export default function App() {
  return (
    <SettingsProvider>
      <SettingsBridge />
      <main className="container">
        <header className="page-header">
          <h1 className="page-title">Project Setup</h1>
        </header>

        <div className="grid-2">
          <div className="card form">
            <ContactProjectForm />
          </div>
          <div className="card info">
            <p className="muted">
              Fill in your contact &amp; project details on the left, then pick products below.
              Use the search and filters to narrow down, tick items, and click <strong>Export PPTX</strong>.
            </p>
          </div>
        </div>

        <MainProductPage />
      </main>
    </SettingsProvider>
  );
}
