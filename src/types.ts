export type Product = {
  code?: string;
  name?: string;
  imageUrl?: string;        // raw image URL from sheet
  imageProxied?: string;    // via /api/file-proxy
  description?: string;
  specsBullets?: string[];  // split from multi-line/spec text
  pdfUrl?: string;
  category?: string;
  [key: string]: unknown;   // keep any extra columns too
};
