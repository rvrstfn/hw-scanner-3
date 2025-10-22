# Hardware Checkout Scanner

Cloudflare Worker that powers a mobile-friendly web app for logging laptop barcode scans. Employees select their name, snap a photo of the asset sticker (linear barcode only), and the Worker decodes + stores the registration in D1.

## What’s included

- Mobile-first UI served from the Worker (`GET /`)
- Employee roster with search suggestions
- Camera capture + upload workflow (`POST /api/scan`)
- Automatic barcode decode via ZXing (linear formats only)
- D1 storage for successful scans
- CSV (`/api/scans.csv`) and JSON (`/api/scans`) exports for Excel or auditing

## Setup

1. Install dependencies: `npm install`
2. Create a D1 database:

   ```bash
   wrangler d1 create hw_scanner_3
   wrangler d1 execute hw_scanner_3 --file=./db/schema.sql
   ```

   Update `wrangler.toml` with the generated `database_id`.

3. (Optional) Adjust the employee roster in `src/index.js` (`EMPLOYEES` array).

## Local development

```
npm run dev -- --local
```

Open `http://127.0.0.1:8787` on your phone/desktop. The “Download CSV” button will use the local D1 database populated by Wrangler.

## Automated test

```
npm test
```

Runs a smoke test against the bundled `barcode-QR-label.jpg` to ensure the decoder still returns the expected barcode (`CODE_128`).

## API overview

- `GET /` – Web app UI
- `GET /api/employees` – Current roster
- `POST /api/scan` – Multipart form with `employeeName` + `image`
- `GET /api/scans` – JSON array of scans (most recent first)
- `GET /api/scans.csv` – CSV export for Excel
- `POST /api/decode` – Raw JPEG decode endpoint (reuse of the original API)

Error responses return JSON payloads with an `error` field explaining what went wrong.
