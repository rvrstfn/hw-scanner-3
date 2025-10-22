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

const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
};

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

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: DEFAULT_HEADERS });
    }

    if (request.method === 'GET') {
      return jsonResponse({
        message: 'POST an image/jpeg payload to this endpoint to decode the linear barcode.',
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Only POST requests are supported' }, { status: 405 });
    }

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
  },
};

export { decodeLinearBarcode };
