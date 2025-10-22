import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from '@zxing/library';
import { decode as decodeJpeg } from 'jpeg-js';

const LINEAR_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.ITF,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

const EMPLOYEES = [
  'Alex Johnson',
  'Brianna Patel',
  'Carlos Mendes',
  'Daria Schneider',
  'Elliot Wong',
  'Fatima Noor',
  'Grace Liu',
  'Hugo Ramirez',
  'Isabella Rossi',
  'Jonah Smith',
];

const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
};

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hardware Scanner</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f5;
        color: #111;
      }
      body {
        margin: 0;
        display: flex;
        justify-content: center;
        padding: 1.5rem;
      }
      .card {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        padding: 2rem 1.75rem;
        width: min(460px, 100%);
      }
      h1 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        font-size: 1.6rem;
      }
      p.lead {
        margin-top: 0;
        color: #444;
        font-size: 0.95rem;
      }
      label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      input[type="text"] {
        width: 100%;
        padding: 0.65rem;
        border-radius: 8px;
        border: 1px solid #ccc;
        margin-bottom: 1rem;
      }
      input[type="file"] {
        width: 100%;
        margin-bottom: 1.2rem;
      }
      button {
        width: 100%;
        padding: 0.75rem;
        border: none;
        border-radius: 8px;
        background: #2563eb;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .status {
        margin-top: 1rem;
        padding: 0.75rem;
        border-radius: 8px;
        font-size: 0.95rem;
        display: none;
      }
      .status.show {
        display: block;
      }
      .status.success {
        background: #ecfdf3;
        color: #06603b;
        border: 1px solid #bbf7d0;
      }
      .status.error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
      }
      .actions a {
        flex: 1;
        text-align: center;
        text-decoration: none;
        padding: 0.6rem;
        border-radius: 8px;
        border: 1px solid #2563eb;
        color: #2563eb;
        font-weight: 600;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          background: #111;
          color: #f7fafc;
        }
        .card {
          background: #1f2937;
          color: inherit;
        }
        input[type="text"],
        input[type="file"] {
          background: #111827;
          color: inherit;
          border-color: #374151;
        }
        .status.success {
          background: rgba(22, 163, 74, 0.15);
          border-color: rgba(22, 163, 74, 0.4);
          color: #34d399;
        }
        .status.error {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }
        .actions a {
          border-color: #60a5fa;
          color: #bfdbfe;
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Log Hardware Checkout</h1>
      <p class="lead">Select your name, snap a clear photo of the barcode, and upload it for tracking.</p>
      <form id="scan-form">
        <label for="employee">Employee</label>
        <input
          id="employee"
          name="employee"
          type="text"
          list="employee-list"
          placeholder="Start typing your name"
          autocomplete="off"
          required
        />
        <datalist id="employee-list"></datalist>

        <label for="image">Barcode photo</label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          capture="environment"
          required
        />

        <button id="submit-btn" type="submit">Upload and Register</button>
      </form>
      <div id="status" class="status" role="status"></div>
      <div class="actions">
        <a href="/api/scans.csv" download>Download CSV</a>
        <a href="/api/scans" target="_blank" rel="noopener">View JSON</a>
      </div>
    </main>

    <script type="module">
      const employeeInput = document.getElementById('employee');
      const employeeList = document.getElementById('employee-list');
      const form = document.getElementById('scan-form');
      const statusBox = document.getElementById('status');
      const submitBtn = document.getElementById('submit-btn');
      const imageInput = document.getElementById('image');

      async function loadEmployees() {
        try {
          const res = await fetch('/api/employees');
          if (!res.ok) throw new Error('Failed to load employees');
          const employees = await res.json();
          employeeList.innerHTML = '';
          employees.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            employeeList.appendChild(option);
          });
        } catch (err) {
          showStatus(err.message, 'error');
        }
      }

      function showStatus(message, variant) {
        statusBox.textContent = message;
        statusBox.className = 'status show ' + variant;
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const employeeName = employeeInput.value.trim();
        const file = imageInput.files?.[0];

        if (!employeeName) {
          showStatus('Please select your name before uploading.', 'error');
          return;
        }
        if (!file) {
          showStatus('Please take a photo of the barcode.', 'error');
          return;
        }

        submitBtn.disabled = true;
        showStatus('Uploading and decoding barcode…', 'success');

        try {
          const formData = new FormData();
          formData.append('employeeName', employeeName);
          formData.append('image', file, file.name || 'barcode.jpg');

          const response = await fetch('/api/scan', {
            method: 'POST',
            body: formData,
          });

          const payload = await response.json();
          if (!response.ok) {
            showStatus(payload.error || 'Unable to register this scan, please try again.', 'error');
            submitBtn.disabled = false;
            return;
          }

          showStatus(
            \`Registered \${payload.assetCode} for \${payload.employeeName} at \${new Date(
              payload.createdAt,
            ).toLocaleString()}\`,
            'success',
          );
          imageInput.value = '';
        } catch (error) {
          showStatus(error.message || 'Unexpected error, please retry.', 'error');
        } finally {
          submitBtn.disabled = false;
        }
      });

      loadEmployees();
    </script>
  </body>
</html>`;

function jsonResponse(body, init) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      ...DEFAULT_HEADERS,
      ...(init?.headers ?? {}),
    },
    status: init?.status ?? 200,
  });
}

