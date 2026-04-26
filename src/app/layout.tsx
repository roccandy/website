import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { JsonLd } from "@/components/JsonLd";
import MobileHeaderShrinkOnScroll from "@/components/MobileHeaderShrinkOnScroll";
import ConditionalSiteFooter from "@/components/ConditionalSiteFooter";
import { SPACING_STYLE_VARS } from "@/lib/spacing";
import { TYPOGRAPHY_STYLE_VARS } from "@/lib/typography";
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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/branding/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/branding/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
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
      <head>
        {gtmId ? (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        ) : null}
      </head>
      <body
        style={{ ...TYPOGRAPHY_STYLE_VARS, ...SPACING_STYLE_VARS }}
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
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <ConditionalSiteFooter />
        </div>
      </body>
    </html>
  );
}
