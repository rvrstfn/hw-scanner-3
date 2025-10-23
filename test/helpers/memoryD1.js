export function createMemoryD1() {
  const scans = [];
  let nextId = 1;
  const employees = [
    {
      id: 1,
      active: 1,
      name: 'Alex Johnson',
      english_name: 'Alex Johnson',
      surname: null,
      email: 'alex.johnson@example.com',
      location: 'HQ',
      org1: 'IT',
      org2: 'Operations',
      org3: null,
    },
  ];

  function normalizeSelectResults(results) {
    return results
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((row) => {
        const assetCode =
          row.model_code && row.asset_tag ? `${row.model_code} ${row.asset_tag}`.trim() : row.raw_code ?? '';
        return {
          employeeName: row.employee_name,
          employeeEmail: row.employee_email,
          modelCode: row.model_code,
          assetTag: row.asset_tag,
          rawCode: row.raw_code,
          assetCode,
          imageKey: row.image_key,
          createdAt: row.created_at,
          id: row.id,
        };
      });
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
            const [employeeName, employeeEmail, modelCode, assetTag, rawCode, imageKey] = this.args ?? [];
            const createdAt = new Date().toISOString();
            const record = {
              id: nextId++,
              employee_name: employeeName,
              employee_email: employeeEmail,
              model_code: modelCode,
              asset_tag: assetTag,
              raw_code: rawCode,
              image_key: imageKey,
              created_at: createdAt,
            };
            scans.push(record);
            return { id: record.id, created_at: record.created_at };
          }

          if (trimmed.startsWith('SELECT')) {
            if (trimmed.includes('FROM EMPLOYEES')) {
              const activeEmployees = employees
                .filter((row) => row.active)
                .map((row) => ({
                  name: row.name,
                  english_name: row.english_name,
                  surname: row.surname,
                  email: row.email,
                  location: row.location,
                  org1: row.org1,
                  org2: row.org2,
                  org3: row.org3,
                  employee_id: row.id,
                }));

              if (trimmed.includes('WHERE') && trimmed.includes('EMAIL = ?')) {
                const [email] = this.args ?? [];
                const match = activeEmployees.find((row) => row.email === email);
                return match ?? null;
              }

              return { results: activeEmployees };
            }

            if (trimmed.includes('WHERE ID')) {
              const [id] = this.args ?? [];
              const record = scans.find((row) => row.id === Number(id));
              if (!record) {
                return null;
              }
              return {
                employeeName: record.employee_name,
                employeeEmail: record.employee_email,
                modelCode: record.model_code,
                assetTag: record.asset_tag,
                rawCode: record.raw_code,
                assetCode:
                  record.model_code && record.asset_tag
                    ? `${record.model_code} ${record.asset_tag}`.trim()
                    : record.raw_code ?? '',
                imageKey: record.image_key,
                createdAt: record.created_at,
                id: record.id,
                image_key: record.image_key,
              };
            }
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

          if (trimmed.startsWith('DELETE FROM SCANS')) {
            const [id] = this.args ?? [];
            const index = scans.findIndex((row) => row.id === Number(id));
            if (index !== -1) {
              scans.splice(index, 1);
            }
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
