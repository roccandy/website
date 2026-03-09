import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    const staticAssetHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];

    return [
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
    ];
  },
};

export default nextConfig;
