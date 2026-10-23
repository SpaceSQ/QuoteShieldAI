import type { Metadata } from "next";
import { site } from "../lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="missing">
      <div className="wrap">
        <p className="kicker">{site.name}</p>
        <h1>That page is not on this site.</h1>
        <p>The public pages are the home page, support, privacy, and terms.</p>
        <p>
          <a href="/">Back to {site.name}</a>
        </p>
      </div>
    </section>
  );
}
