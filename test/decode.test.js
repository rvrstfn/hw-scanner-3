import { readFile } from 'node:fs/promises';
import { decodeLinearBarcode } from '../src/index.js';

async function run() {
  const imagePath = new URL('../barcode-QR-label.jpg', import.meta.url);
  const image = await readFile(imagePath);
  const result = await decodeLinearBarcode(image);

  console.log('Decoded text:', result.text);
  console.log('Format:', result.format);

  if (result.text !== '1E3012804 HBJ04724') {
    throw new Error(`Unexpected barcode text: ${result.text}`);
  }
  if (result.format !== 'CODE_128') {
    throw new Error(`Unexpected barcode format: ${result.format}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
