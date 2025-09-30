export type Product = {
  code?: string;
  name?: string;
  url?: string;

  // images
  imageUrl?: string;       // original URL (optional)
  imageProxied?: string;   // same-origin/proxied URL we actually use

  // text
  description?: string;
  specsBullets?: string[];

  // specs
  pdfUrl?: string;
  pdfKey?: string;

  // optional grouping
  category?: string;
};
