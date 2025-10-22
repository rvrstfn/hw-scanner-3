# Cloudflare Barcode Decoder

This Worker exposes a simple HTTP API that extracts the **linear** (e.g. Code 128, UPC, EAN) barcode contained in a JPEG image. QR codes or other 2D symbologies in the same frame are ignored.

## Local development

1. Install dependencies once: `npm install`
2. Start the Worker locally: `npm run dev -- --local`
3. Send requests to `http://127.0.0.1:8787`

## Try it with the bundled sample

With the dev server running, decode the barcode provided in `barcode-QR-label.jpg`:

```bash
curl -s \
  -H "Content-Type: image/jpeg" \
  --data-binary @barcode-QR-label.jpg \
  http://127.0.0.1:8787
```

Expected response:

```json
{"text":"1E3012804 HBJ04724","format":"CODE_128"}
```

## Endpoint behavior

- `GET /` – returns a short usage message.
- `POST /` – accepts a JPEG image (`image/jpeg` or `application/octet-stream` body) and responds with the decoded linear barcode text and format.
- `OPTIONS /` – CORS preflight support. CORS headers allow browser-based calls from any origin.

## Automated test

Run `npm test` to execute a local smoke test that imports the Worker directly and verifies the response for `barcode-QR-label.jpg`.

### Error cases

The API returns a 4xx response with a JSON payload describing the failure when:

- The image cannot be parsed as JPEG.
- No supported linear barcode is detected.
- The request method or content type is not supported.
