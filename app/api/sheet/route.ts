// app/api/sheet/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL!;
const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!;

// convert escaped "\n" to real newlines (Vercel stores them escaped)
const PRIVATE_KEY = RAW_PRIVATE_KEY?.replace(/\\n/g, "\n");

// cache the google sheets client across invocations
let sheetsSingleton: ReturnType<typeof google.sheets> | null = null;

async function getSheets() {
  if (sheetsSingleton) return sheetsSingleton;

  if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Missing Google Sheets env vars.");
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  // authorize once
  await auth.authorize();

  sheetsSingleton = google.sheets({ version: "v4", auth });
  return sheetsSingleton;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // default to Products!A:ZZZ so we never miss columns where specs might live
  const range = url.searchParams.get("range") || "Products!A:ZZZ";

  try {
    const sheets = await getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const values = resp.data.values ?? [];
    return NextResponse.json(
      { values },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[/api/sheet] error:", err);
    return NextResponse.json(
      { error: err?.message || "Sheet fetch failed" },
      { status: 500 }
    );
  }
}
