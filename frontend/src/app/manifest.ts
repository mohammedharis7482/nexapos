import type { MetadataRoute } from "next";

/**
 * Web app manifest - installability only.
 *
 * Deliberately no service worker and no caching (see
 * `docs/planned-features.md`). A POS that quietly shows an hours-old price or
 * stock figure is worse than one that plainly reports no connection, so this
 * feature adds a home-screen launcher and nothing else. Installed and browser
 * sessions hit the network identically.
 *
 * Android/Chrome installability needs the 192 and 512 pair; the maskable
 * variant carries extra safe-zone padding so an adaptive mask cannot clip the
 * mark. iOS ignores these entirely and uses `app/apple-icon.png` (180).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NexaPOS",
    short_name: "NexaPOS",
    description: "Secure grocery shop point of sale for Qatar.",
    start_url: "/billing",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // --background and --brand-600 from globals.css.
    background_color: "#f5f7fa",
    theme_color: "#2563eb",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
