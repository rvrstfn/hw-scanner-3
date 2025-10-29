#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOcrFallback } from '../src/ocrFallback.js';

const args = process.argv.slice(2);

function printUsage() {
  console.log(`Usage: node scripts/test-ocr.mjs --file <image-path> [--content-type <mime>] [--json]

Runs the GPT fallback exactly as the Worker would, without touching the database.
OPENAI_API_KEY must be set in your environment (matching the Worker secret).
`);
}

function getArg(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  if (index === args.length - 1) {
    throw new Error(`Flag "${flag}" requires a value.`);
  }
  return args[index + 1];
}

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

let filePath = getArg('--file');
if (!filePath) {
  // Allow the file path as the first positional argument.
  filePath = args[0];
}

if (!filePath) {
  printUsage();
  console.error('Error: missing --file <path-to-image>');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), filePath);

const contentTypeOverride = getArg('--content-type');
const shouldPrintJsonOnly = args.includes('--json');
const debugMode = args.includes('--debug');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}

function inferContentType(file) {
  if (contentTypeOverride) return contentTypeOverride;
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function main() {
  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(absolutePath);
  } catch (error) {
    console.error(`Failed to read "${absolutePath}": ${error.message}`);
    process.exit(1);
  }

  const filename = path.basename(absolutePath);
  const contentType = inferContentType(absolutePath);
  const arrayBuffer = toArrayBuffer(fileBuffer);

  try {
    const result = await runOcrFallback(arrayBuffer, {
      filename,
      contentType,
      apiKey,
    });

    if (!shouldPrintJsonOnly) {
      console.log(`File: ${absolutePath}`);
      console.log(`Model code: ${result.modelCode ?? '<none>'}`);
      console.log(`Asset tag: ${result.assetTag}`);
      console.log(`Raw combined: ${result.rawCombined}`);
      console.log('');
      console.log('Structured response:');
    }

    const structuredJson = JSON.stringify(result.structured, null, 2);
    console.log(structuredJson);
  } catch (error) {
    console.error(`OCR fallback failed: ${error.message}`);
    if (error.cause && debugMode) {
      if (error.cause.status) {
        console.error(`Status: ${error.cause.status}`);
      }
      if (error.cause.headers) {
        console.error('Headers:', JSON.stringify(error.cause.headers, null, 2));
      }
      if (error.cause.json) {
        console.error('Raw JSON response:');
        console.error(JSON.stringify(error.cause.json, null, 2));
      } else if (error.cause.body) {
        console.error('Raw response body:');
        console.error(error.cause.body);
      } else {
        console.error('Cause:', error.cause);
      }
    } else if (error.cause) {
      console.error(`Cause: ${error.cause.message ?? error.cause}`);
    }
    process.exit(1);
  }
}

main();
