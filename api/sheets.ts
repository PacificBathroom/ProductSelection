// api/sheets.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { SHEETS_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
    if (!SHEETS_SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Missing Google Sheets environment variables' });
    }

    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // adjust the sheet/tab name if yours is not "Products"
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_SPREADSHEET_ID,
      range: 'Products!A:Z',
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ values: data.values ?? [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'sheets error' });
  }
}
