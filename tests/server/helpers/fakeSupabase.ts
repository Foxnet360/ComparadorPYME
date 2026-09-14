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

/** Postgres unique_violation, e.g. the renewals one-open-per-cycle index. */
export const UNIQUE_VIOLATION: FakeDbError = {
  code: '23505',
  message: 'duplicate key value violates unique constraint',
};

/**
 * Unique constraint emulation for the renovacion-polizas tables. `partial`
 * replicates a partial index predicate (WHERE clause): a conflict only counts
 * when BOTH the existing and the incoming row satisfy it.
 */
export interface FakeUniqueConstraint {
  table: string;
  columns: string[];
  partial?: (row: FakeRow) => boolean;
}

/**
 * Migration-derived constraints exercised by PR-4 behavior tests:
 * - renewals: ONE open renewal per (policy_id, cycle_start) WHERE state<>'closed' (R3.3)
 * - campaign_deliveries: UNIQUE(renewal_id, window_key) (R4.3)
 */
export const RENEWAL_UNIQUE_CONSTRAINTS: readonly FakeUniqueConstraint[] = [
  {
    table: 'renewals',
    columns: ['policy_id', 'cycle_start'],
    partial: (row) => row.state !== 'closed',
  },
  { table: 'campaign_deliveries', columns: ['renewal_id', 'window_key'] },
];

class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

type Filter =
  | { op: 'eq' | 'neq'; column: string; value: unknown }
  | { op: 'in'; column: string; values: unknown[] }
  | { op: 'not-is'; column: string; value: unknown };

function applyFilter(row: FakeRow, filter: Filter): boolean {
  switch (filter.op) {
    case 'eq':
      return row[filter.column] === filter.value;
    case 'neq':
      return row[filter.column] !== filter.value;
    case 'in':
      return filter.values.includes(row[filter.column]);
    case 'not-is':
      // .not(col, 'is', null) → row[col] IS NOT NULL
      return row[filter.column] !== null && row[filter.column] !== undefined;
  }
}

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Filter[] = [];
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
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ op: 'in', column, values });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator !== 'is') {
      throw new Error(`fakeSupabase: unsupported .not operator "${operator}"`);
    }
    this.filters.push({ op: 'not-is', column, value });
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
    return this.filters.every((filter) => applyFilter(row, filter));
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
        try {
          const inserted = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(
            (row) => this.db.insertRow(this.table, row ?? {})
          );
          return { data: inserted, error: null };
        } catch (error) {
          if (error instanceof UniqueViolationError) {
            return { data: null, error: { ...UNIQUE_VIOLATION } };
          }
          throw error;
        }
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
  private readonly uniqueConstraints: FakeUniqueConstraint[] = [];
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

  /** Register a UNIQUE constraint (optionally partial) enforced on insert. */
  registerUnique(table: string, constraint: Omit<FakeUniqueConstraint, 'table'>): void {
    const exists = this.uniqueConstraints.some(
      (c) => c.table === table && c.columns.join(',') === constraint.columns.join(',')
    );
    if (!exists) {
      this.uniqueConstraints.push({ ...constraint, table });
    }
  }

  /** Drop all registered constraints (test isolation). */
  clearConstraints(): void {
    this.uniqueConstraints.length = 0;
  }

  private assertUnique(table: string, incoming: FakeRow): void {
    for (const constraint of this.uniqueConstraints) {
      if (constraint.table !== table) {
        continue;
      }
      if (constraint.partial && !constraint.partial(incoming)) {
        continue;
      }
      const clash = this.rows(table).some((row) => {
        if (constraint.partial && !constraint.partial(row)) {
          return false;
        }
        return constraint.columns.every((col) => row[col] === incoming[col]);
      });
      if (clash) {
        throw new UniqueViolationError(
          `${UNIQUE_VIOLATION.message} on ${table}(${constraint.columns.join(', ')})`
        );
      }
    }
  }

  insertRow(table: string, row: FakeRow): FakeRow {
    const stored: FakeRow = { ...row };
    if (stored.id === undefined) {
      stored.id = crypto.randomUUID();
    }
    const now = new Date().toISOString();
    if (stored.created_at === undefined) stored.created_at = now;
    if (stored.updated_at === undefined) stored.updated_at = now;
    this.assertUnique(table, stored);
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
