# Hardware Checkout Scanner

Cloudflare Worker that powers a mobile-friendly web app for logging laptop barcode scans. Employees select their name, snap a photo of the asset sticker (linear barcode only), the browser downsizes + compresses the photo, and the Worker decodes the barcode, stores the scan in D1, and archives the photo in R2 for later auditing.

## What’s included

- Mobile-first UI served from the Worker (`GET /`)
- Employee roster with search suggestions
- Camera capture + upload workflow (`POST /api/scan`)
- Automatic barcode decode via ZXing (linear formats only)
- Client-side resize/compress before upload (max edge ~1600 px, JPEG ~70 % quality)
- D1 storage for successful scans (employee, asset code, archived photo key)
- R2 archive of each barcode photo
- CSV (`/api/scans.csv`) and JSON (`/api/scans`) exports with direct photo links
- Admin dashboard (`/admin`) to review all scans, search, and preview archived photos

## Setup

1. Install dependencies: `npm install`
2. Create a D1 database:

   ```bash
   wrangler d1 create hw_scanner_3
   wrangler d1 execute hw_scanner_3 --file=./db/schema.sql
   ```

   Update `wrangler.toml` with the generated `database_id`.

3. Create an R2 bucket for archived images and bind it:

   ```bash
   wrangler r2 bucket create hw-scanner-archive
   ```

   Update `wrangler.toml` with the bucket name (binding `ARCHIVE_BUCKET`).

4. (Optional) Adjust the employee roster in `src/index.js` (`EMPLOYEES` array).

If you are upgrading an existing deployment, add the new `image_key` column once:

```
wrangler d1 execute hw_scanner_3 --remote --command "ALTER TABLE scans ADD COLUMN image_key TEXT;"
```

## Local development

For the full end-to-end experience (including R2 uploads), run Wrangler with the remote dev service:

```
npm run dev -- --remote
```

If you prefer fully local mode, seed the SQLite mirror whenever you restart Wrangler:

```
wrangler d1 execute hw_scanner_3 --local --persist-to=./.wrangler/tmp --file=./db/schema.sql
```

Open `http://127.0.0.1:8787` on your phone/desktop. Successful scans show up instantly and the CSV download includes a direct link to the archived JPEG.

## Automated test

```
npm test
```

Runs a smoke test against the bundled `barcode-QR-label.jpg` to ensure the decoder still returns the expected barcode (`CODE_128`).
The test suite uses in-memory D1 and R2 shims, so no real database or bucket is required for CI/local runs.

## API overview

- `GET /` – Web app UI
- `GET /api/employees` – Current roster
- `POST /api/scan` – Multipart form with `employeeName` + `image`
- `GET /api/scans` – JSON array of scans (most recent first, includes `imageUrl`)
- `GET /api/scans.csv` – CSV export for Excel (with image URL column)
- `GET /api/scans/:id/image` – Serves the archived JPEG from R2
- `GET /admin` – Admin dashboard for browsing scans and photos
- `POST /api/decode` – Raw JPEG decode endpoint (reuse of the original API)

Error responses return JSON payloads with an `error` field explaining what went wrong.
