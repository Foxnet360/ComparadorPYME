import { describe, it, expect, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-2 / task 1.10 — RLS A≠B denial tests (XC-1).
 *
 * No Docker on this machine → no live Supabase, so isolation is exercised
 * through a semantics emulator: `RlsEmulator` implements the EXACT policy
 * predicates from migration 026 (`user_id = auth.uid()::text OR user_id =
 * current_setting('app.current_user_id', true)`; renewal_events and
 * campaign_deliveries resolve ownership via EXISTS on the parent renewal),
 * including WITH CHECK on INSERT/UPDATE. The migration SQL itself is pinned
 * by tests/server/migrations/renewalRls.test.ts (PR-1); this suite proves
 * the per-verb denial behavior those policies encode.
 *
 * "Both auth paths" = the two arms of the dual predicate:
 *   (1) JWT arm  — context { authUid }        (supabase-js with user JWT)
 *   (2) GUC arm  — context { gucUserId }      (service role sets the GUC)
 *
 * Live-DB verification (`supabase migration up` + real RLS) remains a
 * CI/staging gate — no local Postgres is available here.
 *
 * Per table: user B must not SELECT/INSERT/UPDATE/DELETE user A's rows via
 * either arm; positive controls prove A retains full access.
 */

import {
  RlsEmulator,
  RLS_DENIED,
  type RlsContext,
  USER_ID_TABLES,
  PARENT_SCOPED_TABLES,
} from '../../../tests/server/helpers/rlsEmulator';

const A = 'user-a';
const B = 'user-b';

/** The two arms of the dual-auth predicate, as user B. */
const B_CONTEXTS: Array<{ arm: string; ctx: RlsContext }> = [
  { arm: 'jwt', ctx: { authUid: B, gucUserId: null } },
  { arm: 'guc', ctx: { authUid: null, gucUserId: B } },
];

let db: RlsEmulator;

beforeEach(() => {
  db = new RlsEmulator();
  db.seed('clients', [
    { id: 'c-a', user_id: A },
    { id: 'c-b', user_id: B },
  ]);
  db.seed('policies', [
    { id: 'p-a', user_id: A },
    { id: 'p-b', user_id: B },
  ]);
  db.seed('renewals', [
    { id: 'r-a', user_id: A, policy_id: 'p-a' },
    { id: 'r-b', user_id: B, policy_id: 'p-b' },
  ]);
  db.seed('renewal_events', [
    { id: 'e-a', renewal_id: 'r-a' },
    { id: 'e-b', renewal_id: 'r-b' },
  ]);
  db.seed('campaign_configs', [
    { user_id: A, windows: [60, 30, 7] },
    { user_id: B, windows: [30] },
  ]);
  db.seed('campaign_deliveries', [
    { id: 'd-a', renewal_id: 'r-a' },
    { id: 'd-b', renewal_id: 'r-b' },
  ]);
});

describe.each(USER_ID_TABLES)('RLS A≠B on user_id table %s', (table) => {
  const ownId = { clients: 'c-b', policies: 'p-b', renewals: 'r-b' }[table] ?? '';
  const otherId = { clients: 'c-a', policies: 'p-a', renewals: 'r-a' }[table] ?? '';
  const pkColumn = table === 'campaign_configs' ? 'user_id' : 'id';
  const otherKey = table === 'campaign_configs' ? A : otherId;
  const ownKey = table === 'campaign_configs' ? B : ownId;

  it.each(B_CONTEXTS)('SELECT via $arm arm returns only own rows', ({ ctx }) => {
    const visible = db.select(table, ctx);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.user_id === B)).toBe(true);
  });

  it.each(B_CONTEXTS)('SELECT via $arm arm as A sees own rows (positive control)', () => {
    const visible = db.select(table, { authUid: A, gucUserId: null });
    expect(visible.some((row) => row.user_id === A)).toBe(true);
  });

  it.each(B_CONTEXTS)('INSERT via $arm arm with user_id=A is denied by WITH CHECK', ({ ctx }) => {
    expect(() => db.insert(table, { [pkColumn]: 'new-x', user_id: A }, ctx)).toThrow(RLS_DENIED);
    expect(db.select(table, { authUid: A, gucUserId: null })).toHaveLength(1);
  });

  it.each(B_CONTEXTS)('UPDATE via $arm arm on A row affects 0 rows', ({ ctx }) => {
    const affected = db.update(table, pkColumn, otherKey, { tampered: true }, ctx);
    expect(affected).toBe(0);
    const asA = db.select(table, { authUid: A, gucUserId: null });
    expect(asA[0].tampered).toBeUndefined();
  });

  it.each(B_CONTEXTS)('DELETE via $arm arm on A row keeps the row', ({ ctx }) => {
    const affected = db.delete(table, pkColumn, otherKey, ctx);
    expect(affected).toBe(0);
    expect(db.select(table, { authUid: A, gucUserId: null })).toHaveLength(1);
  });

  it.each(B_CONTEXTS)('own-row mutations via $arm arm succeed (positive control)', ({ ctx }) => {
    // campaign_configs is keyed BY user_id (one row per user): the
    // insert-positive case is covered by the WITH CHECK denial test above;
    // inserting a second row with the same key would corrupt the fixture.
    if (table !== 'campaign_configs') {
      expect(() => db.insert(table, { [pkColumn]: 'b-new', user_id: B }, ctx)).not.toThrow();
    }
    expect(db.update(table, pkColumn, ownKey, { tampered: true }, ctx)).toBe(1);
    if (table !== 'campaign_configs') {
      expect(db.delete(table, pkColumn, 'b-new', ctx)).toBe(1);
    }
  });
});

