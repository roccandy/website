import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";
import LandingTopLinksBar from "@/components/LandingTopLinksBar";
import { DesignCtaModal } from "./DesignCtaModal";
import { Montserrat } from "next/font/google";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const montserratLight = Montserrat({
  subsets: ["latin"],
  weight: ["300"],
});

const FEATURE_LABELS = ["Vegan", "Gluten Free", "Dairy Free", "Handmade", "Aust Made", "Free Delivery"];
const CANDY_OPTIONS = [
  { label: "Branded", href: "/design?type=branded", image: "/quote/subtypes/branded.jpg" },
  { label: "Both Names", href: "/design?type=weddings&subtype=weddings-both-names", image: "/quote/subtypes/weddings-both-names.jpg" },
  { label: "Initials", href: "/design?type=weddings&subtype=weddings-initials", image: "/quote/subtypes/weddings-initials.jpg" },
  { label: "Custom Text 1-6 Letters", href: "/design?type=text&subtype=custom-1-6", image: "/quote/subtypes/custom-1-6.jpg" },
  { label: "Custom Text 7-14 Letters", href: "/design?type=text&subtype=custom-7-14", image: "/quote/subtypes/custom-7-14.jpeg" },
  { label: "Pre-made candy", href: "/pre-made-candy", image: "/quote/subtypes/premade.jpg" },
];
const FAQS = [
  {
    question: "How far in advance should I order?",
    answer: "We recommend ordering at least two weeks ahead for events so we can confirm artwork, flavors, and delivery.",
  },
  {
    question: "Can I mix flavors in one order?",
    answer: "Yes. You can select multiple flavors and we will balance quantities to match your packaging choice.",
  },
  {
    question: "Do you provide samples?",
    answer: "We can arrange sample packs for branding approvals. Contact us with your dates and quantities.",
  },
];

export default async function Home() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "admin@roccandy.com.au";
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

        <div className="relative mx-auto max-w-6xl space-y-20 px-6 py-10 md:py-14">

          <section className="grid items-center gap-10 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h1
                  className={`${montserratLight.className} normal-case text-[64px] font-light leading-tight tracking-tight text-zinc-500`}
                >
                  Personalised Rock Candy
                </h1>
                <h2 className="normal-case text-[28px] font-medium leading-tight text-zinc-400">
                  Branded, Wedding and Text Lollies
                </h2>
                <p className="text-xl font-medium text-zinc-400">Artisan Handmade Candy</p>
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

              <div id="design" className="pt-2">
                <DesignCtaModal />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {CANDY_OPTIONS.map((option) => (
                <a
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
                  </div>
                  <div className="px-2 py-2 text-xs font-semibold text-zinc-900">{option.label}</div>
                </a>
              ))}
            </div>
          </section>

          <section
            id="about"
            className="scroll-mt-44 grid gap-6 rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-md md:grid-cols-[1fr,1.1fr]"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">About</p>
              <h2 className="text-2xl font-semibold text-zinc-900">
                Handcrafted rock candy with a modern twist.
              </h2>
            </div>
            <div className="space-y-3 text-sm text-zinc-600">
              <p>
                Roc Candy crafts artisian rock candy in Australia using traditional techniques with modern flavor
                and design. Every batch is made to order so your colors, names, and branding stay crisp.
              </p>
              <p>
                From weddings and events to corporate gifting, we partner with you on color palettes, packaging,
                and delivery timing so your candy arrives ready to impress.
              </p>
            </div>
          </section>

          <section id="faq" className="scroll-mt-44 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">FAQs</p>
                <h2 className="text-2xl font-semibold text-zinc-900">Questions we hear every week</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {FAQS.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-900">{faq.question}</p>
                  <p className="mt-2 text-sm text-zinc-600">{faq.answer}</p>
                </div>
              ))}
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
    </main>
  );
}
