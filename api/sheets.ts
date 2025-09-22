// api/sheets.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { SHEETS_SPREADSHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
    if (!SHEETS_SPREADSHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / SHEETS_SPREADSHEET_ID' });
    }

    // Optional query params
    const range = String(req.query.range || 'Products!A:Z');   // e.g. ?range=Products!A:Z
    const as = String(req.query.as || 'rows');                 // 'rows' | 'objects'

    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_SPREADSHEET_ID,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values: any[][] = data.values ?? [];

    if (as === 'objects' && values.length > 0) {
      const [head, ...rows] = values;
      const headers = head.map(h => String(h ?? '').trim());
      const objects = rows.map(r => {
        const o: Record<string, any> = {};
        headers.forEach((key, i) => (o[key || `col${i + 1}`] = r[i]));
        return o;
      });
      return res.status(200).json({ range, count: objects.length, values: objects });
    }

    // default: raw rows (array of arrays)
    return res.status(200).json({ range, count: values.length, values });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'sheets error' });
  }
}
