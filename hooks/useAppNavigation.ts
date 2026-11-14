import { useState, useEffect, useCallback } from 'react';
import type { AppView } from './useAnalysisFlow';
import { resolveRouteFromLocation, buildPathForView } from '../utils/navigation';

export interface NavigateOptions {
  renewalId?: string | null;
  replace?: boolean;
}

/**
 * Manages SPA view state synchronized with the browser History API (pushState/popstate),
 * while preserving backward compatibility with `?view=`, `?demo=1`, and `#type=recovery`.
 */
export function useAppNavigation(hasReport: boolean) {
  const initialRoute =
    typeof window !== 'undefined'
      ? resolveRouteFromLocation(window.location.pathname, window.location.search, window.location.hash)
      : { view: 'LANDING' as AppView, renewalId: null };

  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [activeRenewalId, setActiveRenewalId] = useState<string | null>(initialRoute.renewalId);

  const navigateTo = useCallback(
    (view: AppView, options?: NavigateOptions) => {
      const nextRenewalId =
        options?.renewalId !== undefined
          ? options.renewalId
          : view === 'RENEWAL_DETAIL'
            ? activeRenewalId
            : null;

      if (options?.renewalId !== undefined) {
        setActiveRenewalId(options.renewalId);
      }
      setCurrentView(view);

      if (typeof window !== 'undefined') {
        const nextPath = buildPathForView(view, nextRenewalId);
        const search = window.location.search;
        const targetUrl = search.includes('demo=1') ? `${nextPath}${search}` : nextPath;
        if (window.location.pathname !== nextPath) {
          const method = options?.replace ? 'replaceState' : 'pushState';
          window.history[method]({ view, renewalId: nextRenewalId }, '', targetUrl);
        }
      }
    },
    [activeRenewalId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const resolved = resolveRouteFromLocation(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      if (resolved.view === 'REPORT' && !hasReport) {
        setCurrentView('DASHBOARD');
        return;
      }
      setActiveRenewalId(resolved.renewalId);
      setCurrentView(resolved.view);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasReport]);

  return {
    currentView,
    activeRenewalId,
    navigateTo,
  };
}
