export type Contact = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type Product = {
  select?: string;          // "Select" column (checkbox/text)
  url?: string;             // "Url"
  code?: string;            // "Code"
  name?: string;            // "Name"
  imageUrl?: string;        // "ImageURL" raw
  imageProxied?: string;    // via /api/file-proxy
  description?: string;     // "Description"
  specsBullets?: string[];  // from "SpecsBullets"
  pdfUrl?: string;          // "PdfURL"
  category?: string;        // "Category"

  contact?: Contact;        // Contact* fields

  // keep everything else too
  [key: string]: unknown;
};
