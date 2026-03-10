import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roc Candy",
    short_name: "Roc Candy",
    description:
      "Handmade personalised rock candy for weddings, branded events, gifts, and celebrations across Australia.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff6f95",
    icons: [
      {
        src: "/branding/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/branding/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/branding/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/branding/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
