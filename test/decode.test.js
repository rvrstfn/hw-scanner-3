import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';
import { createMemoryD1 } from './helpers/memoryD1.js';
import { createMemoryR2 } from './helpers/memoryR2.js';
import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';

function rotateJpegClockwise(buffer, angle) {
  if (angle % 360 === 0) return buffer;
  const { data, width, height } = decodeJpeg(buffer, { useTArray: true });
  const normalized = ((angle % 360) + 360) % 360;
  let outputWidth = width;
  let outputHeight = height;

  if (normalized === 90 || normalized === 270) {
    outputWidth = height;
    outputHeight = width;
  }

  const output = new Uint8Array(outputWidth * outputHeight * 4);

  const setPixel = (x, y, rgba) => {
    const index = (y * outputWidth + x) * 4;
    output[index] = rgba[0];
    output[index + 1] = rgba[1];
    output[index + 2] = rgba[2];
    output[index + 3] = rgba[3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4;
      const rgba = data.subarray(srcIndex, srcIndex + 4);

      let destX = x;
      let destY = y;

      switch (normalized) {
        case 90:
          destX = height - 1 - y;
          destY = x;
          break;
        case 180:
          destX = width - 1 - x;
          destY = height - 1 - y;
          break;
        case 270:
          destX = y;
          destY = width - 1 - x;
          break;
        default:
          break;
      }

      setPixel(destX, destY, rgba);
    }
  }

  const { data: jpegBuffer } = encodeJpeg({ data: output, width: outputWidth, height: outputHeight }, 90);
  return jpegBuffer;
}

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

  const rotatedImage = rotateJpegClockwise(Buffer.from(image), 90);
  const rotatedForm = new FormData();
  rotatedForm.append('employeeName', 'Alex Johnson');
  rotatedForm.append('employeeEmail', 'alex.johnson@example.com');
  rotatedForm.append('image', new File([rotatedImage], 'barcode-rotated.jpg', { type: 'image/jpeg' }));
  const rotatedResponse = await worker.fetch(
    new Request('http://localhost/api/scan', { method: 'POST', body: rotatedForm }),
    env,
  );
  await assert(rotatedResponse.status === 201, `Unexpected rotated /api/scan status: ${rotatedResponse.status}`);
  const rotatedPayload = await rotatedResponse.json();
  await assert(rotatedPayload.assetCode === 'E3012804 HBJ04724', 'Rotated capture code mismatch');
  await assert(rotatedPayload.imageUrl.includes('?v='), 'Rotated capture missing cache-busting parameter');
  await assert(env.ARCHIVE_BUCKET.store.size === 2, 'Second archive image was not stored');

  const listResponse = await worker.fetch(new Request('http://localhost/api/scans'), env);
  await assert(listResponse.status === 200, `Unexpected /api/scans status: ${listResponse.status}`);
  const listPayload = await listResponse.json();
  console.log('Scans list:', listPayload);
  await assert(Array.isArray(listPayload) && listPayload.length === 2, 'Expected two stored scans');
  for (const entry of listPayload) {
    await assert(entry.assetCode === 'E3012804 HBJ04724', 'List payload missing combined code');
    await assert(entry.modelCode === 'E3012804', 'List payload missing model code');
    await assert(entry.assetTag === 'HBJ04724', 'List payload missing asset tag');
    await assert(entry.employeeEmail === 'alex.johnson@example.com', 'List payload missing employee email');
    await assert(entry.imageUrl.includes('?v='), 'List payload missing cache-busting image URL');
  }
  await assert(listPayload[0].imageUrl === rotatedPayload.imageUrl, 'Newest scan missing from list');
  await assert(listPayload[1].imageUrl === scanPayload.imageUrl, 'Original scan missing from list');

  const imageResponse = await worker.fetch(new Request(rotatedPayload.imageUrl), env);
  await assert(imageResponse.status === 200, `Unexpected image status: ${imageResponse.status}`);
  const archivedBytes = await imageResponse.arrayBuffer();
  await assert(archivedBytes.byteLength > 0, 'Archived image body is empty');

  const csvResponse = await worker.fetch(new Request('http://localhost/api/scans.csv'), env);
  await assert(csvResponse.status === 200, `Unexpected CSV status: ${csvResponse.status}`);
  const csvText = await csvResponse.text();
  console.log('CSV export:\n', csvText);
  await assert(csvText.includes('Alex Johnson'), 'CSV missing employee name');
  await assert(csvText.toLowerCase().includes('alex.johnson@example.com'), 'CSV missing employee email');
  await assert(csvText.includes('/api/scans/1/image?v='), 'CSV missing first image link');
  await assert(csvText.includes('/api/scans/2/image?v='), 'CSV missing second image link');
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
