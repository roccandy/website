"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useOptimistic,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { AdminPageSkeleton } from "./AdminPageSkeleton";

type NavigationContext = {
  destination: string | null;
  navigate: (
    href: string,
    options?: { replace?: boolean; scroll?: boolean },
  ) => void;
};
const Context = createContext<NavigationContext | null>(null);

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [destination, setDestination] = useOptimistic<string | null>(null);

  const navigate: NavigationContext["navigate"] = (href, options) => {
    if (destination === href) return;
    startTransition(() => {
      setDestination(href);
      if (options?.replace) router.replace(href, { scroll: options.scroll });
      else router.push(href, { scroll: options?.scroll });
    });
  };

  return (
    <Context.Provider value={{ destination, navigate }}>
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
  return (
    <Link
      {...props}
      href={href}
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
