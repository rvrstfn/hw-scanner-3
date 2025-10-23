#!/usr/bin/env node

import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import xlsx from 'xlsx';

function parseArgs(argv) {
  const args = {
    file: null,
    database: process.env.D1_DATABASE || 'hw_scanner_3',
    remote: false,
    dryRun: false,
    emailDomain: '@intercos.com',
  };

  for (let i = 2; i < argv.length; i++) {
    const value = argv[i];
    if (value === '--file' || value === '-f') {
      args.file = argv[++i];
    } else if (value === '--database' || value === '-d') {
      args.database = argv[++i];
    } else if (value === '--remote') {
      args.remote = true;
    } else if (value === '--dry-run') {
      args.dryRun = true;
    } else if (value === '--email-domain') {
      args.emailDomain = argv[++i];
      if (!args.emailDomain.startsWith('@')) {
        args.emailDomain = `@${args.emailDomain}`;
      }
    } else if (value === '--help' || value === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${value}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!args.file) {
    console.error('Missing --file argument pointing to the HR Excel export.');
    printUsage();
    process.exit(1);
  }

  return args;
}

function printUsage() {
  console.log(`
Sync HR roster into Cloudflare D1.

Usage:
  node scripts/sync-employees.mjs --file <path-to-xlsx> [--database hw_scanner_3] [--remote] [--dry-run] [--email-domain intercos.com]

Options:
  --file, -f          Absolute path to the HR Excel file (required)
  --database, -d      D1 database binding name (default hw_scanner_3)
  --remote            Execute against the remote D1 database instead of local preview
  --dry-run           Print the generated SQL without executing it
  --email-domain      Domain to append when spreadsheet includes only the mailbox (default @intercos.com)
`);
}

function excelSerialToISO(serial) {
  if (serial == null || Number.isNaN(Number(serial))) {
    return null;
  }
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel serial 1
  const ms = Number(serial) * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + ms);
  return date.toISOString().slice(0, 10);
}

function normaliseEmail(raw, domain) {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;
  const parts = cleaned.split(';')[0].trim(); // handle semicolon separated
  const final = parts.includes('@') ? parts : `${parts}${domain}`;
  return final.toLowerCase();
}