async function decodeLinearBarcode(imageBuffer) {
  const decoded = decodeJpeg(new Uint8Array(imageBuffer), { useTArray: true });
  if (!decoded || !decoded.data) {
    throw new Error('Unable to decode JPEG data');
  }

  const { data, width, height } = decoded;
  const grayscale = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Weighted average biased towards green for better luminance approximation
      grayscale[y * width + x] = (r + g * 2 + b) >> 2;
    }
  }

  const luminanceSource = new RGBLuminanceSource(grayscale, width, height);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, LINEAR_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const result = reader.decode(binaryBitmap);
    if (!LINEAR_FORMATS.includes(result.getBarcodeFormat())) {
      throw new NotFoundException();
    }
    return {
      text: result.getText(),
      format: BarcodeFormat[result.getBarcodeFormat()],
    };
  } catch (err) {
    if (err instanceof NotFoundException) {
      throw new Error('No supported linear barcode found in the supplied image');
    }
    throw err;
  }
}

function handleOptions(request) {
  const headers = {
    ...DEFAULT_HEADERS,
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? 'Content-Type',
  };
  return new Response(null, { status: 204, headers });
}

async function handleScan(request, env) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return jsonResponse(
      { error: 'Submit the request as multipart/form-data with fields "employeeName" and "image".' },
      { status: 415 },
    );
  }

  const formData = await request.formData();
  const employeeName = String(formData.get('employeeName') ?? '').trim();
  const image = formData.get('image');

  if (!employeeName) {
    return jsonResponse({ error: 'Employee name is required.' }, { status: 400 });
  }

  if (!EMPLOYEES.includes(employeeName)) {
    return jsonResponse({ error: 'Employee not found in roster. Check spelling or update the roster.' }, { status: 404 });
  }

  if (!(image instanceof File)) {
    return jsonResponse({ error: 'Image file was not included in the upload.' }, { status: 400 });
  }

  try {
    const buffer = await image.arrayBuffer();
    const result = await decodeLinearBarcode(buffer);

    const inserted = await env.SCANS_DB.prepare(
      'INSERT INTO scans (employee_name, asset_code) VALUES (?1, ?2) RETURNING id, created_at',
    )
      .bind(employeeName, result.text)
      .first();

    return jsonResponse(
      {
        employeeName,
        assetCode: result.text,
        barcodeFormat: result.format,
        createdAt: inserted?.created_at ?? new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, { status: 422 });
  }
}

async function handleScans(env) {
  const { results } = await env.SCANS_DB.prepare(
    'SELECT id, employee_name AS employeeName, asset_code AS assetCode, created_at AS createdAt FROM scans ORDER BY created_at DESC',
  ).all();
  return jsonResponse(results ?? []);
}

async function handleCsv(env) {
  const { results } = await env.SCANS_DB.prepare(
    'SELECT employee_name AS employeeName, asset_code AS assetCode, created_at AS createdAt FROM scans ORDER BY created_at DESC',
  ).all();
  const headers = ['Employee Name', 'Asset Code', 'Created At'];
  const rows = (results ?? []).map((row) =>
    [row.employeeName, row.assetCode, row.createdAt].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="scans.csv"',
      ...DEFAULT_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(HTML_PAGE, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    if (url.pathname === '/api/employees' && request.method === 'GET') {
      return jsonResponse(EMPLOYEES);
    }

    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return handleScan(request, env);
    }

    if (url.pathname === '/api/scans' && request.method === 'GET') {
      return handleScans(env);
    }

    if (url.pathname === '/api/scans.csv' && request.method === 'GET') {
      return handleCsv(env);
    }

    if (url.pathname === '/api/decode' && request.method === 'POST') {
      const contentType = request.headers.get('content-type') ?? '';
      if (!contentType.includes('image/jpeg') && !contentType.includes('application/octet-stream')) {
        return jsonResponse(
          { error: 'Unsupported content type. Please POST a JPEG image as the request body.' },
          { status: 415 },
        );
      }

      try {
        const body = await request.arrayBuffer();
        const result = await decodeLinearBarcode(body);
        return jsonResponse(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return jsonResponse({ error: message }, { status: 422 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

export { decodeLinearBarcode };
