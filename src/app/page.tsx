import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import AutoplayOnViewVideo from "@/components/AutoplayOnViewVideo";
import ProductionBlockoutBanner from "@/components/ProductionBlockoutBanner";
import { JsonLd } from "@/components/JsonLd";
import { buildMetadata, buildSchemaGraph, buildWebPageSchema } from "@/lib/seo";
import { DesignCtaModal } from "./DesignCtaModal";
import { Montserrat } from "next/font/google";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = buildMetadata({
  title: "Personalised Rock Candy Australia | Wedding, Branded & Custom Candy",
  description:
    "Personalised handmade rock candy for weddings, branded events, custom text gifts, and celebrations across Australia. Vegan, gluten free, dairy free, and delivered Australia wide.",
  path: "/",
  imagePath: "/landing/home-feature-poster.png",
  imageAlt: "Roc Candy personalised rock candy",
});

const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["300"],
});

const FEATURE_LABELS = ["Vegan", "Gluten Free", "Dairy Free", "Handmade", "Aust Made", "Free Delivery"];
const LANDING_LINKS = [
  { label: "Wedding Candy", href: "/design/wedding-candy" },
  { label: "Branded Logo Candy", href: "/design/branded-logo-candy" },
  { label: "Custom Text Candy", href: "/design/custom-text-candy" },
];
const CANDY_OPTIONS = [
  { label: "Branded", href: "/design?type=branded", image: "/quote/subtypes/branded.jpg" },
  { label: "Both Names", href: "/design?type=weddings&subtype=weddings-both-names", image: "/quote/subtypes/weddings-both-names.jpg" },
  { label: "Initials", href: "/design?type=weddings&subtype=weddings-initials", image: "/quote/subtypes/weddings-initials.jpg" },
  { label: "Custom Text 1-6 Letters", href: "/design?type=text&subtype=custom-1-6", image: "/quote/subtypes/custom-1-6.jpg" },
  { label: "Custom Text 7-14 Letters", href: "/design?type=text&subtype=custom-7-14", image: "/quote/subtypes/custom-7-14.jpeg" },
  { label: "Pre-made candy", href: "/pre-made-candy", image: "/quote/subtypes/premade.jpg" },
];

