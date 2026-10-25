"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useOptimistic,
  useTransition,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import { AdminPageSkeleton } from "./AdminPageSkeleton";
import { adminTabKey, cleanAdminLocation, isAdminReadView,isAdminWriteForm } from "./adminRoutePolicy";

type NavigationContext = {
  tabHref: (href: string) => string;
  destination: string | null;
  navigate: (
    href: string,
    options?: { replace?: boolean; scroll?: boolean },
  ) => void;
};
const Context = createContext<NavigationContext | null>(null);
const emptyLocations: Record<string,string> = {};
let rememberedLocations: Record<string,string> = emptyLocations;
const locationListeners = new Set<() => void>();
const subscribeLocations = (listener: () => void) => { locationListeners.add(listener); return () => { locationListeners.delete(listener); }; };

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [destination, setDestination] = useOptimistic<string | null>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const locations = useSyncExternalStore(subscribeLocations, () => rememberedLocations, () => emptyLocations);
  useEffect(() => {
    const location = cleanAdminLocation(`${pathname}?${search}`);
    const key = adminTabKey(location);
    if (key && isAdminReadView(location) && rememberedLocations[key] !== location) {
      rememberedLocations = { ...rememberedLocations, [key]: location };
      locationListeners.forEach(listener => listener());
    }
  }, [pathname, search]);
  useEffect(() => {
    const clear = () => { rememberedLocations = emptyLocations; locationListeners.forEach(listener => listener()); };
    window.addEventListener("admin:session-ended", clear);
    return () => window.removeEventListener("admin:session-ended", clear);
  }, []);

  const navigate: NavigationContext["navigate"] = (href, options) => {
    if (destination === href) return;
    const proceed = () => startTransition(() => {
      setDestination(href);
      if (options?.replace) router.replace(href, { scroll: options.scroll });
      else router.push(href, { scroll: options?.scroll });
    });
    if (typeof window !== "undefined" && !window.dispatchEvent(new CustomEvent("admin:before-navigation", { cancelable: true, detail: { proceed } }))) return;
    proceed();
  };

  // GET forms should use the same client navigation as links, not reload the
  // document and throw away every warmed tab. POST/save forms remain untouched.
  useEffect(() => {
    const submit = (event: SubmitEvent) => {
      const form = event.target;
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get" || (form.target && form.target !== "_self")) return;
      if(isAdminWriteForm(form.method,form.getAttribute("action"),Boolean(form.querySelector('input[name^="$ACTION_"]')))) return;
      const url = new URL(form.action, window.location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/admin")) return;
      const fields = new FormData(form, event.submitter);
      url.search = new URLSearchParams([...fields].filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString();
      event.preventDefault();
      navigate(`${url.pathname}${url.search}`);
    };
    document.addEventListener("submit", submit);
    return () => document.removeEventListener("submit", submit);
  });

  return (
    <Context.Provider value={{ destination, navigate, tabHref: href => locations[adminTabKey(href) || ""] || href }}>
      {children}
    </Context.Provider>
  );
}

export function useAdminNavigation() {
  return useContext(Context);
}

/** Preserve native link/new-tab behaviour, and acknowledge same-tab admin navigation immediately. */
export function AdminLink({
  href,
  onNavigate,
  replace,
  scroll,
  ...props
}: ComponentProps<typeof Link>) {
  const navigation = useAdminNavigation();
  const [intent, setIntent] = useState(false);
  const readView = typeof href === "string" && isAdminReadView(href);
  return (
    <Link
      {...props}
      href={href}
      prefetch={props.prefetch ?? (readView && intent)}
      onMouseEnter={event => { props.onMouseEnter?.(event); setIntent(true); }}
      onFocus={event => { props.onFocus?.(event); setIntent(true); }}
      onTouchStart={event => { props.onTouchStart?.(event); setIntent(true); }}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({
          preventDefault: () => {
            cancelled = true;
            event.preventDefault();
          },
        });
        if (cancelled || !navigation || typeof href !== "string") return;
        const next = new URL(href, window.location.href);
        if (
          next.origin !== window.location.origin ||
          !/^\/admin(?:\/|$)/.test(next.pathname)
        )
          return;
        if (
          next.pathname === window.location.pathname &&
          next.search === window.location.search
        ) {
          // Re-clicking the current page must not restart a pending page load.
          // Fragment links still use normal scrolling behaviour.
          if (!next.hash) event.preventDefault();
          return;
        }
        event.preventDefault();
        navigation.navigate(`${next.pathname}${next.search}${next.hash}`, {
          replace,
          scroll,
        });
      }}
    />
  );
}

/** Main/all-tools tabs return to their last view; filter/clear links stay exact. */
export function AdminTabLink({ href, eager = false, ...props }: ComponentProps<typeof Link> & { eager?: boolean }) {
  const navigation = useAdminNavigation();
  const destination = typeof href === "string" ? navigation?.tabHref(href) || href : href;
  const eagerRead = eager && typeof destination === "string" && isAdminReadView(destination);
  return <AdminLink {...props} href={destination} prefetch={props.prefetch ?? (eagerRead ? true : undefined)} />;
}

export function AdminPageContent({ children }: { children: ReactNode }) {
  const navigation = useAdminNavigation();
  const destination = navigation?.destination;
  return (
    <div>
      {destination && (
        <AdminPageSkeleton pathname={destination.split(/[?#]/)[0]} />
      )}
      <div hidden={Boolean(destination)} aria-busy={Boolean(destination)}>
        {children}
      </div>
    </div>
  );
}

export function AdminOrderSearch() {
  const navigation = useAdminNavigation();
  const opening =
    navigation?.destination?.startsWith("/admin/orders/archived?") ?? false;
  return (
    <form
      action="/admin/orders/archived"
      method="get"
      className="hidden items-center lg:flex"
      onSubmit={(event) => {
        if (!navigation) return;
        event.preventDefault();
        const query =
          new FormData(event.currentTarget).get("q")?.toString().trim() ?? "";
        navigation.navigate(
          `/admin/orders/archived?${new URLSearchParams({ q: query })}`,
        );
      }}
    >
      <label className="sr-only" htmlFor="admin-header-order-search">
        Search orders
      </label>
      <input
        id="admin-header-order-search"
        type="search"
        name="q"
        placeholder="Search orders"
        className="w-36 rounded-l-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none lg:w-44"
      />
      <button
        type="submit"
        disabled={opening}
        className="rounded-r-md border border-l-0 border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60"
      >
        {opening ? "Opening…" : "Search"}
      </button>
    </form>
  );
}
