import HeaderNav from "@/components/HeaderNav";
import HeaderMenu from "@/components/HeaderMenu";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AboutPage() {
  const enquiriesEmail = process.env.ENQUIRIES_EMAIL?.trim() || "admin@roccandy.com.au";
  const enquiriesHref = `mailto:${enquiriesEmail}`;

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <div className="relative">
        <div className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/90 backdrop-blur shadow-[0_4px_10px_rgba(63,63,70,0.36)]">
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

        <div className="mx-auto max-w-4xl space-y-6 px-6 py-10 md:py-14">
          <h1 className="normal-case text-4xl font-semibold text-zinc-700 md:text-5xl">A Little About Us</h1>

          <p className="normal-case text-2xl font-semibold leading-tight text-[#ff6f95] md:text-3xl">
            Welcome to Roc Candy - Your Source for Exquisite Handmade Personalised Candy!
          </p>

          <p className="normal-case text-lg font-medium text-zinc-700">
            Established in 1999 we have been creating for all occasions: Corporate functions, weddings, birthdays,
            christenings, and 'special event' days such as NAIDOC, Pride, Idahobit, R U OK? to name a few.
          </p>

          <div className="space-y-5 text-base leading-relaxed text-zinc-700">
            <p>
              At Roc Candy, we believe in the power of sweetness and the joy it brings to people's lives in a visual
              and tasty way. Our passion for crafting delectable handmade candies is matched only by our dedication to
              creating personalised treats that are as unique as the individuals who savor them.
            </p>

            <p>
              With our roots deeply embedded in the art of traditional candy-making, Roc Candy has evolved into a
              modern confectionery brand, combining time-honored techniques with innovative flavors and custom
              designs, we are here to make your celebrations truly unforgettable.
            </p>

            <p>
              What sets Roc Candy apart is our commitment to quality. We handcraft each and every piece of candy with
              meticulous attention to detail, using only the finest ingredients sourced from trusted suppliers of which
              98% is Australian. Every step of our candy-making process is carefully executed to ensure that every
              bite delivers an explosion of flavor and a delightful experience.
            </p>

            <p>
              Our personalised candy creations are a true testament to the limitless possibilities of customization.
              With Roc Candy, you have the freedom to design your own candy, tailored to match your unique style and
              event theme. Choose from an array of vibrant colors, enticing flavors, and captivating shapes to create
              a candy masterpiece that will leave a lasting impression on your guests. We will also match your colour
              theme or logo colours as close to as possible.
            </p>

            <p>
              Whether you're looking for elegant wedding favors, eye-catching promotional items, or simply a sweet
              treat to brighten someone's day, Roc Candy has got you covered. Our candies are not only a feast for the
              taste buds but also a feast for the eyes, designed to captivate and delight. We take pride in our
              ability to turn ordinary candies into extraordinary creations, infused with the essence of your vision
              and personality.
            </p>

            <p>
              At Roc Candy, we understand that customer satisfaction is the cornerstone of our success. We strive to
              provide exceptional service, from the moment you visit our user-friendly website to the prompt delivery
              of your custom-made candies. With our seamless ordering process, you can easily navigate through our
              extensive range of options, select your preferences, and watch as we bring your candy dreams to life. We
              also understand that sometimes events come up quickly so please ask us about our Urgent Order process and
              how we can accommodate. We believe in personal customer service with efficiency to deliver a high end
              product.
            </p>

            <p>
              We ship Australia-wide, delivering our delicious rock candy to all major cities, including Sydney,
              Melbourne, Brisbane, Perth, Adelaide, and beyond!
            </p>

            <p>
              Join us on this mouthwatering journey and indulge in the magic of personalised handmade candy. Discover
              the sweetness that sets Roc Candy apart and make your next celebration an extraordinary affair. Check out
              our{" "}
              <a href="/design?type=weddings" className="font-semibold text-[#ff6f95] hover:text-[#ff4f80]">
                Wedding candy designer
              </a>{" "}
              or{" "}
              <a href="/design?type=text" className="font-semibold text-[#ff6f95] hover:text-[#ff4f80]">
                Text candy designer
              </a>{" "}
              and let the confectionery adventure begin!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
