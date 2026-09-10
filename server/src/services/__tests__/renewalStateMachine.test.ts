import { describe, it, expect } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.16 — renewal lifecycle state machine.
 * Contract: design Q2 (obs #117) + R3.1/R3.2 (obs #116).
 *
 * States: detected → notified → in_review → quoted → closed (terminal).
 * Outcome rules on close:
 *  - outcome ∈ {renewed_same_insurer, renewed_competitor, lost} is REQUIRED
 *  - final_premium is REQUIRED except when outcome = lost (R3.2)
 *  - loss_reason is REQUIRED when outcome = lost (R3.2), forbidden otherwise
 *  - outcome/final_premium/loss_reason are forbidden on non-closing transitions
 */

import {
  planTransition,
  isRenewalState,
  RENEWAL_STATES,
  InvalidTransitionError,
} from '../renewalStateMachine';

describe('isRenewalState', () => {
  it('accepts every declared state and rejects unknown ones', () => {
    for (const state of RENEWAL_STATES) {
      expect(isRenewalState(state)).toBe(true);
    }
    expect(isRenewalState('archived')).toBe(false);
    expect(isRenewalState('')).toBe(false);
  });
});

describe('planTransition — happy path chain (R3.1)', () => {
  it('detected → notified', () => {
    const plan = planTransition('detected', { to: 'notified' });
    expect(plan.from).toBe('detected');
    expect(plan.to).toBe('notified');
    expect(plan.patch).toEqual({ state: 'notified' });
  });

  it('notified → in_review', () => {
    expect(planTransition('notified', { to: 'in_review' }).patch).toEqual({
      state: 'in_review',
    });
  });

  it('in_review → quoted', () => {
    expect(planTransition('in_review', { to: 'quoted' }).patch).toEqual({ state: 'quoted' });
  });

  it('quoted → closed with renewed_same_insurer and final_premium', () => {
    const plan = planTransition('quoted', {
      to: 'closed',
      outcome: 'renewed_same_insurer',
      final_premium: 1500000,
    });
    expect(plan.patch).toEqual({
      state: 'closed',
      outcome: 'renewed_same_insurer',
      final_premium: 1500000,
    });
  });

  it('quoted → closed with renewed_competitor and final_premium', () => {
    const plan = planTransition('quoted', {
      to: 'closed',
      outcome: 'renewed_competitor',
      final_premium: 1200000,
    });
    expect(plan.patch.outcome).toBe('renewed_competitor');
    expect(plan.patch.final_premium).toBe(1200000);
  });

  it('quoted → closed as lost requires loss_reason and allows omitted final_premium', () => {
    const plan = planTransition('quoted', {
      to: 'closed',
      outcome: 'lost',
      loss_reason: 'Cliente canceló el negocio',
    });
    expect(plan.patch).toEqual({
      state: 'closed',
      outcome: 'lost',
      loss_reason: 'Cliente canceló el negocio',
    });
    expect(plan.patch.final_premium).toBeUndefined();
  });
});

describe('planTransition — illegal transitions (R3.1)', () => {
  it('rejects skipping states (detected → quoted)', () => {
    expect(() => planTransition('detected', { to: 'quoted' })).toThrow(InvalidTransitionError);
  });

  it('rejects backwards transitions (quoted → notified)', () => {
    expect(() => planTransition('quoted', { to: 'notified' })).toThrow(InvalidTransitionError);
  });

  it('rejects self-transitions (in_review → in_review)', () => {
    expect(() => planTransition('in_review', { to: 'in_review' })).toThrow(InvalidTransitionError);
  });

  it('closed is terminal: no outgoing transition is allowed', () => {
    expect(() => planTransition('closed', { to: 'detected' })).toThrow(InvalidTransitionError);
  });

  it('rejects an unknown target state', () => {
    expect(() => planTransition('quoted', { to: 'archived' as never })).toThrow(
      InvalidTransitionError
    );
  });

  it('exposes machine-readable details on rejection', () => {
    try {
      planTransition('detected', { to: 'closed', outcome: 'lost', loss_reason: 'x' });
      expect.unreachable('must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as InvalidTransitionError).details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'to' })])
      );
    }
  });
});

describe('planTransition — outcome rules (R3.2)', () => {
  it('closing requires an outcome', () => {
    expect(() => planTransition('quoted', { to: 'closed' })).toThrow(InvalidTransitionError);
  });

  it('closing rejects an unknown outcome', () => {
    expect(() => planTransition('quoted', { to: 'closed', outcome: 'renewed' as never })).toThrow(
      InvalidTransitionError
    );
  });

  it('lost REQUIRES a non-empty loss_reason', () => {
    expect(() => planTransition('quoted', { to: 'closed', outcome: 'lost' })).toThrow(
      InvalidTransitionError
    );
    expect(() =>
      planTransition('quoted', { to: 'closed', outcome: 'lost', loss_reason: '   ' })
    ).toThrow(InvalidTransitionError);
  });

  it('renewed outcomes REQUIRE final_premium', () => {
    expect(() =>
      planTransition('quoted', { to: 'closed', outcome: 'renewed_same_insurer' })
    ).toThrow(InvalidTransitionError);
    expect(() => planTransition('quoted', { to: 'closed', outcome: 'renewed_competitor' })).toThrow(
      InvalidTransitionError
    );
  });

  it('final_premium must be a non-negative number', () => {
    expect(() =>
      planTransition('quoted', {
        to: 'closed',
        outcome: 'renewed_same_insurer',
        final_premium: -5,
      })
    ).toThrow(InvalidTransitionError);
  });

  it('loss_reason is forbidden when the outcome is not lost', () => {
    expect(() =>
      planTransition('quoted', {
        to: 'closed',
        outcome: 'renewed_same_insurer',
        final_premium: 100,
        loss_reason: 'contradictory payload',
      })
    ).toThrow(InvalidTransitionError);
  });

  it('outcome fields are forbidden on non-closing transitions', () => {
    expect(() =>
      planTransition('detected', { to: 'notified', outcome: 'lost', loss_reason: 'x' })
    ).toThrow(InvalidTransitionError);
    expect(() => planTransition('in_review', { to: 'quoted', final_premium: 900 })).toThrow(
      InvalidTransitionError
    );
  });
});
