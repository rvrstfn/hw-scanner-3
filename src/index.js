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
import { hasOcrSupport, runOcrFallback } from './ocrFallback.js';

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

const ARCHIVE_CONTENT_TYPE = 'image/jpeg';

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
        --keyboard-offset: 0px;
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
        position: relative;
        overflow: visible;
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
      button.secondary {
        background: #1f2937;
        color: #f9fafb;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .form-step {
        margin-bottom: 1.75rem;
      }
      .form-step:last-of-type {
        margin-bottom: 0;
      }
      .step-heading {
        margin: 0 0 0.75rem;
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        font-weight: 600;
        color: #1f2937;
        font-size: 1rem;
      }
      .step-number {
        color: #2563eb;
        font-weight: 700;
      }
      .file-input {
        display: none;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .upload-buttons {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      /* Modern Employee Selector Button */
      .employee-selector {
        width: 100%;
        background: #fff;
        border: 2px solid #e5e7eb;
        border-radius: 16px;
        padding: 0;
        margin-bottom: 0;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .employee-selector:hover {
        border-color: #3b82f6;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        transform: translateY(-1px);
      }
      .employee-selector:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
      }
      .employee-selector-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
      }
      .selected-employee {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
      }
      .employee-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 16px;
      }
      .selected-employee span {
        font-size: 16px;
        color: #374151;
        font-weight: 500;
      }
      .selector-arrow {
        color: #9ca3af;
        transition: transform 0.2s;
      }
      .employee-selector:hover .selector-arrow {
        color: #3b82f6;
        transform: translateY(1px);
      }
      .employee-input {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .employee-input input {
        flex: 1;
      }
      .picker-button {
        padding: 0.6rem 0.9rem;
        border-radius: 8px;
        border: 1px solid #2563eb;
        background: rgba(37, 99, 235, 0.1);
        color: #1d4ed8;
        font-weight: 600;
        cursor: pointer;
      }
      .picker-button:hover {
        background: rgba(37, 99, 235, 0.15);
      }
      .modal {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 50;
      }
      .modal-panel {
        width: min(500px, 100%);
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
        display: flex;
        flex-direction: column;
        max-height: 80vh;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #e2e8f0;
      }
      .modal-body {
        padding: 1rem 1.25rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .modal-body input[type="search"] {
        padding: 0.65rem;
        border-radius: 8px;
        border: 1px solid #cbd5f5;
      }
      .modal-list {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow-y: auto;
        max-height: 45vh;
      }
      .modal-list button {
        width: 100%;
        text-align: left;
        padding: 0.6rem 0.75rem;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.95rem;
      }
      .modal-list button:hover,
      .modal-list button:focus {
        background: rgba(37, 99, 235, 0.12);
        outline: none;
      }
      .modal-close {
        border: none;
        background: transparent;
        font-size: 1.5rem;
        cursor: pointer;
        line-height: 1;
      }
      /* Employee Modal */
      .employee-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        padding: calc(env(safe-area-inset-top) + 0.75rem) 0 calc(env(safe-area-inset-bottom) + var(--keyboard-offset, 0px)) 0;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.25s ease;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      .employee-modal:not(.hidden) {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }
      .modal-container {
        position: relative;
        width: min(520px, 100%);
        max-height: none;
        height: calc(100% - env(safe-area-inset-top));
        background: #fff;
        border-radius: 24px 24px 0 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
        overscroll-behavior: contain;
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #f3f4f6;
      }
      .modal-header h2 {
        margin: 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: #111827;
      }
      .close-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: #f3f4f6;
        color: #6b7280;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .close-button:hover {
        background: #e5e7eb;
        color: #374151;
        transform: scale(1.05);
      }

      /* Search Section */
      .search-section {
        padding: 0 1.5rem 1rem;
      }
      .search-bar {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-icon {
        position: absolute;
        left: 1rem;
        color: #9ca3af;
        z-index: 1;
      }
      .search-bar input {
        width: 100%;
        padding: 0.875rem 1rem 0.875rem 3rem;
        border: 2px solid #f3f4f6;
        border-radius: 16px;
        font-size: 16px;
        background: #f9fafb;
        color: #111827;
        transition: all 0.2s;
      }
      .search-bar input:focus {
        outline: none;
        border-color: #3b82f6;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .clear-search {
        position: absolute;
        right: 0.75rem;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: #e5e7eb;
        color: #6b7280;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .clear-search:hover {
        background: #d1d5db;
        transform: scale(1.1);
      }

      /* Employee Cards Grid */
      .employees-grid {
        flex: 1;
        overflow-y: auto;
        padding: 0 1.5rem 1.5rem;
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        min-height: 200px;
        align-content: flex-start;
        overscroll-behavior: contain;
      }
      .employee-card {
        background: #fff;
        border: 2px solid #f3f4f6;
        border-radius: 16px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .employee-card:hover {
        border-color: #3b82f6;
        box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
        transform: translateY(-2px);
      }
      .employee-card:active {
        transform: translateY(0);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
      }
      .employee-card .employee-avatar {
        width: 48px;
        height: 48px;
        font-size: 18px;
      }
      .employee-card .employee-name {
        font-size: 1.125rem;
        font-weight: 600;
        color: #111827;
      }
      .employee-line {
        display: block;
        line-height: 1.2;
      }
      .employee-primary {
        font-size: 1.05rem;
      }
      .employee-secondary {
        margin-top: 0.15rem;
        font-size: 0.95rem;
        color: #374151;
      }
      .employee-email {
        margin-top: 0.4rem;
        font-size: 0.85rem;
        color: #6b7280;
        word-break: break-word;
      }
      .employee-card .employee-name mark {
        background: rgba(59, 130, 246, 0.2);
        color: #1d4ed8;
        border-radius: 4px;
        padding: 0 0.25rem;
      }

      /* Loading & Empty States */
      .loading-state {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }
      .skeleton-card {
        background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 16px;
        height: 80px;
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #6b7280;
      }
      .empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      .empty-state h3 {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
        color: #374151;
      }
      .empty-state p {
        margin: 0;
        font-size: 1rem;
      }
      .upload-buttons button {
        width: 100%;
        padding: 0.85rem;
        border-radius: 10px;
        border: 1px dashed #2563eb;
        background: rgba(37, 99, 235, 0.08);
        color: #1d4ed8;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .upload-buttons button:hover {
        background: rgba(37, 99, 235, 0.12);
        color: #1e40af;
      }
      .preview {
        margin-top: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 10px;
        background: rgba(37, 99, 235, 0.08);
      }
      .preview img {
        width: 96px;
        height: 96px;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid rgba(37, 99, 235, 0.3);
      }
      .hidden {
        display: none !important;
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
        .employee-input input {
          background: #111827;
          color: inherit;
        }
        .picker-button {
          border-color: rgba(96, 165, 250, 0.6);
          background: rgba(96, 165, 250, 0.12);
          color: #bfdbfe;
        }
        .picker-button:hover {
          background: rgba(96, 165, 250, 0.18);
        }
        .modal-panel {
          background: #1e293b;
          color: inherit;
        }
        .modal-header {
          border-color: rgba(148, 163, 184, 0.3);
        }
        .modal-body input[type="search"] {
          background: #0f172a;
          border-color: rgba(148, 163, 184, 0.3);
          color: inherit;
        }
        .modal-list button:hover,
        .modal-list button:focus {
          background: rgba(96, 165, 250, 0.18);
        }
        /* Dark Mode for New Modal Interface */
        .employee-selector {
          background: #1f2937;
          border-color: rgba(75, 85, 99, 0.4);
        }
        .employee-selector:hover {
          border-color: #60a5fa;
          box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);
        }
        .selected-employee span {
          color: #f9fafb;
        }
        .modal-container {
          background: #1f2937;
        }
        .modal-header {
          border-bottom-color: rgba(75, 85, 99, 0.3);
        }
        .modal-header h2 {
          color: #f9fafb;
        }
        .close-button {
          background: rgba(75, 85, 99, 0.4);
          color: #d1d5db;
        }
        .close-button:hover {
          background: rgba(75, 85, 99, 0.6);
          color: #f9fafb;
        }
        .search-bar input {
          background: #374151;
          border-color: rgba(75, 85, 99, 0.4);
          color: #f9fafb;
        }
        .search-bar input:focus {
          background: #4b5563;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        }
        .search-bar input::placeholder {
          color: #9ca3af;
        }
        .clear-search {
          background: rgba(75, 85, 99, 0.5);
          color: #d1d5db;
        }
        .clear-search:hover {
          background: rgba(75, 85, 99, 0.7);
        }
        .employee-card {
          background: #374151;
          border-color: rgba(75, 85, 99, 0.4);
        }
        .employee-card:hover {
          border-color: #60a5fa;
          box-shadow: 0 8px 25px rgba(96, 165, 250, 0.2);
        }
        .employee-card .employee-name {
          color: #f9fafb;
        }
        .employee-card .employee-name mark {
          background: rgba(96, 165, 250, 0.25);
          color: #bfdbfe;
        }
        .employee-secondary {
          color: #e2e8f0;
        }
        .employee-email {
          color: #cbd5f5;
        }
        .step-heading {
          color: #e5e7eb;
        }
        .step-number {
          color: #60a5fa;
        }
        .skeleton-card {
          background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
        }
        .empty-state {
          color: #9ca3af;
        }
        .empty-state h3 {
          color: #d1d5db;
        }
        .upload-buttons button {
          border-color: rgba(96, 165, 250, 0.6);
          background: rgba(37, 99, 235, 0.15);
          color: #bfdbfe;
        }
        .upload-buttons button:hover {
          background: rgba(37, 99, 235, 0.22);
          color: #e0f2fe;
        }
        .preview {
          background: rgba(96, 165, 250, 0.12);
        }
        .preview img {
          border-color: rgba(96, 165, 250, 0.4);
        }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Hardware inventory</h1>
      <form id="scan-form">
        <section class="form-step">
          <p class="step-heading"><span class="step-number">1.</span> Select your name</p>
          <button type="button" id="employee-selector" class="employee-selector">
            <div class="employee-selector-content">
              <div class="selected-employee" id="selected-employee">
                <div class="employee-avatar">?</div>
                <span>Select</span>
              </div>
              <svg class="selector-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </button>
          <input type="hidden" id="employee" name="employee" required />
          <input type="hidden" id="employee-email" name="employeeEmail" />
        </section>

        <!-- Employee Selection Modal -->
        <div id="employee-modal" class="employee-modal hidden">
          <div class="modal-backdrop"></div>
          <div class="modal-container">
            <div class="modal-header">
              <h2>Select Employee</h2>
              <button type="button" id="close-modal" class="close-button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <div class="search-section">
              <div class="search-bar">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                  <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                </svg>
                <input type="search" id="employee-search" placeholder="Search employees..." autocomplete="off">
                <button type="button" id="clear-search" class="clear-search hidden">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="employees-grid" id="employees-grid">
              <div class="loading-state">
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
              </div>
            </div>
            <div class="empty-state hidden" id="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No employees found</h3>
              <p>Try adjusting your search terms</p>
            </div>
          </div>
        </div>
        <section class="form-step">
          <p class="step-heading"><span class="step-number">2.</span> Take a photo of the label</p>
          <label class="visually-hidden" for="image">Upload barcode photo</label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            capture="environment"
            class="file-input"
            required
          />
          <div class="upload-buttons">
            <button id="upload-trigger" type="button" class="upload-trigger">Capture with camera</button>
            <button id="gallery-trigger" type="button" class="upload-trigger secondary">Choose from gallery</button>
          </div>
          <div id="preview" class="preview hidden">
            <img id="preview-image" alt="Selected barcode preview" />
            <div>
              <strong>Preview</strong>
              <p id="preview-meta"></p>
            </div>
          </div>
        </section>

        <section class="form-step">
          <p class="step-heading"><span class="step-number">3.</span> Upload</p>
          <button id="submit-btn" type="submit">Upload label</button>
        </section>
      </form>
      <div id="status" class="status" role="status"></div>
    </main>

    <script type="module">
      const MAX_UPLOAD_DIMENSION = 1600;
      const JPEG_QUALITY = 0.7;

      // Modern Modal Employee Selector
      const employeeInput = document.getElementById('employee');
      const employeeEmailInput = document.getElementById('employee-email');
      const employeeSelector = document.getElementById('employee-selector');
      const selectedEmployeeDisplay = document.getElementById('selected-employee');
      const employeeModal = document.getElementById('employee-modal');
      const closeModalBtn = document.getElementById('close-modal');
      const employeeSearch = document.getElementById('employee-search');
      const clearSearchBtn = document.getElementById('clear-search');
      const employeesGrid = document.getElementById('employees-grid');
      const emptyState = document.getElementById('empty-state');
      const form = document.getElementById('scan-form');
      const statusBox = document.getElementById('status');
      const submitBtn = document.getElementById('submit-btn');
      const imageInput = document.getElementById('image');
      const rootElement = document.documentElement;

      let employees = [];
      let filteredEmployees = [];
      let selectedEmployee = null;
      let searchTimeout;
      let viewportHandler;
      let rosterRequiresEmail = false;

      async function parseJsonResponse(response, contextMessage) {
        try {
          return await response.clone().json();
        } catch (error) {
          const rawBody = await response.text();
          const trimmed = rawBody.trim();
          console.warn('Non-JSON response received', { contextMessage, trimmed });
          if (trimmed.startsWith('<!DOCTYPE')) {
            throw new Error(contextMessage || 'Server sent an unexpected HTML response. Please retry.');
          }
          if (trimmed) {
            throw new Error(contextMessage || 'Server sent an unexpected response: ' + trimmed.slice(0, 120));
          }
          throw new Error(contextMessage || 'Server sent an empty response. Please try again.');
        }
      }

      function updateKeyboardOffset() {
        if (!window.visualViewport) return;
        const viewport = window.visualViewport;
        const offset = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop
        );
        rootElement.style.setProperty('--keyboard-offset', offset + 'px');
      }

      function enableKeyboardTracking() {
        if (!window.visualViewport || viewportHandler) return;
        viewportHandler = updateKeyboardOffset;
        window.visualViewport.addEventListener('resize', viewportHandler);
        window.visualViewport.addEventListener('scroll', viewportHandler);
        updateKeyboardOffset();
      }

      function disableKeyboardTracking() {
        if (!window.visualViewport || !viewportHandler) return;
        window.visualViewport.removeEventListener('resize', viewportHandler);
        window.visualViewport.removeEventListener('scroll', viewportHandler);
        viewportHandler = null;
        rootElement.style.setProperty('--keyboard-offset', '0px');
      }

      // Generate avatar initials and colors
      function getEmployeeAvatar(employee) {
        const source =
          (employee && employee.englishFullName) ||
          (employee && employee.displayName) ||
          (employee && employee.koreanName) ||
          (employee && employee.name) ||
          (employee && employee.email) ||
          '';
        const initials = source
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase())
          .join('')
          .substring(0, 2) || '?';

        // Generate consistent color based on name
        const colors = [
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
          'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        ];
        const colorIndex = source.length % colors.length;
        return { initials, background: colors[colorIndex] };
      }

      // Highlight search matches
      function highlightText(text, query) {
        if (!query) return text;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        if (index === -1) return text;

        return text.substring(0, index) +
               '<mark>' + text.substring(index, index + query.length) + '</mark>' +
               highlightText(text.substring(index + query.length), query);
      }

      // Update selected employee display
      function updateSelectedEmployee(employee) {
        selectedEmployee = employee;

        const displayName = employee?.displayName ?? '';
        employeeInput.value = displayName;
        employeeEmailInput.value = employee?.email ?? '';
        if (rosterRequiresEmail) {
          employeeEmailInput.setAttribute('required', 'required');
        } else {
          employeeEmailInput.removeAttribute('required');
        }

        const avatar = getEmployeeAvatar(employee);
        const avatarElement = selectedEmployeeDisplay.querySelector('.employee-avatar');
        const nameElement = selectedEmployeeDisplay.querySelector('span');

        avatarElement.textContent = avatar.initials;
        avatarElement.style.background = avatar.background;
        nameElement.textContent = displayName || 'Select';
      }

      // Render employee cards
      function renderEmployees(searchTerm = '') {
        const query = searchTerm.toLowerCase();
        filteredEmployees = employees.filter((employee) => {
          const haystacks = [
            employee.englishName ?? '',
            employee.name ?? '',
            employee.email ?? '',
            employee.displayName ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return haystacks.includes(query);
        });

        if (filteredEmployees.length === 0) {
          employeesGrid.innerHTML = '';
          emptyState.classList.remove('hidden');
          return;
        }

        emptyState.classList.add('hidden');

        employeesGrid.innerHTML = filteredEmployees
          .map((employee, index) => {
            const avatar = getEmployeeAvatar(employee);
            const primaryName = employee.englishName || employee.name || employee.displayName || '';
            const secondaryName = employee.englishName && employee.name && employee.englishName !== employee.name
              ? employee.name
              : '';
            const highlightedPrimary = highlightText(primaryName, searchTerm);
            const highlightedSecondary = secondaryName ? highlightText(secondaryName, searchTerm) : '';
            const emailLine = employee.email
              ? '<span class="employee-line employee-email">' + highlightText(employee.email, searchTerm) + '</span>'
              : '';
            const secondaryLine = highlightedSecondary
              ? '<span class="employee-line employee-secondary">' + highlightedSecondary + '</span>'
              : '';

            return (
              '<div class="employee-card" data-index="' +
              index +
              '">' +
              '<div class="employee-avatar" style="background: ' +
              avatar.background +
              '">' +
              avatar.initials +
              '</div>' +
              '<div class="employee-name">' +
              '<span class="employee-line employee-primary">' +
              highlightedPrimary +
              '</span>' +
              secondaryLine +
              emailLine +
              '</div>' +
              '</div>'
            );
          })
          .join('');
      }

      // Open modal
      function openModal() {
        employeeModal.classList.remove('hidden');
        employeeSearch.value = '';
        enableKeyboardTracking();
        employeeSearch.focus();
        renderEmployees();
        document.body.style.overflow = 'hidden';
      }

      // Close modal
      function closeModal() {
        employeeModal.classList.add('hidden');
        document.body.style.overflow = '';
        employeeSearch.value = '';
        clearSearchBtn.classList.add('hidden');
        disableKeyboardTracking();
      }

      // Select employee
      function selectEmployee(employee) {
        updateSelectedEmployee(employee);
        closeModal();

        // Add subtle success feedback
        employeeSelector.style.transform = 'scale(0.98)';
        setTimeout(() => {
          employeeSelector.style.transform = '';
        }, 150);
      }

      // Event Listeners
      employeeSelector.addEventListener('click', openModal);
      closeModalBtn.addEventListener('click', closeModal);

      // Close modal when clicking backdrop
      employeeModal.addEventListener('click', (event) => {
        if (event.target === employeeModal || event.target.classList.contains('modal-backdrop')) {
          closeModal();
        }
      });

      // Employee card selection
      employeesGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.employee-card');
        if (card) {
          const index = Number(card.dataset.index);
          if (!Number.isNaN(index) && filteredEmployees[index]) {
            selectEmployee(filteredEmployees[index]);
          }
        }
      });

      // Search functionality with debounce
      employeeSearch.addEventListener('input', (event) => {
        const searchTerm = event.target.value;

        // Show/hide clear button
        if (searchTerm) {
          clearSearchBtn.classList.remove('hidden');
        } else {
          clearSearchBtn.classList.add('hidden');
        }

        // Debounced search
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          renderEmployees(searchTerm);
        }, 150);
      });

      // Clear search
      clearSearchBtn.addEventListener('click', () => {
        employeeSearch.value = '';
        clearSearchBtn.classList.add('hidden');
        renderEmployees();
        employeeSearch.focus();
      });

      // Keyboard shortcuts
      employeeSearch.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          if (employeeSearch.value) {
            employeeSearch.value = '';
            clearSearchBtn.classList.add('hidden');
            renderEmployees();
          } else {
            closeModal();
          }
        }
      });

      // Global keyboard shortcut
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !employeeModal.classList.contains('hidden')) {
          closeModal();
        }
      });

      const uploadTrigger = document.getElementById('upload-trigger');
      const galleryTrigger = document.getElementById('gallery-trigger');
      const previewBox = document.getElementById('preview');
      const previewImage = document.getElementById('preview-image');
      const previewMeta = document.getElementById('preview-meta');
      let currentPreviewUrl = null;

      async function loadEmployees() {
        try {
          const res = await fetch('/api/employees');
          if (!res.ok) throw new Error('Failed to load employees');
          const employeesData = await parseJsonResponse(
            res,
            'Failed to parse employee directory response. Please refresh.',
          );
          employees = (Array.isArray(employeesData) ? employeesData : [])
            .map((entry) => {
              if (entry && typeof entry === 'object') {
                const englishFullName = (entry.englishFullName || entry.englishName || '').trim();
                const koreanName = (entry.koreanName || entry.name || '').trim();
                const displayName = (entry.displayName || englishFullName || koreanName || entry.email || '').trim();
                if (!displayName) return null;
                return {
                  displayName,
                  email: entry.email ? String(entry.email).toLowerCase() : null,
                  location: entry.location ?? null,
                  department: entry.department ?? null,
                  employeeId: entry.employeeId ?? null,
                  name: koreanName || null,
                  koreanName: koreanName || null,
                  englishName: englishFullName || null,
                  englishFullName: englishFullName || null,
                  surname: entry.surname ?? null,
                };
              }
              const displayName = String(entry ?? '').trim();
              if (!displayName) return null;
              return {
                displayName,
                email: null,
                location: null,
                department: null,
                employeeId: null,
                name: displayName,
                koreanName: displayName,
                englishName: displayName,
                englishFullName: displayName,
              };
            })
            .filter(Boolean);

          rosterRequiresEmail = employees.length > 0 && employees.every((entry) => Boolean(entry.email));
          if (rosterRequiresEmail) {
            employeeEmailInput.setAttribute('required', 'required');
          } else {
            employeeEmailInput.removeAttribute('required');
          }
          if (!employees.length) {
            showStatus('No employees found in the roster.', 'error');
          } else {
            showStatus('Ready to scan!', 'success');
            setTimeout(() => statusBox.classList.remove('show'), 2000);
          }

          // Hide loading skeleton
          const loadingState = document.querySelector('.loading-state');
          if (loadingState) {
            loadingState.style.display = 'none';
          }

          renderEmployees();
        } catch (err) {
          showStatus('Failed to load employees. Please refresh.', 'error');

          // Hide loading skeleton even on error
          const loadingState = document.querySelector('.loading-state');
          if (loadingState) {
            loadingState.style.display = 'none';
          }
        }
      }

      function showStatus(message, variant) {
        statusBox.textContent = message;
        statusBox.className = 'status show ' + variant;
      }

      function clearPreview() {
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
          currentPreviewUrl = null;
        }
        previewImage.removeAttribute('src');
        previewMeta.textContent = '';
        previewBox.classList.add('hidden');
      }

      function showPreview(file) {
        if (!(file instanceof File)) {
          clearPreview();
          return;
        }
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
        }
        currentPreviewUrl = URL.createObjectURL(file);
        previewImage.src = currentPreviewUrl;
        previewMeta.textContent = formatBytes(file.size);
        previewBox.classList.remove('hidden');
      }

      uploadTrigger.addEventListener('click', () => {
        imageInput.setAttribute('capture', 'environment');
        imageInput.click();
      });

      galleryTrigger.addEventListener('click', () => {
        imageInput.removeAttribute('capture');
        imageInput.click();
      });

      imageInput.addEventListener('change', () => {
        const file = imageInput.files && imageInput.files[0];
        if (file) {
          showPreview(file);
        } else {
          clearPreview();
        }
      });

      function formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB'];
        const pow = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const value = bytes / 1024 ** pow;
        return (pow === 0 ? value.toFixed(0) : value.toFixed(1)) + ' ' + units[pow];
      }

      async function loadImageSource(file) {
        if (globalThis.createImageBitmap) {
          try {
            const bitmap = await createImageBitmap(file);
            return {
              source: bitmap,
              width: bitmap.width,
              height: bitmap.height,
              cleanup() {
                if (bitmap.close) bitmap.close();
              },
            };
          } catch (error) {
            console.warn('createImageBitmap failed, falling back to <img>', error);
          }
        }

        return new Promise((resolve, reject) => {
          const objectUrl = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
              source: img,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              cleanup() {},
            });
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Unable to process image'));
          };
          img.src = objectUrl;
        });
      }

      async function downscaleImage(file) {
        try {
          const { source, width: originalWidth, height: originalHeight, cleanup } = await loadImageSource(file);
          const largestEdge = Math.max(originalWidth, originalHeight);
          if (!largestEdge || largestEdge <= MAX_UPLOAD_DIMENSION) {
            cleanup();
            return file;
          }

          const scale = MAX_UPLOAD_DIMENSION / largestEdge;
          const width = Math.max(1, Math.round(originalWidth * scale));
          const height = Math.max(1, Math.round(originalHeight * scale));

          let canvas;
          if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(width, height);
          } else {
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
          }

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            cleanup();
            return file;
          }

          ctx.drawImage(source, 0, 0, width, height);
          cleanup();

          let blob;
          if (canvas instanceof OffscreenCanvas) {
            blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
          } else {
            blob = await new Promise((resolve, reject) => {
              canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error('Failed to compress image'))),
                'image/jpeg',
                JPEG_QUALITY,
              );
            });
          }

          const baseName = file.name && file.name.indexOf('.') !== -1 ? file.name.replace(/\.[^.]+$/, '') : 'barcode';
          const scaledFile = new File([blob], baseName + '-scaled.jpg', {
            type: 'image/jpeg',
            lastModified: file.lastModified || Date.now(),
          });
          scaledFile.originalName = file.name;
          scaledFile.originalSize = file.size;
          return scaledFile;
        } catch (error) {
          console.warn('Image downscale failed, uploading original file', error);
          return file;
        }
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const employeeName = employeeInput.value.trim();
        const file = imageInput.files && imageInput.files[0];

        if (!employeeName) {
          showStatus('Please select your name before uploading.', 'error');
          return;
        }
        if (!file) {
          showStatus('Please take a photo of the barcode.', 'error');
          return;
        }

        submitBtn.disabled = true;

        try {
          const preparedFile = await downscaleImage(file);
          const sizeDetails = preparedFile !== file ? ' (compressed to ' + formatBytes(preparedFile.size) + ')' : '';
          showStatus('Uploading and decoding barcode' + sizeDetails + '…', 'success');

          const formData = new FormData();
          formData.append('employeeName', employeeName);
          if (employeeEmailInput.value) {
            formData.append('employeeEmail', employeeEmailInput.value);
          }
          formData.append('image', preparedFile, preparedFile.name || file.name || 'barcode.jpg');
          if (preparedFile.originalName) {
            formData.append('originalFilename', preparedFile.originalName);
          }
          formData.append('sourceSize', String(file.size || 0));

          const response = await fetch('/api/scan', {
            method: 'POST',
            body: formData,
          });

          const payload = await parseJsonResponse(
            response,
            'Server returned an unexpected response while processing the scan.',
          );
          if (!response.ok) {
            showStatus(payload.error || 'Unable to register this scan, please try again.', 'error');
            submitBtn.disabled = false;
            return;
          }

          const archiveMessage = payload.imageUrl ? ' Photo archived for reference.' : '';
          const modelPart = payload.modelCode || '';
          const assetPart = payload.assetTag || '';
          const displayCode =
            (modelPart && assetPart ? modelPart + ' / ' + assetPart : payload.assetCode || payload.rawCode || 'asset')
              .trim();
          const message =
            'Registered ' +
            displayCode +
            ' for ' +
            payload.employeeName +
            ' at ' +
            new Date(payload.createdAt).toLocaleString() +
            '.' +
            archiveMessage;
          showStatus(message, 'success');
          imageInput.value = '';
          clearPreview();
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



const ADMIN_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hardware Scanner Admin</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f5;
        color: #111;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      header {
        padding: 1.5rem;
        background: #1f2937;
        color: #f9fafb;
      }
      header h1 {
        margin: 0 0 0.5rem;
        font-size: 1.8rem;
      }
      main {
        flex: 1;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 1024px;
        width: 100%;
        margin: 0 auto;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
      }
      .toolbar input {
        flex: 1;
        min-width: 200px;
        padding: 0.6rem;
        border-radius: 8px;
        border: 1px solid #d1d5db;
      }
      .toolbar button,
      .toolbar a {
        padding: 0.65rem 1rem;
        border-radius: 8px;
        border: none;
        background: #2563eb;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
      }
      .toolbar a.ghost {
        background: transparent;
        color: #2563eb;
        border: 1px solid #2563eb;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }
      th,
      td {
        padding: 0.65rem;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        vertical-align: top;
      }
      tbody tr:hover {
        background: rgba(37, 99, 235, 0.08);
      }
      .thumbnail {
        width: 120px;
        height: auto;
        border-radius: 8px;
        border: 1px solid rgba(148, 163, 184, 0.5);
        display: block;
      }
      .empty {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          background: #0f172a;
          color: #f8fafc;
        }
        header {
          background: #0f172a;
        }
        .toolbar input {
          background: #1e293b;
          color: inherit;
          border-color: #334155;
        }
        .toolbar button,
        .toolbar a {
          background: #60a5fa;
          color: #0b1c39;
        }
        .toolbar a.ghost {
          color: #bfdbfe;
          border-color: #60a5fa;
          background: transparent;
        }
        table {
          border-color: #1e293b;
        }
        th,
        td {
          border-color: #1e293b;
        }
        tbody tr:hover {
          background: rgba(96, 165, 250, 0.12);
        }
        .thumbnail {
          border-color: rgba(96, 165, 250, 0.5);
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Hardware Scanner — Admin</h1>
      <p>Review all barcode scans, including archived photos and metadata.</p>
    </header>
    <main>
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search by employee, email, model, or asset tag" />
        <button id="refresh-btn" type="button">Refresh</button>
        <a class="ghost" href="/api/scans.csv" download>Download CSV</a>
      </div>
      <section id="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Model Code</th>
              <th>Asset Tag</th>
              <th>Captured At</th>
              <th>Archived Photo</th>
            </tr>
          </thead>
          <tbody id="scan-rows">
            <tr class="empty">
              <td colspan="6">Loading scans…</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
    <script type="module">
      const tbody = document.getElementById('scan-rows');
      const refreshBtn = document.getElementById('refresh-btn');
      const searchInput = document.getElementById('search');
      let scans = [];

      async function parseJsonResponse(response, contextMessage) {
        try {
          return await response.clone().json();
        } catch (error) {
          const rawBody = await response.text();
          const trimmed = rawBody.trim();
          console.warn('Non-JSON response received (admin)', { contextMessage, trimmed });
          if (trimmed.startsWith('<!DOCTYPE')) {
            throw new Error(contextMessage || 'Server sent an unexpected HTML response. Please retry.');
          }
          if (trimmed) {
            throw new Error(contextMessage || 'Server sent an unexpected response: ' + trimmed.slice(0, 120));
          }
          throw new Error(contextMessage || 'Server sent an empty response. Please try again.');
        }
      }

      function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return value;
        }
        return date.toLocaleString();
      }

      function renderRows(list) {
        if (!list || list.length === 0) {
          tbody.innerHTML = '<tr class="empty"><td colspan="6">No scans recorded yet.</td></tr>';
          return;
        }

        const rows = list
          .map((scan) => {
            const employee = scan.employeeName ?? '';
            const email = scan.employeeEmail ?? '';
            const modelCode = scan.modelCode ?? '';
            const assetTag = scan.assetTag ?? '';
            const combined = scan.assetCode ?? [modelCode, assetTag].filter(Boolean).join(' ');
            const captured = formatDate(scan.createdAt);
            const photo = scan.imageUrl
              ? '<a href=\"' +
                scan.imageUrl +
                '\" target=\"_blank\" rel=\"noopener\"><img src=\"' +
                scan.imageUrl +
                '\" alt=\"Barcode photo for ' +
                (combined || 'asset') +
                '\" class=\"thumbnail\" loading=\"lazy\" /></a>'
              : '<em>No photo stored</em>';
            return (
              '<tr>' +
              '<td>' +
              employee +
              '</td>' +
              '<td>' +
              email +
              '</td>' +
              '<td>' +
              modelCode +
              '</td>' +
              '<td>' +
              assetTag +
              '</td>' +
              '<td>' +
              captured +
              '</td>' +
              '<td>' +
              photo +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
        tbody.innerHTML = rows;
        attachImageFallbacks();
      }

      function applyFilter() {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
          renderRows(scans);
          return;
        }
        const filtered = scans.filter((scan) => {
          const employee = scan.employeeName?.toLowerCase() ?? '';
          const email = scan.employeeEmail?.toLowerCase() ?? '';
          const model = scan.modelCode?.toLowerCase() ?? '';
          const asset = scan.assetTag?.toLowerCase() ?? '';
          const combined = scan.assetCode?.toLowerCase() ?? '';
          const raw = scan.rawCode?.toLowerCase() ?? '';
          return (
            employee.includes(term) ||
            email.includes(term) ||
            model.includes(term) ||
            asset.includes(term) ||
            combined.includes(term) ||
            raw.includes(term)
          );
        });
        renderRows(filtered);
      }

      function attachImageFallbacks() {
        document.querySelectorAll('img.thumbnail').forEach((img) => {
          img.onerror = () => {
            const td = img.closest('td');
            if (td) {
              td.innerHTML = '<em>Photo unavailable</em>';
            }
          };
        });
      }
      async function fetchScans() {
        tbody.innerHTML = '<tr class="empty"><td colspan="6">Loading scans…</td></tr>';
        try {
          const response = await fetch('/api/scans');
          if (!response.ok) {
            throw new Error('Failed to load scans');
          }
          scans = await parseJsonResponse(
            response,
            'Admin data response could not be parsed. Please refresh.',
          );
          applyFilter();
        } catch (error) {
          tbody.innerHTML = '<tr class="empty"><td colspan="6">' + error.message + '</td></tr>';
        }
      }

      refreshBtn.addEventListener('click', fetchScans);
      searchInput.addEventListener('input', applyFilter);

      fetchScans();
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

function rotateGrayscale(data, width, height, angle) {
  if (angle === 0) {
    return { data, width, height };
  }

  if (angle === 180) {
    const rotated = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const destIndex = (height - 1 - y) * width + (width - 1 - x);
        rotated[destIndex] = data[srcIndex];
      }
    }
    return { data: rotated, width, height };
  }

  const rotated = new Uint8ClampedArray(data.length);
  const newWidth = height;
  const newHeight = width;

  if (angle === 90) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const destX = height - 1 - y;
        const destY = x;
        rotated[destY * newWidth + destX] = data[srcIndex];
      }
    }
    return { data: rotated, width: newWidth, height: newHeight };
  }

  // angle === 270
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = y * width + x;
      const destX = y;
      const destY = width - 1 - x;
      rotated[destY * newWidth + destX] = data[srcIndex];
    }
  }
  return { data: rotated, width: newWidth, height: newHeight };
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

  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, LINEAR_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  const rotations = [0, 90, 180, 270];
  let lastError;

  for (const angle of rotations) {
    const { data: rotatedData, width: rotatedWidth, height: rotatedHeight } = rotateGrayscale(
      grayscale,
      width,
      height,
      angle,
    );

    const luminanceSource = new RGBLuminanceSource(rotatedData, rotatedWidth, rotatedHeight);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    try {
      const result = reader.decode(binaryBitmap);
      if (!LINEAR_FORMATS.includes(result.getBarcodeFormat())) {
        throw new NotFoundException();
      }
      return {
        text: result.getText(),
        format: BarcodeFormat[result.getBarcodeFormat()],
      };
    } catch (error) {
      reader.reset();
      if (error instanceof NotFoundException) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error('No supported linear barcode found in the supplied image');
}

function randomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(16).slice(2);
}

