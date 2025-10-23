import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';
import { createMemoryD1 } from './helpers/memoryD1.js';
import { createMemoryR2 } from './helpers/memoryR2.js';

async function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const imagePath = new URL('./fixtures/barcode-small.jpg', import.meta.url);
  const image = await readFile(imagePath);

  const env = {
    SCANS_DB: createMemoryD1(),
    ARCHIVE_BUCKET: createMemoryR2(),
  };

  const formData = new FormData();
  formData.append('employeeName', 'Alex Johnson');
  formData.append('employeeEmail', 'alex.johnson@example.com');
  formData.append('image', new File([image], 'barcode.jpg', { type: 'image/jpeg' }));

  const scanResponse = await worker.fetch(
    new Request('http://localhost/api/scan', { method: 'POST', body: formData }),
    env,
  );
  await assert(scanResponse.status === 201, `Unexpected /api/scan status: ${scanResponse.status}`);
  const scanPayload = await scanResponse.json();
  console.log('Scan payload:', scanPayload);
  await assert(scanPayload.assetCode === 'E3012804 HBJ04724', 'Recorded code mismatch');
  await assert(scanPayload.modelCode === 'E3012804', 'Model code mismatch');
  await assert(scanPayload.assetTag === 'HBJ04724', 'Asset tag mismatch');
  await assert(scanPayload.rawCode === '1E3012804 HBJ04724', 'Raw code mismatch');
  await assert(scanPayload.employeeName === 'Alex Johnson', 'Recorded name mismatch');
  await assert(scanPayload.employeeEmail === 'alex.johnson@example.com', 'Recorded email mismatch');
  await assert(typeof scanPayload.imageKey === 'string' && scanPayload.imageKey.length > 0, 'Missing image key in response');
  await assert(
    typeof scanPayload.imageUrl === 'string' &&
      scanPayload.imageUrl.startsWith('http://localhost/api/scans/1/image?v='),
    'Missing image URL in response',
  );
  await assert(env.ARCHIVE_BUCKET.store.size === 1, 'Archive image was not stored');

  const listResponse = await worker.fetch(new Request('http://localhost/api/scans'), env);
  await assert(listResponse.status === 200, `Unexpected /api/scans status: ${listResponse.status}`);
  const listPayload = await listResponse.json();
  console.log('Scans list:', listPayload);
  await assert(Array.isArray(listPayload) && listPayload.length === 1, 'Expected one stored scan');
  await assert(listPayload[0].assetCode === 'E3012804 HBJ04724', 'List payload missing combined code');
  await assert(listPayload[0].modelCode === 'E3012804', 'List payload missing model code');
  await assert(listPayload[0].assetTag === 'HBJ04724', 'List payload missing asset tag');
  await assert(listPayload[0].employeeEmail === 'alex.johnson@example.com', 'List payload missing employee email');
  await assert(listPayload[0].imageUrl === scanPayload.imageUrl, 'List payload missing image URL');

  const imageResponse = await worker.fetch(new Request(scanPayload.imageUrl), env);
  await assert(imageResponse.status === 200, `Unexpected image status: ${imageResponse.status}`);
  const archivedBytes = await imageResponse.arrayBuffer();
  await assert(archivedBytes.byteLength > 0, 'Archived image body is empty');

  const csvResponse = await worker.fetch(new Request('http://localhost/api/scans.csv'), env);
  await assert(csvResponse.status === 200, `Unexpected CSV status: ${csvResponse.status}`);
  const csvText = await csvResponse.text();
  console.log('CSV export:\n', csvText);
  await assert(csvText.includes('Alex Johnson'), 'CSV missing employee name');
  await assert(csvText.toLowerCase().includes('alex.johnson@example.com'), 'CSV missing employee email');
  await assert(csvText.includes('/api/scans/1/image?v='), 'CSV missing image link');
  await assert(csvText.includes('E3012804'), 'CSV missing model code');
  await assert(csvText.includes('HBJ04724'), 'CSV missing asset tag');
}

run()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
