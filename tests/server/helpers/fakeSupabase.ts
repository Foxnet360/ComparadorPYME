/**
 * In-memory Supabase query-builder fake for server integration tests.
 *
 * Implements the exact builder subset used by the renovacion-polizas
 * repositories (clientRepository, policyRepository, analysisRepository):
 *
 *   from(t).insert(rows).select('*').single()
 *   from(t).select('*').eq(col, val)...order(col, { ascending })
 *   from(t).select('*').eq(...).single()              → PGRST116 when empty
 *   from(t).update(row).eq(...).select('*').single()  → PGRST116 when empty
 *   from(t).delete().eq(...)                          → awaited directly
 *
 * Rows are stored per table; insert fills `id`, `created_at` and
 * `updated_at` defaults the way Postgres would. The fake applies the `.eq`
 * filters the repositories send, so user scoping (AUTH-2) is exercised for
 * real: a repository that forgot `.eq('user_id', ...)` would leak rows here.
 */

export type FakeRow = Record<string, unknown>;

export interface FakeDbError {
  code: string;
  message: string;
}

export interface FakeResult {
  data: unknown;
  error: FakeDbError | null;
}

const NOT_FOUND: FakeDbError = { code: 'PGRST116', message: 'Results contain 0 rows' };

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<[string, unknown]> = [];
  private payload: FakeRow | FakeRow[] | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string
  ) {}

  select(_columns?: string): this {
    // select() after insert()/update() only marks "returning"; the op stays.
    return this;
  }

  insert(rows: FakeRow | FakeRow[]): this {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }

  update(row: FakeRow): this {
    this.op = 'update';
    this.payload = row;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  single(): Promise<FakeResult> {
    return Promise.resolve(this.executeSingle());
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private matches(row: FakeRow): boolean {
    return this.filters.every(([col, val]) => row[col] === val);
  }

  private executeSingle(): FakeResult {
    const result = this.execute();
    if (result.error) {
      return result;
    }
    const rows = result.data as FakeRow[];
    if (rows.length === 0) {
      return { data: null, error: NOT_FOUND };
    }
    return { data: rows[0], error: null };
  }

  private execute(): FakeResult {
    const rows = this.db.rows(this.table);

    switch (this.op) {
      case 'insert': {
        const inserted = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((row) =>
          this.db.insertRow(this.table, row ?? {})
        );
        return { data: inserted, error: null };
      }
      case 'select': {
        let out = rows.filter((row) => this.matches(row));
        if (this.orderCol) {
          const col = this.orderCol;
          const dir = this.orderAsc ? 1 : -1;
          out = [...out].sort((a, b) => {
            const av = a[col];
            const bv = b[col];
            if (av === bv) return 0;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            return av < bv ? -dir : dir;
          });
        }
        return { data: out, error: null };
      }
      case 'update': {
        const patch = (this.payload ?? {}) as FakeRow;
        const updated: FakeRow[] = [];
        for (const row of rows) {
          if (this.matches(row)) {
            Object.assign(row, patch);
            updated.push(row);
          }
        }
        return { data: updated, error: null };
      }
      case 'delete': {
        const kept = rows.filter((row) => !this.matches(row));
        this.db.replaceRows(this.table, kept);
        return { data: null, error: null };
      }
    }
  }
}

export class FakeSupabase {
  private readonly tables = new Map<string, FakeRow[]>();
  readonly client = {
    from: (table: string) => new FakeQueryBuilder(this, table),
  };

  rows(table: string): FakeRow[] {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return this.tables.get(table) as FakeRow[];
  }

  replaceRows(table: string, rows: FakeRow[]): void {
    this.tables.set(table, rows);
  }

  insertRow(table: string, row: FakeRow): FakeRow {
    const stored: FakeRow = { ...row };
    if (stored.id === undefined) {
      stored.id = crypto.randomUUID();
    }
    const now = new Date().toISOString();
    if (stored.created_at === undefined) stored.created_at = now;
    if (stored.updated_at === undefined) stored.updated_at = now;
    this.rows(table).push(stored);
    return stored;
  }

  /** Seed a table directly (bypasses repository code). */
  seed(table: string, rows: FakeRow[]): void {
    for (const row of rows) {
      this.insertRow(table, row);
    }
  }
}

export function createFakeSupabase(): FakeSupabase {
  return new FakeSupabase();
}