function generateArchiveKey() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `scans/${timestamp}-${randomId()}.jpg`;
}

function buildImageUrl(request, scanId) {
  if (!scanId) return null;
  const url = new URL(request.url);
  url.pathname = `/api/scans/${scanId}/image`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function buildVersionedImageUrl(request, scanId, imageKey) {
  const base = buildImageUrl(request, scanId);
  if (!base || !imageKey) return base;
  const url = new URL(base);
  url.searchParams.set('v', imageKey);
  return url.toString();
}

async function storeArchiveImage(
  env,
  buffer,
  {
    type,
    employeeName,
    employeeEmail,
    modelCode,
    assetTag,
    rawCode,
    assetCode,
    originalFilename,
    sourceSize,
  },
) {
  if (!env.ARCHIVE_BUCKET) {
    throw new Error('Archive storage is not configured');
  }

  const key = generateArchiveKey();

  const customMetadata = {};
  if (employeeName) customMetadata.employeeName = employeeName;
  if (employeeEmail) customMetadata.employeeEmail = employeeEmail;
  if (modelCode) customMetadata.modelCode = modelCode;
  if (assetTag) customMetadata.assetTag = assetTag;
  if (rawCode) customMetadata.rawCode = rawCode;
  if (assetCode) customMetadata.assetCode = assetCode;
  if (originalFilename) customMetadata.originalFilename = originalFilename;
  if (sourceSize) customMetadata.originalSize = String(sourceSize);

  const metadata = Object.keys(customMetadata).length ? customMetadata : undefined;

  await env.ARCHIVE_BUCKET.put(key, buffer, {
    httpMetadata: {
      contentType: type || ARCHIVE_CONTENT_TYPE,
    },
    customMetadata: metadata,
  });

  return key;
}

async function fetchArchiveImage(env, key) {
  if (!env.ARCHIVE_BUCKET) {
    throw new Error('Archive storage is not configured');
  }
  return env.ARCHIVE_BUCKET.get(key);
}

function handleOptions(request) {
  const headers = {
    ...DEFAULT_HEADERS,
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? 'Content-Type',
  };
  return new Response(null, { status: 204, headers });
}

function composeDisplayName(row) {
  const primary = typeof row.name === 'string' ? row.name.trim() : '';
  const englishParts = [row.english_name, row.surname]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());
  const englishName = englishParts.join(' ');
  const emailLocalPart = typeof row.email === 'string' ? row.email.split('@')[0] : '';

  let display = primary || englishName || emailLocalPart || 'Unnamed Employee';

  if (
    primary &&
    englishName &&
    englishName.toLowerCase() !== primary.toLowerCase() &&
    !primary.includes(englishName)
  ) {
    display = `${primary} (${englishName})`;
  }

  return display.trim();
}

