// --- replace your header helpers with these ---

// normalize "Contact Name" => "contactname", "Pdf Key" => "pdfkey", "Image URL" => "imageurl"
function normHeader(s: unknown): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// case-insensitive, punctuation-insensitive header lookup
function indexOfHeader(headers: string[], ...candidates: string[]): number {
  const normed = headers.map(normHeader);
  for (const c of candidates) {
    const target = normHeader(c);
    const i = normed.indexOf(target);
    if (i >= 0) return i;
  }
  return -1;
}

function getCell(row: any[], headers: string[], ...names: string[]): unknown {
  const i = indexOfHeader(headers, ...names);
  return i >= 0 ? row[i] : undefined;
}
