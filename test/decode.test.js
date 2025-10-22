import { readFile } from 'node:fs/promises';
import worker, { decodeLinearBarcode } from '../src/index.js';
import { createMemoryD1 } from './helpers/memoryD1.js';

async function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const imagePath = new URL('../barcode-QR-label.jpg', import.meta.url);
  const image = await readFile(imagePath);

  // Direct decoder smoke test
  const result = await decodeLinearBarcode(image);
  console.log('Decoded text:', result.text);
  console.log('Format:', result.format);

  await assert(result.text === '1E3012804 HBJ04724', `Unexpected barcode text: ${result.text}`);
  await assert(result.format === 'CODE_128', `Unexpected barcode format: ${result.format}`);

  // API and D1 workflow using in-memory stub
  const env = { SCANS_DB: createMemoryD1() };
  const formData = new FormData();
  formData.append('employeeName', 'Alex Johnson');
  formData.append('image', new File([image], 'barcode.jpg', { type: 'image/jpeg' }));

  const scanResponse = await worker.fetch(
    new Request('http://localhost/api/scan', { method: 'POST', body: formData }),
    env,
  );
  await assert(scanResponse.status === 201, `Unexpected /api/scan status: ${scanResponse.status}`);
  const scanPayload = await scanResponse.json();
  console.log('Scan payload:', scanPayload);
  await assert(scanPayload.assetCode === '1E3012804 HBJ04724', 'Recorded code mismatch');
  await assert(scanPayload.employeeName === 'Alex Johnson', 'Recorded name mismatch');

  const listResponse = await worker.fetch(new Request('http://localhost/api/scans'), env);
  await assert(listResponse.status === 200, `Unexpected /api/scans status: ${listResponse.status}`);
  const listPayload = await listResponse.json();
  console.log('Scans list:', listPayload);
  await assert(Array.isArray(listPayload) && listPayload.length === 1, 'Expected one stored scan');

  const csvResponse = await worker.fetch(new Request('http://localhost/api/scans.csv'), env);
  await assert(csvResponse.status === 200, `Unexpected CSV status: ${csvResponse.status}`);
  const csvText = await csvResponse.text();
  console.log('CSV export:\n', csvText);
  await assert(csvText.includes('Alex Johnson'), 'CSV missing employee name');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
