import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { Toaster } from "@/components/feedback/toaster";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["opsz"], display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Elevo · Academic mentoring", template: "%s · Elevo" },
  description: "Mentoring that grows with you. Academic records, mentoring and wellbeing check-ins for students, mentors and HODs.",
  applicationName: "Elevo",
  openGraph: { title: "Elevo · Mentoring that grows with you", siteName: "Elevo", type: "website" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0F766E", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${bricolage.variable} ${manrope.variable}`}>
      <body>
        <a href="#main" className="sr-only z-[100] rounded-control bg-pine-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
