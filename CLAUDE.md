# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a Cloudflare Worker-based barcode scanning system for hardware checkout management. The entire application logic is contained in `src/index.js` (1,321 lines) and follows a serverless monolith pattern. It provides a mobile-first web interface for employees to scan hardware asset barcodes and an admin dashboard for reviewing scans.

## Development Commands

```bash
# Local development (uses remote D1/R2 for full functionality)
npm run dev -- --remote

# Deploy to Cloudflare
npm run deploy

# Run integration tests
npm run test
```

## Architecture & Key Components

### Single-File Structure
- **`src/index.js`**: Contains all application logic - API routes, HTML generation, and request handling
- **`db/schema.sql`**: Database schema for the D1 SQLite database
- **`test/`**: Integration tests with in-memory D1/R2 mocks

### Technology Stack
- **Runtime**: Cloudflare Workers (serverless JavaScript)
- **Database**: Cloudflare D1 (SQLite-based)
- **Storage**: Cloudflare R2 (for image archiving)
- **Barcode Library**: @zxing/library (supports linear formats: CODE_128, CODE_39, EAN_13, UPC_A)
- **Image Processing**: jpeg-js for server-side JPEG manipulation

### Data Flow Architecture
1. **Employee Selection**: User selects from hardcoded employee list (no authentication)
2. **Image Capture**: Client-side camera/gallery with automatic compression (max 1600px, ~70% JPEG)
3. **Barcode Processing**: Server decodes using ZXing → stores in D1 → archives JPEG in R2
4. **Admin Review**: Dashboard with scan history and photo previews

### API Endpoints
- `GET /` - Mobile scanning interface (inline HTML/CSS/JS)
- `GET /admin` - Admin dashboard
- `POST /api/scan` - Main scanning endpoint (multipart: employeeName + image)
- `GET /api/employees` - Employee roster
- `GET /api/scans` - JSON export of all scans
- `GET /api/scans.csv` - CSV export for Excel
- `GET /api/scans/:id/image` - Serve archived images from R2

### Required Cloudflare Resources
- **D1 Database**: `hw_scanner_3` (configured in wrangler.toml)
- **R2 Bucket**: `hw-scanner-archive` (configured in wrangler.toml)

### Testing Infrastructure
- Integration tests use in-memory mocks (`test/helpers/memoryD1.js`, `test/helpers/memoryR2.js`)
- Fixture-based testing with sample barcode images
- Tests cover full scan → storage → retrieval workflow

## Development Notes

### Image Processing Pipeline
- Client automatically compresses images before upload
- Server converts JPEG → grayscale → barcode extraction
- Only linear barcodes supported (no QR codes)

### Database Schema
- `scans`: `employee_name`, `employee_email`, `model_code`, `asset_tag`, `raw_code`, `image_key`, `created_at`
- `employees`: HR roster ingested via `scripts/sync-employees.mjs` (unique `email`, soft delete through `active`/`deleted_at`)
- All successful scans archived with audit trail

### HR Roster Sync
- Run `npm run sync:employees -- --file "<absolute path to HR XLSX>" --remote` to push updates into D1
- Uses the first sheet in the workbook, expects an `E-mail` column (local-part allowed; defaults domain to `@intercos.com`)
- Worker endpoints now source `/api/employees` and runtime validation from the `employees` table (falls back to static list if empty)

### Mobile-First Design
- Responsive UI optimized for phone cameras
- Progressive enhancement with camera/gallery fallbacks
- No external authentication or user management
