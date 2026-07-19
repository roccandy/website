import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = (() => {
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return null;
  }
})();
const supabaseRemotePattern = (() => {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    return {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  compress: true,
  allowedDevOrigins: ["192.168.86.49"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseRemotePattern ? [supabaseRemotePattern] : [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
  async headers() {
    const checkoutContentSecurityPolicy = [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline'",
        process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://www.paypalobjects.com",
        "https://www.googletagmanager.com",
        "https://www.googleadservices.com",
        "https://googleads.g.doubleclick.net",
        "https://va.vercel-scripts.com",
      ]
        .filter(Boolean)
        .join(" "),
      [
        "connect-src 'self'",
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://pci-connect.squareup.com",
        "https://pci-connect.squareupsandbox.com",
        "https://o160250.ingest.sentry.io",
        "https://*.paypal.com",
        "https://*.paypalobjects.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://region1.google-analytics.com",
        "https://*.doubleclick.net",
        "https://va.vercel-scripts.com",
        supabaseOrigin ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      [
        "frame-src 'self'",
        "https://web.squarecdn.com",
        "https://sandbox.web.squarecdn.com",
        "https://*.paypal.com",
        "https://*.google.com",
        "https://*.doubleclick.net",
      ].join(" "),
      "style-src 'self' 'unsafe-inline' https://web.squarecdn.com https://sandbox.web.squarecdn.com",
      "font-src 'self' data: https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
      "img-src 'self' data: blob: https:",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self' https://*.paypal.com",
      "frame-ancestors 'none'",
    ].join("; ");
    const staticAssetHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/checkout/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: checkoutContentSecurityPolicy,
          },
        ],
      },
      {
        source: "/landing/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/about-carousel/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/branding/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/payment-logos/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/quote/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/flavours/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/labels/:path*",
        headers: staticAssetHeaders,
      },
      {
        source: "/favicon.ico",
        headers: staticAssetHeaders,
      },
    ];
  },
};

export default nextConfig;
