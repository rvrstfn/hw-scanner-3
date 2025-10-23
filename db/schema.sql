DROP TABLE IF EXISTS scans;

CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  model_code TEXT NOT NULL,
  asset_tag TEXT NOT NULL,
  raw_code TEXT NOT NULL,
  image_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
