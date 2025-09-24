import { useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { fetchProducts } from "./lib/products";
import { exportPptx } from "./lib/exportPptx";

// inside your button handler:
await exportPptx(selectedList, {
  projectName,
  clientName,
  contactName,
  email,
  phone,
  date,
});


// utils
const includes = (h: string, n: string) => h.toLowerCase().includes(n.toLowerCase());
const title = (s?: string) => (s ?? "").trim() || "—";

async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(String(r.result)); r.readAsDataURL(b); });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" }); const b = await r.blob(); return blobToDataUrl(b);
}

export default function App() {
  // load products
  const [items, setItems] = useState<Product[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { (async () => {
    try { const ps = await fetchProducts("Products!A:Z"); setItems(ps); }
    catch (e: any) { setErr(e?.message || "fetch error"); }
  })(); }, []);

  // selection
  const keyOf = (p: Product) => (p.code || p.name || "") + "::" + (p.url || "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedList = useMemo(() => (items ?? []).filter(p => selected[keyOf(p)]), [items, selected]);
  const toggle = (p: Product) => setSelected(s => ({ ...s, [keyOf(p)]: !s[keyOf(p)] }));

  // filters
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All");
  const [sort, setSort] = useState<"sheet" | "name">("sheet");
  const categories = useMemo(() => {
    const s = new Set<string>(); for (const p of items ?? []) if (p.category) s.add(p.category);
    return ["All", ...Array.from(s).sort()];
  }, [items]);
  const visible = useMemo(() => {
    let a = [...(items ?? [])];
    if (q) a = a.filter(p => includes(p.name ?? "", q) || includes(p.code ?? "", q) || includes(p.description ?? "", q) || includes(p.category ?? "", q));
    if (cat !== "All") a = a.filter(p => p.category === cat);
    if (sort === "name") a.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
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
  // put this inside your App component, replacing your current exportPptx()
async function exportPptx() {
  if (selectedList.length === 0) {
    alert("Select at least one product.");
    return;
  }

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();
  const W = 10;          // default PPT size in inches
  const H = 5.625;

  // util to safely add a full-bleed image from /public (skips if not found)
  async function addFullImage(slide: any, path: string) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) return;
      const b = await r.blob();
      const data = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onloadend = () => res(String(fr.result));
        fr.readAsDataURL(b);
      });
      slide.addImage({ data, x: 0, y: 0, w: W, h: H });
    } catch {
      /* ignore if not present */
    }
  }

  // 1) Title / Cover (always works with text; optionally overlays a cover image)
  const s0 = pptx.addSlide();
  s0.addText("Product Selection", { x: 0.7, y: 0.7, fontSize: 34, bold: true });
  s0.addText(
    [
      projectName || "Project Selection",
      clientName ? `Client: ${clientName}` : "",
      contactName ? `Prepared by: ${contactName}` : "",
      email ? `Email: ${email}` : "",
      phone ? `Phone: ${phone}` : "",
      date ? `Date: ${date}` : "",
    ].filter(Boolean).join("\n"),
    { x: 0.7, y: 1.6, w: 8.6, h: 2.4, fontSize: 16 }
  );
  // optional background image if you upload /public/branding/cover.jpg
  await addFullImage(s0, "/branding/cover.jpg");

  // 2) Warranty (optional — uses /public/branding/warranty.jpg if present)
  const sW = pptx.addSlide();
  await addFullImage(sW, "/branding/warranty.jpg");

  // 3) Product slides
  for (const p of selectedList) {
    const s = pptx.addSlide();

    // product image (proxied) - contain inside a fixed box
    try {
      if (p.imageProxied) {
        const r = await fetch(p.imageProxied, { cache: "no-store" });
        if (r.ok) {
          const dataUrl = await new Promise<string>((res) => {
            r.blob().then((b) => {
              const fr = new FileReader();
              fr.onloadend = () => res(String(fr.result));
              fr.readAsDataURL(b);
            });
          });
          s.addImage({
            data: dataUrl,
            x: 0.5,
            y: 0.8,
            w: 5.4,
            h: 3.9,
            sizing: { type: "contain", w: 5.4, h: 3.9 },
          });
        }
      }
    } catch {}

    // right column text
    s.addText((p.name ?? "—").trim() || "—", {
      x: 6.2,
      y: 0.8,
      w: 3.6,
      h: 0.6,
      fontSize: 22,
      bold: true,
    });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.5, w: 3.6, h: 0.35, fontSize: 12 });
    if (p.description) {
      s.addText(p.description, { x: 6.2, y: 1.9, w: 3.6, h: 1.0, fontSize: 12 });
    }

    // ✅ real bullet points (specs)
    const bulletItems =
      (p.specsBullets ?? []).map((t: string) => ({ text: t, options: { bullet: true, fontSize: 12 } }));
    if (bulletItems.length) {
      s.addText(bulletItems, { x: 6.2, y: 3.05, w: 3.6, h: 1.6 });
    }

    if (p.category) {
      s.addText(`Category: ${p.category}`, { x: 6.2, y: 4.75, w: 3.6, h: 0.35, fontSize: 11 });
    }

    let linkY = 5.15;
    if (p.url) {
      s.addText("Product page", {
        x: 6.2, y: linkY, w: 3.6, h: 0.3, fontSize: 12, underline: true, hyperlink: { url: p.url },
      });
      linkY += 0.35;
    }
    if (p.pdfUrl) {
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: linkY, w: 3.6, h: 0.3, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl },
      });
    }
  }

  // 4) Outro / branded slides (optional if images exist)
  const end1 = pptx.addSlide();
  await addFullImage(end1, "/branding/end-1.jpg");

  const end2 = pptx.addSlide();
  await addFullImage(end2, "/branding/end-2.jpg");
  // light overlay text (works even if the image is missing)
  end2.addText(
    [
      projectName || "Product Selection",
      clientName ? `for ${clientName}` : "",
      contactName ? `Prepared by ${contactName}` : "",
      email || "",
      phone || "",
    ].filter(Boolean).join("\n"),
    { x: 0.7, y: 4.1, w: 8.6, h: 1.1, fontSize: 14, color: "FFFFFF" }
  );

  await pptx.writeFile({
    fileName: `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`,
  });
}


    // cover
    pptx.addSlide().addText(
      [
        { text: projectName || "Project Selection", options: { fontSize: 28, bold: true } },
        { text: clientName ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
        { text: contactName ? `\nPrepared by: ${contactName}` : "", options: { fontSize: 16 } },
        { text: email ? `\nEmail: ${email}` : "", options: { fontSize: 14 } },
        { text: phone ? `\nPhone: ${phone}` : "", options: { fontSize: 14 } },
        { text: date ? `\nDate: ${date}` : "", options: { fontSize: 14 } },
      ], { x: 0.6, y: 0.6, w: 12, h: 6 }
    );

    // slides
    for (const p of selectedList) {
      const s = pptx.addSlide();
      try {
        if (p.imageProxied) {
          const dataUrl = await urlToDataUrl(p.imageProxied);
          s.addImage({ data: dataUrl, x: 0.5, y: 0.7, w: 5.5, h: 4.1, sizing: { type: "contain", w: 5.5, h: 4.1 } });
        }
      } catch {}
      const lines: string[] = [];
      if (p.description) lines.push(p.description);
      if (p.specsBullets?.length) lines.push("• " + p.specsBullets.join("\n• "));
      if (p.category) lines.push(`\nCategory: ${p.category}`);
      s.addText(title(p.name), { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
      s.addText(p.code ? `SKU: ${p.code}` : "", { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });
      s.addText(lines.join("\n"), { x: 6.2, y: 1.9, w: 6.2, h: 3.7, fontSize: 12 });
      if (p.url) s.addText("Product page", { x: 6.2, y: 5.8, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.url } });
      if (p.pdfUrl) s.addText("Spec sheet (PDF)", { x: 6.2, y: 6.2, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });
    }
    const filename = `${(projectName || "Selection").replace(/[^\w-]+/g,"_")}.pptx`;
    await pptx.writeFile({ fileName: filename });
  }

  return (
    <div className="wrap">
      <h1>Product Selection</h1>

      {/* form */}
      <div className="card form">
        <div className="grid2">
          <label><div>Project name</div><input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Project Selection"/></label>
          <label><div>Client name</div><input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Client name"/></label>
        </div>
        <div className="grid2">
          <label><div>Your name (contact)</div><input value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="Your name"/></label>
          <label><div>Date</div><input value={date} onChange={e=>setDate(e.target.value)} placeholder="dd/mm/yyyy"/></label>
        </div>
        <div className="grid2">
          <label><div>Email</div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label><div>Phone</div><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0000 000 000"/></label>
        </div>
      </div>

      {/* toolbar */}
      <div className="toolbar">
  <input className="search" ... />

  {/* add className="category" */}
  <select className="category" value={cat} onChange={e=>setCat(e.target.value)}>
    {categories.map(c => <option key={c} value={c}>{c}</option>)}
  </select>

  {/* add className="sort" */}
  <select className="sort" value={sort} onChange={e=>setSort(e.target.value as any)}>
    <option value="sheet">Sheet order</option>
    <option value="name">Name (A–Z)</option>
  </select>

  <div className="spacer" />
  <div className="muted">Selected: {selectedList.length}</div>
  <button className="primary" onClick={exportPptx}>Export PPTX</button>
</div>


      {/* status */}
      {err && <p className="error">Error: {err}</p>}
      {!items && !err && <p>Loading…</p>}

      {/* grid */}
      <div className="grid">
        {(visible ?? []).map((p: Product, i: number) => {
          const k = keyOf(p); const isSel = !!selected[k];
          return (
            <div className={"card product" + (isSel ? " selected" : "")} key={k + i}>
              <label className="checkbox"><input type="checkbox" checked={isSel} onChange={()=>toggle(p)} /></label>
              <div className="thumb">{p.imageProxied ? <img src={p.imageProxied} alt={p.name || p.code || "product"} /> : <div className="ph">No image</div>}</div>
              <div className="body">
                <div className="name">{title(p.name)}</div>
                {p.code && <div className="sku">SKU: {p.code}</div>}
                {p.description && <p className="desc">{p.description}</p>}
                {p.specsBullets && p.specsBullets.length > 0 && (
                  <ul className="specs">{p.specsBullets.slice(0,4).map((s: string, j: number) => <li key={j}>{s}</li>)}</ul>
                )}
                <div className="links">
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer">Product page</a>}
                  {p.pdfUrl && <a href={`/api/pdf-proxy?url=${encodeURIComponent(p.pdfUrl)}`} target="_blank" rel="noreferrer">Spec sheet (PDF)</a>}
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
