import { readFile } from 'node:fs/promises';
import worker from '../src/index.js';

async function run() {
  const imagePath = new URL('../barcode-QR-label.jpg', import.meta.url);
  const image = await readFile(imagePath);

  const request = new Request('http://localhost/', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
    },
    body: image,
  });

  const response = await worker.fetch(request);
  const payload = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', payload);

  if (response.status !== 200) {
    throw new Error(`Unexpected status code: ${response.status}`);
  }
  if (payload.text !== '1E3012804 HBJ04724') {
    throw new Error(`Unexpected barcode text: ${payload.text}`);
  }
  if (payload.format !== 'CODE_128') {
    throw new Error(`Unexpected barcode format: ${payload.format}`);
  }

  const getResponse = await worker.fetch(new Request('http://localhost/'));
  console.log('GET Status:', getResponse.status);
  console.log('GET Response:', await getResponse.json());

  if (getResponse.status !== 200) {
    throw new Error(`Unexpected GET status code: ${getResponse.status}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
