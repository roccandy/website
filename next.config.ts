import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