function escapeSql(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function loadWorkbook(path) {
  const workbook = xlsx.readFile(path);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return { sheetName, rows };
}

function normaliseRow(row, emailDomain) {
  const email = normaliseEmail(row['E-mail'], emailDomain);
  if (!email) {
    return null;
  }
  return {
    employee_id: row.ID != null ? String(row.ID).trim() : null,
    name: row.Name != null ? String(row.Name).trim() : null,
    english_name: row['English Name'] != null ? String(row['English Name']).trim() : null,
    surname: row['Sur Name'] != null ? String(row['Sur Name']).trim() : null,
    location: row.Location != null ? String(row.Location).trim() : null,
    org1: row['Org. 1'] != null ? String(row['Org. 1']).trim() : null,
    org2: row['Org. 2'] != null ? String(row['Org. 2']).trim() : null,
    org3: row['Org. 3'] != null ? String(row['Org. 3']).trim() : null,
    level1: row['Level 1'] != null ? String(row['Level 1']).trim() : null,
    level2: row['Level 2'] != null ? String(row['Level 2']).trim() : null,
    email,
    cost_center: row['Cost Center'] != null ? String(row['Cost Center']).trim() : null,
    cost_center_description:
      row['Cost center descr.'] != null ? String(row['Cost center descr.']).trim() : null,
    function_italy:
      row['Function (Italy)'] != null ? String(row['Function (Italy)']).trim() : null,
    area: row.AREA != null ? String(row.AREA).trim() : null,
    cost_category: row['원가구분'] != null ? String(row['원가구분']).trim() : null,
    job_group: row['Job Group'] != null ? String(row['Job Group']).trim() : null,
    notes: row['비고'] != null ? String(row['비고']).trim() : null,
    hire_date: excelSerialToISO(row['입사일']),
    vendor: row.vendor != null ? String(row.vendor).trim() : null,
  };
}

function buildInsertStatements(records) {
  const columns = [
    'employee_id',
    'name',
    'english_name',
    'surname',
    'location',
    'org1',
    'org2',
    'org3',
    'level1',
    'level2',
    'email',
    'cost_center',
    'cost_center_description',
    'function_italy',
    'area',
    'cost_category',
    'job_group',
    'notes',
    'hire_date',
    'vendor',
    'active',
    'deleted_at',
    'updated_at',
  ];

  const nowExpr = "datetime('now')";

  return records.map((record) => {
    const values = [
      escapeSql(record.employee_id),
      escapeSql(record.name),
      escapeSql(record.english_name),
      escapeSql(record.surname),
      escapeSql(record.location),
      escapeSql(record.org1),
      escapeSql(record.org2),
      escapeSql(record.org3),
      escapeSql(record.level1),
      escapeSql(record.level2),
      escapeSql(record.email),
      escapeSql(record.cost_center),
      escapeSql(record.cost_center_description),
      escapeSql(record.function_italy),
      escapeSql(record.area),
      escapeSql(record.cost_category),
      escapeSql(record.job_group),
      escapeSql(record.notes),
      escapeSql(record.hire_date),
      escapeSql(record.vendor),
      '1',
      'NULL',
      nowExpr,
    ];

    return `INSERT INTO employees (${columns.join(', ')}) VALUES (${values.join(', ')})
ON CONFLICT(email) DO UPDATE SET
  employee_id=excluded.employee_id,
  name=excluded.name,
  english_name=excluded.english_name,
  surname=excluded.surname,
  location=excluded.location,
  org1=excluded.org1,
  org2=excluded.org2,
  org3=excluded.org3,
  level1=excluded.level1,
  level2=excluded.level2,
  cost_center=excluded.cost_center,
  cost_center_description=excluded.cost_center_description,
  function_italy=excluded.function_italy,
  area=excluded.area,
  cost_category=excluded.cost_category,
  job_group=excluded.job_group,
  notes=excluded.notes,
  hire_date=excluded.hire_date,
  vendor=excluded.vendor,
  active=1,
  deleted_at=NULL,
  updated_at=${nowExpr};`;
  });
}

function buildSoftDeleteStatement(activeEmails) {
  if (!activeEmails.length) {
    return `UPDATE employees
SET active=0, deleted_at=datetime('now'), updated_at=datetime('now')
WHERE active=1;`;
  }

  const emailList = activeEmails.map((email) => escapeSql(email)).join(', ');
  return `UPDATE employees
SET active=0, deleted_at=datetime('now'), updated_at=datetime('now')
WHERE active=1 AND email NOT IN (${emailList});`;
}

function runWrangler(database, remote, sqlFilePath) {
  const args = ['d1', 'execute', database, '--file', sqlFilePath];
  if (remote) {
    args.push('--remote');
  }
  const result = spawnSync('wrangler', args, { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`wrangler exited with code ${result.status}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const absoluteFile = resolve(args.file);
  console.log(`Reading roster: ${absoluteFile}`);

  const { sheetName, rows } = loadWorkbook(absoluteFile);
  console.log(`Loaded sheet "${sheetName}" with ${rows.length} rows`);

  const deduped = new Map();
  let skippedWithoutEmail = 0;

  for (const row of rows) {
    const normalised = normaliseRow(row, args.emailDomain);
    if (!normalised || !normalised.name) {
      if (!normalised) skippedWithoutEmail += 1;
      continue;
    }
    deduped.set(normalised.email, normalised);
  }

  const records = Array.from(deduped.values());
  records.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Prepared ${records.length} active employees (skipped ${skippedWithoutEmail} without email).`);

  if (records.length === 0) {
    console.error('No employees to sync. Aborting.');
    process.exit(1);
  }

  const statements = [
    'BEGIN TRANSACTION;',
    ...buildInsertStatements(records),
    buildSoftDeleteStatement(records.map((r) => r.email)),
    'COMMIT;',
  ];

  const sql = statements.join('\n\n');

  if (args.dryRun) {
    console.log('--- BEGIN SQL ---');
    console.log(sql);
    console.log('--- END SQL ---');
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'employee-sync-'));
  const sqlFile = join(tempDir, 'sync.sql');
  writeFileSync(sqlFile, sql);
  console.log(`Executing SQL via wrangler (${args.remote ? 'remote' : 'local preview'} database)...`);

  try {
    runWrangler(args.database, args.remote, sqlFile);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  console.log('Employee sync completed.');
}

main();
