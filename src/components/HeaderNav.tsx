"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ContactUsButton } from "@/components/ContactUsButton";
import HeaderMenu from "@/components/HeaderMenu";

const SHOP_LINKS = [
  { label: "Wedding", href: "/design/wedding-candy" },
  { label: "Text", href: "/design/custom-text-candy" },
  { label: "Branded", href: "/design/branded-logo-candy" },
  { label: "Ready Now", href: "/pre-made-candy" },
] as const;

const PAGE_LINKS = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faqs" },
] as const;

type OpenMenu = "desktop-shop" | "mobile-shop" | "mobile-pages" | null;

type HeaderNavProps = {
  enquiriesEmail: string;
  enquiriesHref: string;
  logoPriority?: boolean;
};

const navLinkClass =
  "inline-flex min-h-10 items-center rounded-md px-2 text-[15px] font-semibold text-[#ff6f95] transition-colors hover:text-[#ff4f80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function HeaderNav({ enquiriesEmail, enquiriesHref, logoPriority = false }: HeaderNavProps) {
  const pathname = usePathname();
  const [menuState, setMenuState] = useState<{ menu: OpenMenu; pathname: string }>({
    menu: null,
    pathname,
  });
  const openMenu = menuState.pathname === pathname ? menuState.menu : null;
  const desktopShopRootRef = useRef<HTMLDivElement>(null);
  const mobileShopRootRef = useRef<HTMLDivElement>(null);
  const mobilePagesRootRef = useRef<HTMLDivElement>(null);
  const desktopShopButtonRef = useRef<HTMLButtonElement>(null);
  const mobileShopButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePagesButtonRef = useRef<HTMLButtonElement>(null);
  const desktopShopId = useId();
  const mobileShopId = useId();
  const mobilePagesId = useId();
  const shopIsActive = SHOP_LINKS.some((link) => isActivePath(pathname, link.href));

  const closeMenus = useCallback(() => setMenuState({ menu: null, pathname }), [pathname]);
  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setMenuState((current) => ({
      menu: current.pathname === pathname && current.menu === menu ? null : menu,
      pathname,
    }));
  };

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const activeRoot =
        openMenu === "desktop-shop"
          ? desktopShopRootRef.current
          : openMenu === "mobile-shop"
            ? mobileShopRootRef.current
            : mobilePagesRootRef.current;
      if (!activeRoot?.contains(event.target as Node)) closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger =
        openMenu === "desktop-shop"
          ? desktopShopButtonRef.current
          : openMenu === "mobile-shop"
            ? mobileShopButtonRef.current
            : mobilePagesButtonRef.current;
      closeMenus();
      trigger?.focus();
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenus, openMenu]);

  const renderShopLinks = (mobile = false) => (
    <div className={mobile ? "grid grid-cols-2 gap-1" : "space-y-1"}>
      {SHOP_LINKS.map((link) => {
        const active = isActivePath(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            onClick={closeMenus}
            className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] ${
              active
                ? "bg-[#fff0f5] text-[#e94f7d]"
                : "text-zinc-700 hover:bg-[#fff7f9] hover:text-[#ff4f80]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="site-header-row flex items-center">
      <Link
        href="/"
        aria-label="Roc Candy home"
        className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
      >
        <Image
          src="/branding/logo-gold.svg"
          alt="Roc Candy"
          width={124}
          height={124}
          className="h-10 w-10 lg:h-14 lg:w-14"
          priority={logoPriority}
        />
      </Link>

      <nav aria-label="Primary navigation" className="ml-4 hidden flex-1 items-center gap-3 lg:flex xl:ml-6 xl:gap-5">
        <div ref={desktopShopRootRef} className="relative">
          <button
            ref={desktopShopButtonRef}
            type="button"
            aria-expanded={openMenu === "desktop-shop"}
            aria-controls={desktopShopId}
            onClick={() => toggleMenu("desktop-shop")}
            className={`${navLinkClass} gap-1 ${shopIsActive ? "text-[#e94f7d]" : ""}`}
          >
            Shop
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openMenu === "desktop-shop" ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          <div
            id={desktopShopId}
            hidden={openMenu !== "desktop-shop"}
            className="absolute left-0 top-full z-[80] mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl"
          >
            {renderShopLinks()}
          </div>
        </div>

        {PAGE_LINKS.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`${navLinkClass} ${active ? "text-[#e94f7d]" : ""}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div ref={mobileShopRootRef} className="static ml-auto lg:hidden">
        <button
          ref={mobileShopButtonRef}
          type="button"
          aria-expanded={openMenu === "mobile-shop"}
          aria-controls={mobileShopId}
          onClick={() => toggleMenu("mobile-shop")}
          className={`inline-flex h-10 items-center gap-0.5 rounded-md px-1.5 text-[13px] font-semibold transition-colors hover:text-[#ff4f80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] sm:px-2 sm:text-sm ${
            shopIsActive ? "text-[#e94f7d]" : "text-[#ff6f95]"
          }`}
        >
          Shop
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${openMenu === "mobile-shop" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div
          id={mobileShopId}
          hidden={openMenu !== "mobile-shop"}
          className="absolute left-3 top-full z-[80] mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl sm:left-4"
        >
          {renderShopLinks()}
        </div>
      </div>

      <div className="site-header-actions flex shrink-0 items-center">
        <ContactUsButton
          email={enquiriesEmail}
          emailHref={enquiriesHref}
          mobileIconOnly
        />
        <HeaderMenu />
        <div ref={mobilePagesRootRef} className="relative lg:hidden">
          <button
            ref={mobilePagesButtonRef}
            type="button"
            aria-label={openMenu === "mobile-pages" ? "Close site menu" : "Open site menu"}
            aria-expanded={openMenu === "mobile-pages"}
            aria-controls={mobilePagesId}
            onClick={() => toggleMenu("mobile-pages")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#ff6f95] transition-colors hover:bg-[#fff4f7] hover:text-[#ff4f80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95]"
          >
            {openMenu === "mobile-pages" ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
          <nav
            id={mobilePagesId}
            aria-label="Mobile navigation"
            hidden={openMenu !== "mobile-pages"}
            className="absolute right-0 top-full z-[80] mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl"
          >
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              onClick={closeMenus}
              className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] ${
                pathname === "/"
                  ? "bg-[#fff0f5] text-[#e94f7d]"
                  : "text-zinc-700 hover:bg-[#fff7f9] hover:text-[#ff4f80]"
              }`}
            >
              Home
            </Link>
            <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Shop
            </p>
            {renderShopLinks(true)}
            <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Explore
            </p>
            <div className="grid grid-cols-2 gap-1">
              {[...PAGE_LINKS, { label: "Contact", href: "/contact" }].map((link) => {
                const active = isActivePath(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={closeMenus}
                    className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6f95] ${
                      active
                        ? "bg-[#fff0f5] text-[#e94f7d]"
                        : "text-zinc-700 hover:bg-[#fff7f9] hover:text-[#ff4f80]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
