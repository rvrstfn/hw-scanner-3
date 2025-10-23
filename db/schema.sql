DROP TABLE IF EXISTS scans;
DROP TABLE IF EXISTS employees;

CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  asset_tag TEXT NOT NULL,
  raw_code TEXT NOT NULL,
  image_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT,
  name TEXT NOT NULL,
  english_name TEXT,
  surname TEXT,
  location TEXT,
  org1 TEXT,
  org2 TEXT,
  org3 TEXT,
  level1 TEXT,
  level2 TEXT,
  email TEXT NOT NULL UNIQUE,
  cost_center TEXT,
  cost_center_description TEXT,
  function_italy TEXT,
  area TEXT,
  cost_category TEXT,
  job_group TEXT,
  notes TEXT,
  hire_date TEXT,
  vendor TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees (active);
