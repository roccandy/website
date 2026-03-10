import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { CartProvider } from "@/components/CartProvider";
import { JsonLd } from "@/components/JsonLd";
import MobileHeaderShrinkOnScroll from "@/components/MobileHeaderShrinkOnScroll";
import SiteFooter from "@/components/SiteFooter";
import {
  buildMetadata,
  buildOrganizationSchema,
  buildSchemaGraph,
  buildSearchConsoleVerification,
  buildWebsiteSchema,
  getSiteBaseMetadata,
} from "@/lib/seo";

const headingFont = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Open_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const { baseUrl } = getSiteBaseMetadata();

export const metadata: Metadata = {
  ...buildMetadata(),
  metadataBase: new URL(baseUrl),
  manifest: "/manifest.webmanifest",
  verification: buildSearchConsoleVerification(),
  icons: {
    icon: [
      { url: "/branding/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/branding/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/branding/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff6f95",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();

  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <Analytics />
        <JsonLd
          data={buildSchemaGraph([
            buildOrganizationSchema(),
            buildWebsiteSchema(),
          ])}
        />
        <MobileHeaderShrinkOnScroll />
        <CartProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
