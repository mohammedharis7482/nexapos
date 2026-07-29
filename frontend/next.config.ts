import type { NextConfig } from "next";
import path from "node:path";

export const compatibilityRedirects = [
  { source: "/shift", destination: "/sales/shifts/current", permanent: false },
  { source: "/current-shift", destination: "/sales/shifts/current", permanent: false },
  { source: "/shifts", destination: "/sales/shifts", permanent: false },
  { source: "/team", destination: "/settings/team", permanent: false },
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [...compatibilityRedirects];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
