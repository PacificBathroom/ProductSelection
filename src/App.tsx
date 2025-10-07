// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./lib/exportPptx";
import { SettingsProvider, useSettings } from "./state/SettingsProvider";
import SettingsBridge from "./state/SettingsBridge";
import ContactProjectForm from "./components/ContactProjectForm";

/* ---------- helpers ---------- */
const textIncludes = (hay: string | undefined, needle: string) =>
  (hay ?? "").toLowerCase().includes(needle.toLowerCase());

const keyOf = (p: Product) =>
  (p.code || p.name || "") + "::" + ((p as any).url || "");

const safeTitle = (s?: string) => (s ?? "").trim() || "—";

/** Convert Drive share links to direct-download URLs */
function toDirectImageUrl(u?: string) {
  if (!u) return u;
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

/** Find an image URL from any possible field */
function detectImageUrl(p: any): string | undefined {
  const fields = [
    p.imageProxied,
    p.imageUrl,
    p.image,
    p.img,
    p.thumbnail,
    p.picture,
  ].filter(Boolean);
  if (fields.length > 0) return fields[0];

  // fallback: scan all fields for any image-looking URL
  for (const v of Object.values(p)) {
    const s = String(v || "").trim();
    if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(s)) return s;
    if (/drive\.google\.com\/file\/d\//i.test(s)) return s;
  }
  return undefined;
}

/** Add proxied image URL for same-origin export use */
function augmentProductImages(p: Product): Product {
  const raw = detectImageUrl(p);
  const direct = toDirectImageUrl(raw);
  const imageProxied =
    direct && /^https?:\/\//i.test(direct)
      ? `/api/fetch-image?url=${encodeURIComponent(direct)}`
      : direct;
  return { ...p, imageProxied };
}

/* ---------- main section ---------- */
function MainProductPage() {
  const { contact, project } = useSettings();
  const [items, setItems] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ps = await fetchProducts("Products!A:Z");
        setItems(ps.map(augmentProductImages));
      } catch (e: any) {
        setErr(e?.message || "fetch error");
      }
    })();
  }, []);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(
    () => (items ?? []).filter((p) => selected[keyOf(p)]),
    [items, selected]
  );
  const toggle = (p: Product) =>
    setSelected((s) => ({ ...s, [keyOf(p)]: !s[keyOf(p)] }));

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<"sheet" | "name">("sheet");

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of items ?? [])
      if ((p as any).category) s.add((p as any).category);
    return ["All", ...Array.from(s).sort()];
  }, [items]);

  const visible = useMemo(() => {
    let a = [...(items ?? [])];
    if (q) {
      a = a.filter(
        (p: any) =>
          textIncludes(p.name, q) ||
          textIncludes(p.code, q) ||
          textIncludes(p.description, q) ||
          textIncludes(p.category, q)
      );
    }
    if (cat !== "All") a = a.filter((p: any) => p.category === cat);
    if (sort === "name")
      a.sort((x: any, y: any) => (x.name || "").localeCompare(y.name || ""));
    return a;
  }, [items, q, cat, sort]);

 async function onExportClick() {
  const list = selectedList.length ? selectedList : visible;
  if (!list.length) {
    alert("No products to export.");
    return;
  }

  try {
    // 1) do the export first
    await exportPptx({
      projectName: project.projectName || "Product Presentation",
      clientName: project.clientName || "",
      contactName: `${contact.contactName}${contact.title ? ", " + contact.title : ""}`,
      email: contact.email,
      phone: contact.phone,
      date: project.presentationDate || "",
      items: list,
      coverImageUrls: ["/branding/cover.jpg"],
      backImageUrls: ["/branding/warranty.jpg", "/branding/service.jpg"],
    });

    // 2) clear selections/filters
    setSelected({});
    setQ("");
    setCat("All");
    setSort("sheet");

    // 3) clear any persisted form state (SettingsBridge usually uses "settings")
    try {
      localStorage.removeItem("selectedProductIds");
      localStorage.removeItem("settings");
      localStorage.removeItem("contact");
      localStorage.removeItem("project");
    } catch {}

    // 4) refresh the form UI
    window.location.reload();
  } catch (e: any) {
    console.error("Export failed", e);
    alert("Export failed: " + (e?.message || e));
  }
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
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="sort"
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as "sheet" | "name")
            }
          >
            <option value="sheet">Sheet order</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
        <div className="toolbar-right">
          <span className="muted">Selected: {selectedList.length}</span>
          <button className="primary" onClick={onExportClick}>
            Export PPTX
          </button>
        </div>
      </div>

      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p className="muted">Loading…</p>}

      <div className="grid">
        {(visible ?? []).map((p: any, i: number) => {
          const k = keyOf(p);
          const isSel = !!selected[k];
          const pdfUrl = p.pdfUrl;
          const pageUrl = p.url;

          return (
            <div
              className={"card product" + (isSel ? " selected" : "")}
              key={k + i}
            >
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(p)}
                />
              </label>

              <div className="thumb">
                {p.imageProxied || p.imageUrl || p.image ? (
                  <img
                    src={p.imageProxied || p.imageUrl || p.image}
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
                {p.specsBullets?.length > 0 && (
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
                {p.category && (
                  <div className="category">Category: {p.category}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- wrapper ---------- */
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
              Fill in your contact &amp; project details on the left, then pick
              products below. Use the search and filters to narrow down, tick
              items, and click <strong>Export PPTX</strong>.
            </p>
          </div>
        </div>

        <MainProductPage />
      </main>
    </SettingsProvider>
  );
}