function toTitleCase(value) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEnglishName(given, surname) {
  const parts = [];
  if (typeof given === 'string' && given.trim()) parts.push(toTitleCase(given.trim()));
  if (typeof surname === 'string' && surname.trim()) parts.push(toTitleCase(surname.trim()));
  return parts.join(' ').trim();
}

async function loadEmployeeDirectory(env) {
  if (!env?.SCANS_DB?.prepare) {
    return {
      employees: EMPLOYEES.map((name) => ({
        displayName: name,
        email: null,
        location: null,
        department: null,
      })),
      requireEmail: false,
    };
  }

  try {
    const { results } = await env.SCANS_DB.prepare(
      `SELECT
        employee_id,
        name,
        english_name,
        surname,
        email,
        location,
        org1,
        org2,
        org3
       FROM employees
       WHERE active = 1 AND email IS NOT NULL
       ORDER BY name COLLATE NOCASE`,
    ).all();

    const employees = (results ?? [])
      .map((row) => {
        if (!row?.email) {
          return null;
        }
        const email = String(row.email).trim().toLowerCase();
        if (!email) {
          return null;
        }
        const englishFullName = formatEnglishName(row.english_name, row.surname);
        const koreanName = typeof row.name === 'string' ? row.name.trim() : '';
        const displayName = englishFullName || composeDisplayName(row);
        const department = [row.org1, row.org2, row.org3]
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .join(' • ');
        const location = typeof row.location === 'string' ? row.location.trim() : null;

        return {
          email,
          displayName,
          name: koreanName || null,
          koreanName: koreanName || null,
          englishName: englishFullName || null,
          englishFullName: englishFullName || null,
          surname: typeof row.surname === 'string' ? row.surname.trim() : null,
          location: location || null,
          department: department || null,
          employeeId: row.employee_id != null ? String(row.employee_id) : null,
        };
      })
      .filter(Boolean);

    if (employees.length > 0) {
      return { employees, requireEmail: true };
    }
  } catch (error) {
    console.warn('Falling back to static roster; failed to load employees table.', error);
  }

  return {
      employees: EMPLOYEES.map((name) => ({
        displayName: name,
        email: null,
        location: null,
        department: null,
        englishFullName: name,
        koreanName: name,
      })),
    requireEmail: false,
  };
}

