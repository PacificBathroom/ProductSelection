// src/types.ts
export type Product = {
  code?: string;
  name?: string;
  url?: string;

  // images
  imageUrl?: string;        // raw/original
  imageProxied?: string;    // same-origin proxied url

  // content
  description?: string;
  specsBullets?: string[];

  // spec
  pdfUrl?: string;

  // misc
  category?: string;
};
