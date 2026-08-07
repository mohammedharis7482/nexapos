import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/providers/auth-provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NexaPOS",
    template: "%s | NexaPOS",
  },
  description: "Secure grocery shop point of sale for Qatar.",
  // iOS does not read the manifest for home-screen installs; these are what
  // make "Add to Home Screen" launch without Safari's chrome.
  appleWebApp: {
    capable: true,
    title: "NexaPOS",
    statusBarStyle: "default",
  },
  other: {
    // Next emits the modern `mobile-web-app-capable`, which iOS 16.4+ honours
    // along with the manifest's `display: standalone`. Older iPads and iPhones
    // - plausible hardware in a small grocery shop - still need the deprecated
    // prefixed tag to launch without Safari chrome. Cheap insurance; remove
    // once no target device predates 16.4.
    "apple-mobile-web-app-capable": "yes",
  },
};

/**
 * themeColor lives on `viewport`, not `metadata` - Next moved it there and
 * warns if it is set on metadata. Matches --brand-600 in globals.css.
 */
export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
