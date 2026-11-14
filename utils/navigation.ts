import type { AppView } from '../hooks/useAnalysisFlow';

const VIEW_TO_PATH: Record<AppView, string> = {
  LANDING: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  RESET_PASSWORD: '/reset-password',
  LEGAL: '/legal',
  DASHBOARD: '/dashboard',
  ANALYZER: '/analyzer',
  REPORT: '/report',
  CLIENTS: '/clients',
  INSURERS: '/insurers',
  ANALYTICS: '/analytics',
  USERS: '/users',
  PORTFOLIO: '/portfolio',
  RENEWAL_DETAIL: '/portfolio/renewals',
};

const PATH_TO_VIEW: Record<string, AppView> = Object.entries(VIEW_TO_PATH).reduce(
  (acc, [view, path]) => {
    acc[path] = view as AppView;
    return acc;
  },
  {} as Record<string, AppView>
);

export interface ResolvedRoute {
  view: AppView;
  renewalId: string | null;
}

/**
 * Resolves the initial/current AppView and optional renewalId from URL search params and pathname.
 * Preserves backward compatibility with `?view=` and `?demo=1`.
 */
export function resolveRouteFromLocation(
  pathname: string,
  search: string,
  hash = ''
): ResolvedRoute {
  const searchParams = new URLSearchParams(search);
  const queryView = searchParams.get('view') as AppView | null;
  if (queryView && queryView in VIEW_TO_PATH) {
    return { view: queryView, renewalId: null };
  }
  if (searchParams.get('demo') === '1') {
    return { view: 'DASHBOARD', renewalId: null };
  }
  if (hash.includes('type=recovery')) {
    return { view: 'RESET_PASSWORD', renewalId: null };
  }

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath.startsWith('/portfolio/renewals/')) {
    const renewalId = normalizedPath.slice('/portfolio/renewals/'.length).split('/')[0] || null;
    if (renewalId) {
      return { view: 'RENEWAL_DETAIL', renewalId: decodeURIComponent(renewalId) };
    }
  }

  const matchedView = PATH_TO_VIEW[normalizedPath];
  return { view: matchedView ?? 'LANDING', renewalId: null };
}

/**
 * Builds the canonical URL path for a given AppView and optional renewalId.
 */
export function buildPathForView(view: AppView, renewalId?: string | null): string {
  if (view === 'RENEWAL_DETAIL' && renewalId) {
    return `/portfolio/renewals/${encodeURIComponent(renewalId)}`;
  }
  return VIEW_TO_PATH[view] ?? '/';
}
