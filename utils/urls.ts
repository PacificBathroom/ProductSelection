// utils/urls.ts
export function toDirectImageUrl(u?: string) {
  if (!u) return u;
  // Google Drive sharing links -> direct content
  // https://drive.google.com/file/d/FILEID/view?usp=sharing -> https://drive.google.com/uc?export=download&id=FILEID
  const m = u.match(/drive\\.google\\.com\\/file\\/d\\/([^/]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}
