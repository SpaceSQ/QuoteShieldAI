import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { site } from "../lib/site";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Audit a contractor quote before you sign`,
    template: `%s · ${site.name}`,
  },
  description:
    "Quote Shield AI helps US homeowners check HVAC, electrical panel, smart home, plumbing, and roofing quotes against regional cost benchmarks.",
  applicationName: site.name,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description:
      "Stop overpaying contractors. Audit a home repair quote against regional cost benchmarks.",
    url: site.url,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
