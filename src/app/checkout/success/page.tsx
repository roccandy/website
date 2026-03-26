import PublicSiteHeader from "@/components/PublicSiteHeader";
import type { Metadata } from "next";
import { CheckoutSuccessClient } from "./CheckoutSuccessClient";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Order Confirmed | Roc Candy",
};

export default function CheckoutSuccessPage() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "enquiries@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;

  return (
    <main className="landing-bg min-h-screen text-zinc-900">
      <div className="relative">
        <PublicSiteHeader
          enquiriesHref={enquiriesHref}
          className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_8px_18px_rgba(113,113,122,0.28)]"
        />

        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <CheckoutSuccessClient />
        </div>
      </div>
    </main>
  );
}
