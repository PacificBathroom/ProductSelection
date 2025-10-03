// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./lib/exportPptx";
import { SettingsProvider, useSettings } from "./state/SettingsProvider";
import SettingsBridge from "./state/SettingsBridge"; // ensure this file exists (see earlier message)
import ContactProjectForm from "./components/ContactProjectForm";

/* ------------------------------- small helpers ------------------------------- */
const textIncludes = (hay: string | undefined, needle: string) =>
  (hay ?? "").toLowerCase().includes(needle.toLowerCase());

const safeTitle = (s?: string) => (s ?? "").trim() || "—";
const keyOf = (p: Product) => (p.code || p.name || "") + "::" + ((p as any).url || "");

/* -------------------------------- UI bits ----------------------------------- */
function CoverPreview() {
  const { contact, project } = useSettings();
  return (
    <div className="mt-6 p-4 border rounded">
      <h4 className="font-semibold mb-2">Cover Preview (data available to export)</h4>
      <div className="text-sm grid grid-cols-2 gap-2">
        <div><strong>Contact:</strong> {contact.contactName} {contact.title ? `(${contact.title})` : ""}</div>
        <div><strong>Email:</strong> {contact.email}</div>
        <div><strong>Phone:</strong> {contact.phone || "—"}</div>
        <div><strong>Company:</strong> {contact.company || "—"}</div>
        <div><strong>Project:</strong> {project.projectName || "—"}</div>
        <div><strong>Client:</strong> {project.clientName || "—"}</div>
        <div><strong>Date:</strong> {project.presentationDate || "—"}</div>
      </div>
    </div>
  );
}

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
      <div className="toolbar mt-6 flex gap-2 items-center">
        <input
          className="search border rounded px-3 py-2"
          placeholder="Search products, SKU, description..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="category border rounded px-3 py-2"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="sort border rounded px-3 py-2"
          value={sort}
          onChange={(e) => setSort(e.target.value as "sheet" | "name")}
        >
          <option value="sheet">Sheet order</option>
          <option value="name">Name (A–Z)</option>
        </select>

        <div className="flex-1" />
        <div className="muted">Selected: {selectedList.length}</div>
        <button className="primary px-4 py-2 rounded bg-black text-white" onClick={onExportClick}>
          Export PPTX
        </button>
      </div>

      {/* status */}
      {err && <p className="error mt-2 text-red-600">Error: {err}</p>}
      {!items && !err && <p className="mt-2">Loading…</p>}

      {/* product grid */}
      <div className="grid mt-4">
        {(visible ?? []).map((p: Product, i: number) => {
          const k = keyOf(p);
          const isSel = !!selected[k];
          const pdfUrl = (p as any).pdfUrl as string | undefined; // avoid TS errors if not in Product type
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
                <div className="name font-medium">{safeTitle(p.name)}</div>
                {p.code && <div className="sku text-xs opacity-70">SKU: {p.code}</div>}
                {p.description && <p className="desc mt-1">{p.description}</p>}

                {p.specsBullets && p.specsBullets.length > 0 && (
                  <ul className="specs mt-2 list-disc pl-5">
                    {p.specsBullets.slice(0, 4).map((s: string, j: number) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                )}

                <div className="links mt-2 flex gap-3 text-sm">
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

                {p.category && <div className="category mt-2 text-xs opacity-70">Category: {p.category}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------ app wrapper ---------------------------------- */
export default function App() {
  return (
    <SettingsProvider>
      <SettingsBridge />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Project Setup</h1>
        <ContactProjectForm />
        <CoverPreview />
        <MainProductPage />
      </main>
    </SettingsProvider>
  );
}
