export type Product = {
  code?: string;
  name?: string;
  url?: string;
  description?: string;
  category?: string;

  // images
  image?: string;
  imageUrl?: string;     
  imageProxied?: string;  

  // text
  description?: string;
  specsBullets?: string[];

    // links/specs
  url?: string;       // product page
 specsBullets?: string[]; // feature bullets

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

