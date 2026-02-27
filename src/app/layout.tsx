import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import MobileHeaderShrinkOnScroll from "@/components/MobileHeaderShrinkOnScroll";

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

export const metadata: Metadata = {
  title: "Roc Candy",
  description: "Roc Candy storefront and admin workspace.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable} antialiased`}
      >
        <MobileHeaderShrinkOnScroll />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
