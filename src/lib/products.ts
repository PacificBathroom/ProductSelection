// src/lib/products.ts (where you build your Product objects)
import { toDirectImageUrl } from "./utils/urls";

function mapRow(row: Row): Product {
  const image = toDirectImageUrl(row.Image || row.image || row.Picture);
  return {
    name: row.Name,
    sku: row.SKU,
    description: row.Description,
    categoryPath: row.Category,
    warrantyFinish: row.WarrantyFinish,
    warrantyLabour: row.WarrantyLabour,
    image,
    // give the exporter a pre-proxied URL so CORS is never an issue:
    ...(image ? { imageProxied: `/api/fetch-image?url=${encodeURIComponent(image)}` } : {}),
  } as any;
}