describe.each(PARENT_SCOPED_TABLES)('RLS A≠B on parent-scoped table %s', (table) => {
  const otherId = table === 'renewal_events' ? 'e-a' : 'd-a';
  const ownId = table === 'renewal_events' ? 'e-b' : 'd-b';

  it.each(B_CONTEXTS)('SELECT via $arm arm returns only rows of own renewals', ({ ctx }) => {
    const visible = db.select(table, ctx);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.renewal_id === 'r-b')).toBe(true);
  });

  it.each(B_CONTEXTS)("INSERT via $arm arm into A's renewal is denied by WITH CHECK", ({ ctx }) => {
    expect(() => db.insert(table, { id: 'x-1', renewal_id: 'r-a' }, ctx)).toThrow(RLS_DENIED);
    expect(db.select(table, { authUid: A, gucUserId: null })).toHaveLength(1);
  });

  it.each(B_CONTEXTS)("UPDATE via $arm arm on A's row affects 0 rows", ({ ctx }) => {
    expect(db.update(table, 'id', otherId, { tampered: true }, ctx)).toBe(0);
    const asA = db.select(table, { authUid: A, gucUserId: null });
    expect(asA[0].tampered).toBeUndefined();
  });

  it.each(B_CONTEXTS)("DELETE via $arm arm on A's row keeps the row", ({ ctx }) => {
    expect(db.delete(table, 'id', otherId, ctx)).toBe(0);
    expect(db.select(table, { authUid: A, gucUserId: null })).toHaveLength(1);
  });

  it.each(B_CONTEXTS)(
    'own-renewal mutations via $arm arm succeed (positive control)',
    ({ ctx }) => {
      expect(() => db.insert(table, { id: 'b-new', renewal_id: 'r-b' }, ctx)).not.toThrow();
      expect(db.update(table, 'id', ownId, { tampered: true }, ctx)).toBe(1);
      expect(db.delete(table, 'id', 'b-new', ctx)).toBe(1);
    }
  );
});

describe('dual-arm equivalence (XC-1)', () => {
  it('both arms resolve the same visibility set for the same user', () => {
    for (const table of [...USER_ID_TABLES, ...PARENT_SCOPED_TABLES]) {
      const viaJwt = db.select(table, { authUid: A, gucUserId: null });
      const viaGuc = db.select(table, { authUid: null, gucUserId: A });
      expect(viaGuc).toEqual(viaJwt);
    }
  });

  it('a context with neither arm sees nothing (fail-closed)', () => {
    for (const table of [...USER_ID_TABLES, ...PARENT_SCOPED_TABLES]) {
      expect(db.select(table, { authUid: null, gucUserId: null })).toHaveLength(0);
    }
  });
});
