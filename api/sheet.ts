// api/sheet.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * ENV you need to set in Vercel:
 * - GSHEET_ID           (the spreadsheet id)
 * - GSHEET_API_KEY      (a Google API key with Sheets API enabled)
 *
 * Example:
 * GSHEET_ID=1AbC...your_sheet_id...
 * GSHEET_API_KEY=AIzaSy...
 */

const SHEET_ID = process.env.GSHEET_ID || process.env.NEXT_PUBLIC_GSHEET_ID;
const API_KEY  = process.env.GSHEET_API_KEY || process.env.NEXT_PUBLIC_GSHEET_API_KEY;

function normalizeRange(r?: string): string {
  // Default to the “Products” sheet if range missing
  let range = (r || "Products!A:ZZZ").trim();

  // If caller passed only the sheet name, widen to A:ZZZ
  if (!range.includes("!")) return `${range}!A:ZZZ`;

  // If it already has a column span, widen the right side to ZZZ
  // e.g. "Products!A:Z"  -> "Products!A:ZZZ"
  //      "Products!A1:Z999" -> "Products!A:ZZZ" (we want all rows & wide columns)
  const [sheet, cols] = range.split("!");
  if (!cols) return `${sheet}!A:ZZZ`;

  // Replace anything after the first colon with ZZZ
  if (cols.includes(":")) {
    const left = cols.split(":")[0].replace(/\d+$/, "") || "A";
    return `${sheet}!${left}:ZZZ`;
  }

  // If weird input, just force to A:ZZZ
  return `${sheet}!A:ZZZ`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!SHEET_ID || !API_KEY) {
      res.status(500).json({ error: "Missing GSHEET_ID or GSHEET_API_KEY env vars" });
      return;
    }

    const clientRange = String(req.query.range || "");
    const range = normalizeRange(clientRange);

    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}` +
      `/values/${encodeURIComponent(range)}?majorDimension=ROWS` +
      `&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      res.status(r.status).json({ error: "Sheets API error", status: r.status, body: text });
      return;
    }

    const json = await r.json();

    // Basic CORS (optional). Remove if you don't need it.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    res.status(200).json({
      range,
      values: json.values || [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "sheet proxy failed" });
  }
}
