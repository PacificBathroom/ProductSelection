// src/types.ts

export type Product = {
  // identifiers / basic info
  code?: string;
  name?: string;
  description?: string;
  category?: string;

  // links
  url?: string;           // product page

  // images
  image?: string;         // raw source (if present)
  imageUrl?: string;      // alias some sheets use
  imageProxied?: string;  // /api/fetch-image?url=...

  // specs / features
  specsBullets?: string[]; // feature bullets for UI/export
  pdfUrl?: string;         // spec sheet URL
  pdfKey?: string;         // optional local key for previews
};

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
