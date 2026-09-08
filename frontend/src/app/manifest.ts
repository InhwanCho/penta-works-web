import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PENTA WORKS",
    short_name: "PENTA",
    description: "PENTA WORKS 서비스",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#3f4e73",
    theme_color: "#3f4e73",
    icons: [
      {
        src: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
