// /api/sheet.ts
import { google } from "googleapis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey  = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const spreadsheetId =
  process.env.SHEETS_SPREADSHEET_ID || process.env.EETS_SPREADSHEET_ID;

if (!clientEmail || !privateKey || !spreadsheetId) {
  console.warn("⚠ Missing Google Sheets credentials in env vars");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rangeParam = String(req.query.range || "");
    const range = normalizeRange(rangeParam);

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      majorDimension: "ROWS",
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      range,
      values: resp.data.values || [],
    });
  } catch (err: any) {
    console.error("Sheets API error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch Google Sheet" });
  }
}

/** Ensure we always fetch wide range */
function normalizeRange(input?: string) {
  if (!input) return "Products!A:ZZZ";
  if (!input.includes("!")) return `${input}!A:ZZZ`;

  const [sheet, cols] = input.split("!");
  if (!cols.includes(":")) return `${sheet}!A:ZZZ`;
  return `${sheet}!${cols.split(":")[0].replace(/\d+$/, "") || "A"}:ZZZ`;
}
