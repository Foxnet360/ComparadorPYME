import { describe, it, expect } from 'vitest';
import { resolveRouteFromLocation, buildPathForView } from '../../../utils/navigation';

describe('navigation utilities', () => {
  it('resolves canonical paths to AppView', () => {
    expect(resolveRouteFromLocation('/', '')).toEqual({ view: 'LANDING', renewalId: null });
    expect(resolveRouteFromLocation('/dashboard', '')).toEqual({ view: 'DASHBOARD', renewalId: null });
    expect(resolveRouteFromLocation('/portfolio', '')).toEqual({ view: 'PORTFOLIO', renewalId: null });
    expect(resolveRouteFromLocation('/portfolio/renewals/ren-123', '')).toEqual({
      view: 'RENEWAL_DETAIL',
      renewalId: 'ren-123',
    });
  });

  it('preserves ?view=, ?demo=1, and #type=recovery precedence', () => {
    expect(resolveRouteFromLocation('/', '?view=CLIENTS')).toEqual({ view: 'CLIENTS', renewalId: null });
    expect(resolveRouteFromLocation('/', '?demo=1')).toEqual({ view: 'DASHBOARD', renewalId: null });
    expect(resolveRouteFromLocation('/', '', '#access_token=x&type=recovery')).toEqual({
      view: 'RESET_PASSWORD',
      renewalId: null,
    });
  });

  it('builds canonical paths for views and renewal detail', () => {
    expect(buildPathForView('LANDING')).toBe('/');
    expect(buildPathForView('DASHBOARD')).toBe('/dashboard');
    expect(buildPathForView('RENEWAL_DETAIL', 'ren-456')).toBe('/portfolio/renewals/ren-456');
  });
});
