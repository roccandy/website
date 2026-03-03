import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import { AddPremadeToCartButton } from "@/components/AddPremadeToCartButton";
import { getPremadeCandies } from "@/lib/data";
import {
  buildPremadeImageUrl,
  buildPremadeItemPath,
  formatPremadeFlavors,
  formatPremadeMoney,
  formatPremadeWeight,
} from "@/lib/premadeCatalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PremadePage() {
  const candies = await getPremadeCandies();
  const visible = candies.filter((item) => item.is_active);
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;

  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]">
          <LandingTopLinksBar />
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <a href="/" className="shrink-0">
                <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-20 md:h-24" data-header-logo />
              </a>
              <HeaderNav />
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={enquiriesHref}
                  aria-label="Email Roc Candy"
                  className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Zm2.32-.25 5.21 3.55c.28.19.65.19.93 0l5.22-3.55a1.25 1.25 0 0 0-.43-.08H6.75c-.15 0-.3.03-.43.08Zm12.18 1.7-5.35 3.64a2.25 2.25 0 0 1-2.5 0L5.5 8.2v9.05c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.2Z"
                    />
                  </svg>
                </a>
                <a
                  href="tel:0414519211"
                  aria-label="Call Roc Candy"
                  className="inline-flex items-center justify-center text-[#ff6f95] transition-colors hover:text-[#ff4f80]"
                >
                  <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7.1 3.5c.32 0 .62.15.82.41l2.12 2.75c.27.36.28.85.01 1.21l-1.4 1.86a12.5 12.5 0 0 0 5.72 5.72l1.86-1.4c.36-.27.85-.26 1.21.01l2.75 2.12c.26.2.41.5.41.82v1.33c0 .65-.46 1.2-1.09 1.31-1.2.21-2.4.32-3.6.32-6.5 0-11.78-5.28-11.78-11.78 0-1.2.11-2.4.32-3.6.11-.63.66-1.09 1.31-1.09H7.1Z"
                    />
                  </svg>
                </a>
                <HeaderMenu />
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl space-y-10 px-6 py-10 md:py-14">
          <section className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Shop</p>
            <h1 className="normal-case text-[45px] font-medium tracking-tight text-[rgb(146,146,177)]">Pre-made candy</h1>
            <p className="text-base text-zinc-600">
              Ready-to-order packs with handcrafted rock candy. Contact us to place an order.
            </p>
          </section>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6 text-center text-sm text-zinc-600 shadow-sm">
              Pre-made items are being stocked. Check back soon.
            </div>
          ) : (
            <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {visible.map((item) => {
                const imageUrl = buildPremadeImageUrl(item.image_path);
                const weightLabel = formatPremadeWeight(Number(item.weight_g));
                const titleLine = weightLabel ? `${weightLabel} ${item.name}` : item.name;
                const flavorLabel = formatPremadeFlavors(item.flavors ?? null);
                const itemHref = buildPremadeItemPath(item);
                return (
                  <article
                    key={item.id}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-sm"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                      {item.great_value ? (
                        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-[#ff6f95] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Discounted
                        </span>
                      ) : null}
                      {imageUrl ? (
                        <a href={itemHref} aria-label={`View ${item.name}`}>
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                            loading="lazy"
                          />
                        </a>
                      ) : null}
                      <AddPremadeToCartButton
                        className="absolute right-2 top-2"
                        item={{
                          premadeId: item.id,
                          name: item.name,
                          price: Number(item.price),
                          weight_g: Number(item.weight_g),
                          imageUrl,
                        }}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 px-4 py-3 text-center">
                      <a href={itemHref} className="text-sm font-bold text-[#ff6f95] hover:text-[#ff4f80] hover:underline">
                        {titleLine}
                      </a>
                      <p className="text-xl font-semibold text-zinc-900">{formatPremadeMoney(Number(item.price))}</p>
                      {flavorLabel ? <p className="text-sm text-zinc-500">{flavorLabel}</p> : null}
                      {item.description ? <p className="text-sm text-zinc-500">{item.description}</p> : null}
                      {item.approx_pcs ? (
                        <p className="text-sm text-zinc-500">Approx {item.approx_pcs} pcs</p>
                      ) : null}
                      <p className="text-sm font-semibold text-zinc-500">Free Shipping Australia Wide</p>
                      <a
                        href={itemHref}
                        className="mt-1 inline-block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-800"
                      >
                        View product page
                      </a>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
