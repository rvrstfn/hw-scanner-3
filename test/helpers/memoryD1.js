export function createMemoryD1() {
  const scans = [];
  let nextId = 1;

  function normalizeSelectResults(results) {
    return results
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((row) => ({
        employeeName: row.employee_name,
        assetCode: row.asset_code,
        createdAt: row.created_at,
        id: row.id,
      }));
  }

  return {
    prepare(sql) {
      const trimmed = sql.trim().toUpperCase();
      return {
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (trimmed.startsWith('INSERT INTO SCANS')) {
            const [employeeName, assetCode] = this.args ?? [];
            const createdAt = new Date().toISOString();
            const record = {
              id: nextId++,
              employee_name: employeeName,
              asset_code: assetCode,
              created_at: createdAt,
            };
            scans.push(record);
            return { id: record.id, created_at: record.created_at };
          }

          if (trimmed.startsWith('SELECT')) {
            return normalizeSelectResults(scans)[0] ?? null;
          }

          throw new Error(`MemoryD1 first() does not support SQL: ${sql}`);
        },
        async all() {
          if (trimmed.startsWith('SELECT')) {
            return { results: normalizeSelectResults(scans) };
          }

          throw new Error(`MemoryD1 all() does not support SQL: ${sql}`);
        },
        async run() {
          if (trimmed.startsWith('INSERT INTO SCANS')) {
            await this.first();
            return { success: true };
          }

          throw new Error(`MemoryD1 run() does not support SQL: ${sql}`);
        },
      };
    },
    _dump() {
      return scans.slice();
    },
  };
}
