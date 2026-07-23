import type { Metadata } from "next";
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