export default async function Home() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;
  return (
    <main className="min-h-screen text-zinc-900">
      <JsonLd
        data={buildSchemaGraph([
          buildWebPageSchema({
            path: "/",
            name: "Personalised Rock Candy Australia",
            description:
              "Handmade personalised rock candy for weddings, branded events, custom text gifts, and celebrations across Australia.",
          }),
        ])}
      />
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_4px_10px_rgba(63,63,70,0.36)]">
          <LandingTopLinksBar />
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="shrink-0">
                <img src="/branding/logo-gold.svg" alt="Roc Candy" className="h-20 md:h-24" data-header-logo />
              </Link>
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

        <div className="landing-bg -mt-8 pt-8">
          <div className="relative mx-auto max-w-6xl space-y-20 px-6 py-10 md:py-14">

          <section className="grid items-center gap-20 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h1
                  className={`${montserratLight.className} mb-4 normal-case text-[64px] font-light leading-tight tracking-tight text-[rgb(114,112,111)]`}
                >
                  Personalised Rock Candy
                </h1>
                <ProductionBlockoutBanner />
                <h2 className="normal-case text-[28px] font-medium leading-tight text-[rgb(130,130,140)]">
                  Branded, Wedding and Text Lollies
                </h2>
                <p className="text-xl font-medium text-[rgb(130,130,140)]">Artisan Handmade Candy</p>
              </div>

              <div className="flex justify-center">
                <div className="inline-flex rounded-full border border-white/45 bg-white/45 px-4 py-2 text-center text-xs font-medium tracking-[0.08em] text-zinc-500 shadow-sm backdrop-blur">
                  <span className="hidden sm:inline">{FEATURE_LABELS.join(" | ")}</span>
                  <span className="sm:hidden">
                    {FEATURE_LABELS.slice(0, 3).join(" | ")}
                    <br />
                    {FEATURE_LABELS.slice(3).join(" | ")}
                  </span>
                </div>
              </div>

              <div id="design" className="pt-6">
                <DesignCtaModal />
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {LANDING_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full border border-zinc-200 bg-white/80 px-4 py-2 text-xs font-semibold text-[#ff6f95] shadow-sm transition hover:border-zinc-300 hover:text-[#ff4f80]"
                    >
                      Learn about {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {CANDY_OPTIONS.map((option) => (
                <Link
                  key={option.label}
                  href={option.href}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
                >
                  <div className="relative aspect-[3/2] w-full overflow-hidden bg-zinc-100">
                    <img
                      src={option.image}
                      alt={option.label}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-white/90" />
                  </div>
                  <div className="px-2 py-2 text-xs font-semibold text-[rgb(114,112,111)]">{option.label}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <AutoplayOnViewVideo
                src="/landing/home-feature-fast.mp4"
                poster="/landing/home-feature-poster.png"
                className="h-full w-full object-cover"
              />
            </div>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
              <p className="normal-case text-3xl font-semibold tracking-tight text-[rgb(114,112,111)]">
                Custom Rock Candy
              </p>
              <p className="mt-4 normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
                At Roc Candy, we believe every sweet moment deserves a personalised touch. Whether you&apos;re planning a
                wedding, launching a product, or simply want to treat someone special, our handcrafted rock candy is
                made to impress. From{" "}
                <Link href="/design/wedding-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  wedding candy
                </Link>{" "}
                tailored to your big day, to{" "}
                <Link href="/design/custom-text-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  custom text candy
                </Link>{" "}
                that celebrates life&apos;s milestones, we turn your words and designs into delicious works of art -
                all made with premium ingredients right here in Australia. Explore our full range, including{" "}
                <Link href="/design/branded-logo-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  branded candy
                </Link>{" "}
                that showcases your logo in every bite, and our colourful selection of{" "}
                <Link href="/pre-made-candy" className="text-[#ff6f95] underline-offset-2 hover:text-[#ff4f80] hover:underline">
                  pre-made candy
                </Link>{" "}
                ready to enjoy anytime. Whether it&apos;s for a party, corporate gift, or just because, Roc Candy
                makes every occasion a little sweeter.
              </p>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
              <p className="normal-case text-3xl font-semibold tracking-tight text-[rgb(114,112,111)]">
                A little about us
              </p>
              <p className="mt-4 normal-case text-[13px] leading-relaxed text-zinc-600 md:text-[14px]">
                We are very happy Australian artisan confectioners specialising in personalised and custom handmade
                rock candies for all types of occasions. Established in 1999, our rock candy treats are vegan,
                gluten-free and dairy-free. Each piece of candy is meticulously handcrafted with the finest
                ingredients, sourced from trusted suppliers, 98% of which are Australian. We offer Free Delivery
                Australia-wide, delivering our delicious rock candy to all major cities, including Sydney, Melbourne,
                Brisbane, Perth, Adelaide, Canberra and Hobart.
              </p>
            </article>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <img
                src="/about-carousel/about-1.jpg"
                alt="Handmade Roc Candy pieces"
                className="h-full min-h-[300px] w-full object-cover"
                loading="lazy"
              />
            </div>
          </section>

          <section id="contact" className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="grid gap-6 md:grid-cols-[1.1fr,0.9fr] md:items-center">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Contact</p>
                <h2 className="text-2xl font-semibold">Tell us about your event or brand</h2>
                <p className="text-sm text-white/80">
                  We will help with timeline, color selection, and delivery planning. Email us or call to lock in a
                  production slot.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/60">Email</p>
                  <a href={enquiriesHref} className="font-semibold">
                    {enquiriesEmail}
                  </a>
                </div>
                <div>
                  <p className="text-white/60">Phone</p>
                  <p className="font-semibold">0414 519 211</p>
                </div>
                <div>
                  <p className="text-white/60">Location</p>
                  <p className="font-semibold">Australia wide delivery</p>
                </div>
              </div>
            </div>
          </section>

          <section id="blog" className="scroll-mt-44 space-y-6 pb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Blog</p>
              <h2 className="text-2xl font-semibold text-zinc-900">Latest from Roc Candy</h2>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Blog posts are coming soon. We will share new launches, wedding ideas, and behind-the-scenes candy
              stories here.
            </div>
          </section>
          </div>
        </div>
      </div>
    </main>
  );
}
