import { useSyncExternalStore } from 'react';

export const ROUTES = ['table', 'trainer', 'counting', 'stats', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

const parse = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'table';
};

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
};

/** Tiny hash router: `#/trainer` etc. Back/forward and deep links just work. */
export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, parse, () => 'table');
}

export const hrefFor = (route: Route): string => `#/${route}`;
