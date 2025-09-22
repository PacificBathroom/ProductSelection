export const API_BASE = import.meta.env.VITE_API_BASE || ''; // set in .env for local, empty on Vercel
export const sheetsUrl = `${API_BASE}/api/sheets`;
export const proxyUrl = (u: string) =>
  `${API_BASE}/api/file-proxy?url=${encodeURIComponent(u)}`;
