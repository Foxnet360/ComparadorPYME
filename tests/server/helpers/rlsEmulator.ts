/**
 * RLS semantics emulator for migration 026 (renovacion-polizas).
 *
 * Replicates the exact policy predicates so A≠B denial can be tested without
 * a live Postgres (no Docker on this machine):
 *
 *   user_id tables (clients, policies, renewals, campaign_configs):
 *     USING/CHECK: user_id = auth.uid()::text OR
 *                  user_id = current_setting('app.current_user_id', true)
 *
 *   parent-scoped tables (renewal_events, campaign_deliveries):
 *     USING/CHECK: EXISTS (SELECT 1 FROM renewals
 *                  WHERE renewals.id = <row>.renewal_id
 *                    AND <dual predicate on renewals.user_id>)
 *
 * The security context models the two arms independently; a row is visible
 * when either arm matches. A context with neither arm matches nothing
 * (fail-closed), mirroring RLS with no identity.
 */

export interface RlsContext {
  authUid: string | null;
  gucUserId: string | null;
}

export const RLS_DENIED = 'new row violates row-level security policy';

export const USER_ID_TABLES = ['clients', 'policies', 'renewals', 'campaign_configs'] as const;
export const PARENT_SCOPED_TABLES = ['renewal_events', 'campaign_deliveries'] as const;

type Row = Record<string, unknown>;

export class RlsEmulator {
  private readonly tables = new Map<string, Row[]>();

  seed(table: string, rows: Row[]): void {
    this.tables.set(
      table,
      rows.map((row) => ({ ...row }))
    );
  }

  private rows(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  /** The dual predicate arm resolution from migration 026. */
  private userMatches(rowUserId: unknown, ctx: RlsContext): boolean {
    if (typeof rowUserId !== 'string' || rowUserId === '') {
      return false;
    }
    return rowUserId === ctx.authUid || rowUserId === ctx.gucUserId;
  }

  private isVisible(table: string, row: Row, ctx: RlsContext): boolean {
    if ((USER_ID_TABLES as readonly string[]).includes(table)) {
      return this.userMatches(row.user_id, ctx);
    }
    // renewal_events / campaign_deliveries: EXISTS parent renewal owned.
    const parent = this.rows('renewals').find((renewal) => renewal.id === row.renewal_id);
    return parent !== undefined && this.userMatches(parent.user_id, ctx);
  }

  /** SELECT with USING: only visible rows are returned. */
  select(table: string, ctx: RlsContext): Row[] {
    return this.rows(table).filter((row) => this.isVisible(table, row, ctx));
  }

  /** INSERT with WITH CHECK: a row failing the check is rejected (42501). */
  insert(table: string, row: Row, ctx: RlsContext): Row {
    const stored = { ...row };
    if (!this.isVisible(table, stored, ctx)) {
      throw new Error(RLS_DENIED);
    }
    this.rows(table).push(stored);
    return stored;
  }

  /**
   * UPDATE with USING + WITH CHECK: only visible rows are candidates, and
   * the post-update row must still pass the check. Returns affected count.
   */
  update(table: string, pkColumn: string, pkValue: unknown, patch: Row, ctx: RlsContext): number {
    let affected = 0;
    for (const row of this.rows(table)) {
      if (row[pkColumn] !== pkValue || !this.isVisible(table, row, ctx)) {
        continue;
      }
      const next = { ...row, ...patch };
      if (!this.isVisible(table, next, ctx)) {
        throw new Error(RLS_DENIED);
      }
      Object.assign(row, patch);
      affected += 1;
    }
    return affected;
  }

  /** DELETE with USING: only visible rows are candidates. Returns count. */
  delete(table: string, pkColumn: string, pkValue: unknown, ctx: RlsContext): number {
    const rows = this.rows(table);
    const kept = rows.filter(
      (row) => !(row[pkColumn] === pkValue && this.isVisible(table, row, ctx))
    );
    this.tables.set(table, kept);
    return rows.length - kept.length;
  }
}
