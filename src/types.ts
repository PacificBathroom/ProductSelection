// src/types.ts

export type Contact = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type Product = {
  select?: string;          // "Select" column (checkbox/text)
  url?: string;             // "Url"
  code?: string;            // "Code" / SKU
  name?: string;            // "Name"
  imageUrl?: string;        // "ImageURL" raw
  imageProxied?: string;    // via /api/file-proxy
  description?: string;     // "Description"
  specsBullets?: string[];  // parsed from "SpecsBullets"
  pdfUrl?: string;          // "PdfURL" (external link)
  category?: string;        // "Category"

  // new optional columns for local spec handling
  PdfFile?: string;         // explicit filename (e.g. VAN600.pdf)
  PdfKey?: string;          // key used to resolve /specs/<PdfKey>.pdf

  // contact info, either from sheet or form fallback
  contact?: Contact;

  // allow extra fields without type errors
  [key: string]: unknown;
};
