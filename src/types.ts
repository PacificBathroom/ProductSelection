// src/types.ts
export type Contact = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type Product = {
  // Selection & core identifiers
  select?: string;          // "Select" column (checkbox/text)
  url?: string;             // "Url" (product page)
  code?: string;            // "Code" (SKU or similar)
  name?: string;            // "Name"

  // Images
  imageUrl?: string;        // "ImageURL" raw (from sheet)
  imageProxied?: string;    // resolved via your /api/file-proxy

  // Marketing copy
  description?: string;     // "Description"
  specsBullets?: string[];  // parsed from "SpecsBullets" (pipe- or line-separated in sheet)

  // Specs / PDF linking
  pdfUrl?: string;          // lowercase variant you already had
  PdfURL?: string;          // optional: exact header match if your sheet uses "PdfURL"
  PdfKey?: string;          // optional: new column; maps to /specs/<PdfKey>.pdf
  PdfFile?: string;         // optional: new column; maps to /specs/<PdfFile>
  // (If you later use Google Drive IDs you can add: PdfId?: string)

  // Categorisation
  category?: string;        // "Category"

  // Contact details per product (rare, but supported)
  contact?: Contact;        // Contact* fields

  // Keep everything else too (all other headers come through)
  [key: string]: unknown;
};
