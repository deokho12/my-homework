/**
 * Web replacement for the `expo-router` API surface this app used:
 * `router`, `Stack`, `Tabs`, `useLocalSearchParams`, `usePathname`, `useFocusEffect`.
 *
 * Backed by react-router-dom. Screens keep their original imperative navigation calls
 * (including the `/(tabs)/...` group paths, which are normalised here the same way
 * expo-router's route groups were: the parenthesised segment never appears in the URL).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
} from 'react-router-dom';

export type Href = string | { pathname: string; params?: Record<string, string | number | undefined> };

/** Route groups like `(tabs)` are organisational only — they never appear in the URL. */
function stripGroups(pathname: string): string {
  const cleaned = pathname
    .split('/')
    .filter((segment) => segment.length > 0 && !/^\(.*\)$/.test(segment))
    .join('/');
  return `/${cleaned}`.replace(/\/{2,}/g, '/');
}

function resolveHref(href: Href): string {
  if (typeof href === 'string') return stripGroups(href);

  const path = stripGroups(href.pathname);
  const entries = Object.entries(href.params ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (entries.length === 0) return path;

  const query = new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString();
  return `${path}?${query}`;
}

/* ------------------------------------------------------------------ imperative router */

let navigateRef: NavigateFunction | null = null;

/** Bridges react-router's hook-only navigate into the module-level `router` object. */
export function RouterBridge() {
  const navigate = useNavigate();
  navigateRef = navigate;
  return null;
}

function assertNavigate(): NavigateFunction {
  if (!navigateRef) {
    throw new Error('Navigation used before <RouterBridge /> mounted.');
  }
  return navigateRef;
}

export const router = {
  push: (href: Href) => assertNavigate()(resolveHref(href)),
  replace: (href: Href) => assertNavigate()(resolveHref(href), { replace: true }),
  navigate: (href: Href) => assertNavigate()(resolveHref(href)),
  back: () => assertNavigate()(-1),
  canGoBack: () => window.history.length > 1,
  setParams: (params: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    assertNavigate()(`${url.pathname}${url.search}`, { replace: true });
  },
};

/* ------------------------------------------------------------------ hooks */

/** expo-router merged dynamic segments and query params into one object; so do we. */
export function useLocalSearchParams<T extends Record<string, string | undefined>>(): T {
  const params = useParams();
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const merged: Record<string, string | undefined> = { ...params };
    searchParams.forEach((value, key) => {
      merged[key] = value;
    });
    return merged as T;
  }, [params, searchParams]);
}

export function usePathname(): string {
  return useLocation().pathname;
}

/**
 * expo-router re-ran this whenever the memoised callback changed while the screen was
 * focused. With react-router each screen unmounts on navigation, so a plain effect keyed
 * on the same callback reproduces that behaviour (and the cleanup on blur).
 */
export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(callback, [callback]);
}

/* ------------------------------------------------------------------ Stack / screen options */

export interface ScreenOptions {
  title?: string;
  headerShown?: boolean;
  headerStyle?: { backgroundColor?: string };
  headerShadowVisible?: boolean;
  headerTintColor?: string;
  presentation?: 'card' | 'modal' | 'fullScreenModal' | 'transparentModal';
}

interface ScreenOptionsContextValue {
  options: ScreenOptions;
  setOptions: (options: ScreenOptions) => void;
}

const ScreenOptionsContext = createContext<ScreenOptionsContextValue | null>(null);

export function ScreenOptionsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: ScreenOptions;
}) {
  const [overrides, setOverrides] = useState<ScreenOptions>({});
  const initialKey = JSON.stringify(initial);

  // A new route mounts with only its static config; drop the previous screen's overrides.
  useEffect(() => {
    setOverrides({});
  }, [initialKey]);

  const value = useMemo<ScreenOptionsContextValue>(
    () => ({
      options: { ...initial, ...overrides },
      setOptions: setOverrides,
    }),
    [initialKey, overrides] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <ScreenOptionsContext.Provider value={value}>{children}</ScreenOptionsContext.Provider>;
}

export function useScreenOptions(): ScreenOptions {
  return useContext(ScreenOptionsContext)?.options ?? {};
}

/**
 * `<Stack.Screen options={{ title }} />` rendered inside a screen sets that screen's
 * header at runtime, exactly as it did under expo-router.
 */
function StackScreen({ options }: { name?: string; options?: ScreenOptions }) {
  const context = useContext(ScreenOptionsContext);
  const setOptions = context?.setOptions;
  const serialised = JSON.stringify(options ?? {});
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    if (!setOptions || lastApplied.current === serialised) return;
    lastApplied.current = serialised;
    setOptions(JSON.parse(serialised) as ScreenOptions);
  }, [serialised, setOptions]);

  return null;
}

export const Stack = Object.assign(
  function Stack({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  },
  { Screen: StackScreen }
);

/* ------------------------------------------------------------------ Tabs */

export const Tabs = Object.assign(
  function Tabs({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  },
  { Screen: (_props: { name?: string; options?: unknown }) => null }
);

/* ------------------------------------------------------------------ Link */

export function Link({
  href,
  children,
  className,
}: {
  href: Href;
  children?: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const target = resolveHref(href);

  return (
    <a
      href={target}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(target);
      }}
    >
      {children}
    </a>
  );
}

export { resolveHref, stripGroups };