function parseBarcodeIdentifiers(rawText) {
  const normalized = String(rawText ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('The barcode value was empty.');
  }

  const parts = normalized.split(' ');
  if (parts.length < 2) {
    throw new Error('The barcode did not include both model and asset identifiers.');
  }

  const assetCandidate = parts.pop().toUpperCase();
  const modelCandidateRaw = parts.join('');

  const ASSET_TAG_PATTERN = /^[A-Z]{3}\d{4,5}$/;
  if (!ASSET_TAG_PATTERN.test(assetCandidate)) {
    throw new Error('The detected asset tag did not match expected laptop codes. Please rescan the sticker.');
  }

  let modelCandidate = modelCandidateRaw.toUpperCase();
  if (modelCandidate.startsWith('1') && modelCandidate.length > 1) {
    modelCandidate = modelCandidate.slice(1);
  }

  const MODEL_PATTERN = /^[A-Z0-9-]{4,16}$/;
  if (!MODEL_PATTERN.test(modelCandidate)) {
    throw new Error('The detected model code looked incorrect. Please retry with the hardware label.');
  }

  const combined = `${modelCandidate} ${assetCandidate}`.trim();

  return {
    rawCode: normalized,
    modelCode: modelCandidate,
    assetTag: assetCandidate,
    assetCode: combined,
  };
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
  const employeeEmailRaw = String(formData.get('employeeEmail') ?? '').trim().toLowerCase();
  const image = formData.get('image');

  if (!employeeName && !employeeEmailRaw) {
    return jsonResponse({ error: 'Employee selection is required.' }, { status: 400 });
  }

  const { employees: roster, requireEmail } = await loadEmployeeDirectory(env);

  let matchedEmployee = null;

  if (requireEmail) {
    if (!employeeEmailRaw) {
      return jsonResponse({ error: 'Employee email was missing from the submission. Please refresh and try again.' }, { status: 400 });
    }
    matchedEmployee = roster.find((entry) => entry.email === employeeEmailRaw);
    if (!matchedEmployee) {
      return jsonResponse({ error: 'Employee not found or inactive in the roster. Please refresh the list.' }, { status: 404 });
    }
  } else {
    if (!employeeName) {
      return jsonResponse({ error: 'Employee name is required.' }, { status: 400 });
    }
    matchedEmployee = roster.find(
      (entry) => entry.displayName.toLowerCase() === employeeName.toLowerCase(),
    );
    if (!matchedEmployee) {
      return jsonResponse({ error: 'Employee not found in roster. Check spelling or update the roster.' }, { status: 404 });
    }
  }

  const canonicalEmployeeName =
    matchedEmployee.displayName || matchedEmployee.name || matchedEmployee.email || employeeName;
  const canonicalEmployeeEmail = matchedEmployee.email ?? (employeeEmailRaw || null);

  if (!(image instanceof File)) {
    return jsonResponse({ error: 'Image file was not included in the upload.' }, { status: 400 });
  }

  if (!env.ARCHIVE_BUCKET) {
    return jsonResponse({ error: 'Archive storage is not configured. Please contact the administrator.' }, { status: 500 });
  }

  try {
    const buffer = await image.arrayBuffer();
    let identifiers;
    let barcodeFormat = null;
    let rawBarcodeText = null;
    let decodeStrategy = 'barcode';
    let ocrDiagnostics = null;

    try {
      const result = await decodeLinearBarcode(buffer);
      barcodeFormat = result.format;
      rawBarcodeText = result.text;
      identifiers = parseBarcodeIdentifiers(result.text);
    } catch (primaryError) {
      if (!hasOcrSupport(env)) {
        throw primaryError;
      }

      try {
        const ocrResult = await runOcrFallback(env, buffer, {
          filename: image.name,
          contentType: image.type,
        });
        const fallbackIdentifiers = parseBarcodeIdentifiers(ocrResult.rawCombined);
        identifiers = fallbackIdentifiers;
        barcodeFormat = 'OCR';
        rawBarcodeText = ocrResult.rawCombined;
        decodeStrategy = 'ocr';
        ocrDiagnostics = {
          valid: ocrResult.structured?.valid ?? null,
          errors: Array.isArray(ocrResult.structured?.errors) ? ocrResult.structured.errors : [],
          statuses: {
            model_code: ocrResult.structured?.fields?.model_code?.status ?? null,
            asset_code: ocrResult.structured?.fields?.asset_code?.status ?? null,
          },
          confidence: {
            model_code: ocrResult.structured?.fields?.model_code?.confidence ?? null,
            asset_code: ocrResult.structured?.fields?.asset_code?.confidence ?? null,
          },
        };
      } catch (fallbackError) {
        const primaryMessage =
          primaryError instanceof Error ? primaryError.message : 'Barcode decoding failed.';
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${primaryMessage} (OCR fallback failed: ${fallbackMessage})`);
      }
    }

    let imageKey;
    try {
      imageKey = await storeArchiveImage(env, buffer, {
        type: image.type,
        employeeName: canonicalEmployeeName,
        employeeEmail: canonicalEmployeeEmail,
        modelCode: identifiers.modelCode,
        assetTag: identifiers.assetTag,
        rawCode: rawBarcodeText ?? identifiers.rawCode,
        assetCode: identifiers.assetCode,
        originalFilename: formData.get('originalFilename') ? String(formData.get('originalFilename')) : undefined,
        sourceSize: formData.get('sourceSize') ? Number(formData.get('sourceSize')) : undefined,
      });
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : 'Unable to store the barcode photo.';
      return jsonResponse({ error: message }, { status: 503 });
    }

    let inserted;
    try {
      inserted = await env.SCANS_DB.prepare(
        'INSERT INTO scans (employee_name, employee_email, model_code, asset_tag, raw_code, image_key) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id, created_at',
      )
        .bind(
          canonicalEmployeeName,
          canonicalEmployeeEmail,
          identifiers.modelCode,
          identifiers.assetTag,
          rawBarcodeText ?? identifiers.rawCode,
          imageKey,
        )
        .first();
    } catch (dbError) {
      await env.ARCHIVE_BUCKET.delete?.(imageKey).catch(() => {});
      throw new Error('Unable to record scan. Please retry.');
    }

    const createdAt = inserted?.created_at ?? new Date().toISOString();
    const scanId = inserted?.id;

    return jsonResponse(
      {
        employeeName: canonicalEmployeeName,
        employeeEmail: canonicalEmployeeEmail,
        modelCode: identifiers.modelCode,
        assetTag: identifiers.assetTag,
        assetCode: identifiers.assetCode,
        rawCode: rawBarcodeText ?? identifiers.rawCode,
        barcodeFormat,
        decodeStrategy,
        ocr: decodeStrategy === 'ocr' ? ocrDiagnostics : undefined,
        createdAt,
        imageKey,
        imageUrl: buildVersionedImageUrl(request, scanId, imageKey),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, { status: 422 });
  }
}

async function handleScans(request, env) {
  const { results } = await env.SCANS_DB.prepare(
    `SELECT
      id,
      employee_name AS employeeName,
      employee_email AS employeeEmail,
      model_code AS modelCode,
      asset_tag AS assetTag,
      raw_code AS rawCode,
      image_key AS imageKey,
      created_at AS createdAt
     FROM scans
     ORDER BY created_at DESC`,
  ).all();
  const scans = (results ?? []).map((row) => {
    const assetCode = row.modelCode && row.assetTag ? `${row.modelCode} ${row.assetTag}`.trim() : row.rawCode ?? '';
    return {
      ...row,
      assetCode,
      imageUrl: row.imageKey ? buildVersionedImageUrl(request, row.id, row.imageKey) : null,
    };
  });
  return jsonResponse(scans);
}

async function handleCsv(request, env) {
  const { results } = await env.SCANS_DB.prepare(
    `SELECT
      id,
      employee_name AS employeeName,
      employee_email AS employeeEmail,
      model_code AS modelCode,
      asset_tag AS assetTag,
      raw_code AS rawCode,
      image_key AS imageKey,
      created_at AS createdAt
     FROM scans
     ORDER BY created_at DESC`,
  ).all();
  const headers = ['Employee Name', 'Employee Email', 'Model Code', 'Asset Tag', 'Raw Barcode', 'Created At', 'Image URL'];
  const rows = (results ?? []).map((row) => {
    const imageUrl = row.imageKey ? buildVersionedImageUrl(request, row.id, row.imageKey) : '';
    const combined = row.modelCode && row.assetTag ? `${row.modelCode} ${row.assetTag}`.trim() : '';
    const rawBarcode = row.rawCode ?? combined;
    return [
      row.employeeName,
      row.employeeEmail,
      row.modelCode,
      row.assetTag,
      rawBarcode,
      row.createdAt,
      imageUrl,
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="scans.csv"',
      ...DEFAULT_HEADERS,
    },
  });
}

async function handleImageDownload(env, scanId) {
  const record = await env.SCANS_DB.prepare('SELECT image_key AS imageKey FROM scans WHERE id = ?1')
    .bind(scanId)
    .first();

  if (!record?.imageKey) {
    return new Response('Not found', { status: 404 });
  }

  const object = await fetchArchiveImage(env, record.imageKey);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  });
  if (object.httpMetadata?.contentType) {
    headers.set('Content-Type', object.httpMetadata.contentType);
  } else {
    headers.set('Content-Type', ARCHIVE_CONTENT_TYPE);
  }

  return new Response(object.body, { headers });
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

    if (url.pathname === '/admin' && request.method === 'GET') {
      return new Response(ADMIN_PAGE, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    if (url.pathname === '/api/employees' && request.method === 'GET') {
      const directory = await loadEmployeeDirectory(env);
      return jsonResponse(directory.employees);
    }

    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return handleScan(request, env);
    }

    if (url.pathname === '/api/scans' && request.method === 'GET') {
      return handleScans(request, env);
    }

    if (url.pathname === '/api/scans.csv' && request.method === 'GET') {
      return handleCsv(request, env);
    }

    const imageMatch = url.pathname.match(/^\/api\/scans\/(\d+)\/image$/);
    if (imageMatch && request.method === 'GET') {
      return handleImageDownload(env, Number(imageMatch[1]));
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
