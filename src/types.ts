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

// src/types.ts
export type ContactInfo = {
  company?: string;
  contactName: string;
  email: string;
  phone?: string;
  title?: string;
};

export type ProjectMeta = {
  projectName?: string;
  clientName?: string;
  presentationDate?: string; // 'YYYY-MM-DD'
};

