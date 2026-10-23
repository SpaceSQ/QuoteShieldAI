import type { Metadata } from "next";
import { AppStoreBadge } from "../components/AppStoreBadge";
import { SampleCard } from "../components/SampleCard";
import { featuredSamples } from "../lib/cases";
import { usd } from "../lib/format";
import { site } from "../lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const features = [
  {
    index: "01",
    title: "Scan the quote",
    body: "Use the camera, the photo library, or a PDF. Try Demo Quote walks the same funnel with a built-in example and no photo.",
  },
  {
    index: "02",
    title: "Match a US ZIP",
    body: "A 5-digit ZIP selects the regional labor band. Quote Shield AI does not ask for a street address.",
  },
  {
    index: "03",
    title: "Score the risk",
    body: "You see the contractor total, a rip-off risk score, an estimated savings range, and the titles of red flags.",
  },
  {
    index: "04",
    title: "Flag missing protections",
    body: "The read looks for permit, warranty, and inclusion language that a lump-sum quote often leaves out.",
  },
  {
    index: "05",
    title: "Fair-price table",
    body: "Project Pro Pass and Weekly Auditor reveal the fair-price table, wholesale context, and the dollar gap on the lines.",
  },
  {
    index: "06",
    title: "Negotiation templates",
    body: "Unlocked audits include educational email and text scripts you can copy. They are templates, not a lawyer’s letter.",
  },
];

export default function HomePage() {
  const samples = featuredSamples();
  const irvine = samples.find((sample) => sample.id === "demo_ca_hvac_irvine_3ton_01") ?? samples[0];
  const dfw = samples.find((sample) => sample.id === "demo_tx_elec_dfw_panel_03");

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="kicker">{site.name}</p>
            <h1>Stop Overpaying Contractors. Audit Any Quote in 15 Seconds.</h1>
            <p className="lede">
              A homeowner-side check for HVAC, Electrical Panel, Smart Home, Plumbing, and Roofing quotes. Photograph
              the page, enter a US ZIP, and see the rip-off risk before you sign.
            </p>
            <div className="hero-actions">
              <AppStoreBadge />
              <a className="text-link" href="#samples">
                See sample reports
              </a>
            </div>
            <p className="neutral">{site.neutralLine}</p>
          </div>
          <aside className="hero-panel">
            <p className="panel-label">Sample report · {irvine.location}</p>
            <p className="hero-savings">{usd(irvine.savings)}</p>
            <p className="panel-meta">
              Sample savings on a {usd(irvine.quoted)} {irvine.trade} quote. Fair range {usd(irvine.fairLow)}–
              {usd(irvine.fairHigh)}. Risk {irvine.risk}/100.
            </p>
            <p className="panel-note">
              Educational fixture from the 2026 sample set. Not a finding against a named contractor, and not a
              promise for your quote.
            </p>
          </aside>
        </div>
      </section>

      <div className="trade-row" aria-label="Trades">
        {site.trades.map((trade) => (
          <span key={trade}>{trade}</span>
        ))}
      </div>

      <section className="section" id="features">
        <div className="wrap">
          <div className="section-head">
            <p className="section-kicker">What you get</p>
            <h2>A quote audit, not a contractor directory.</h2>
            <p>
              Quote Shield AI works for the homeowner. Wholesale benchmarks, exact overcharge dollars, and the
              counter-offer scripts stay locked until you buy a pass.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature" key={feature.index}>
                <p className="feature-index">{feature.index}</p>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="engines">
        <div className="wrap">
          <div className="section-head">
            <p className="section-kicker">Two ways to price a quote</p>
            <h2>Cloud AI Deep X-Ray, then the on-device estimator.</h2>
            <p>
              Paid members get {site.cloudAuditsPerUtcDay} cloud audits per UTC day. After that, and for unpaid
              audits, Quote Shield AI switches to the local benchmark. The local fair band can differ from a cloud
              one-shot read.
            </p>
          </div>
          <div className="split">
            <article className="track track-cloud">
              <p className="section-kicker">Pro</p>
              <h3>Cloud AI Deep X-Ray</h3>
              <p>
                A paid {site.entitlementId} membership can run {site.cloudAuditsPerUtcDay} cloud audits each UTC day.
                Each one is a single read of the quote: the total, the visible line items, and equipment descriptions
                on the page. The benchmark math stays the price source. The model does not invent a regional rate.
                Credits reset at 00:00 UTC. The built-in demo does not spend a credit.
              </p>
            </article>
            <article className="track track-local">
              <p className="section-kicker">Free and after the daily 3</p>
              <h3>On-Device Instant Estimator</h3>
              <p>
                If you are unpaid, or today’s {site.cloudAuditsPerUtcDay} cloud audits are used, the result is the
                on-device local benchmark. It prices from the US metro labor matrix and the trade blueprint for your
                ZIP. It does not call a model provider. Because it does not read a specific equipment SKU the way a
                cloud read does, the local fair band can differ from a cloud one-shot read.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="samples">
        <div className="wrap">
          <div className="section-head">
            <p className="section-kicker">Sample reports</p>
            <h2>Five fixtures, one for each trade.</h2>
            <p>
              Numbers below are copied from the educational fixture file, including the Irvine heat pump (
              {usd(irvine.savings)} sample savings)
              {dfw ? ` and the Dallas-Fort Worth 200A panel (${usd(dfw.savings)} sample savings)` : ""}. They show how
              a report is laid out. They are not accusations against a named contractor.
            </p>
          </div>
          <ul className="legend">
            <li>
              <i className="dot-high" /> 65–100 High rip-off risk
            </li>
            <li>
              <i className="dot-review" /> 40–64 Review before you sign
            </li>
            <li>
              <i className="dot-lower" /> 0–39 Lower risk
            </li>
          </ul>
          <div className="sample-grid">
            {samples.map((sample, index) => (
              <SampleCard key={sample.id} sample={sample} featured={index < 2} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <p className="section-kicker">Passes</p>
            <h2>Pay once for a project, or audit by the week.</h2>
            <p>
              Apple bills your Apple ID. Cancel a subscription at least 24 hours before renewal in Settings. Full
              terms are on the <a href="/terms">Terms of Use</a> page.
            </p>
          </div>
          <div className="price-grid">
            <article className="price price-default">
              <p className="price-flag">Default · one-time</p>
              <h3>{site.projectPass.name}</h3>
              <p className="price-amount">{site.projectPass.price}</p>
              <p>{site.projectPass.detail}</p>
            </article>
            <article className="price">
              <p className="price-flag">Auto-renewable</p>
              <h3>{site.weekly.name}</h3>
              <p className="price-amount">
                {site.weekly.price}
                <span> / {site.weekly.period}</span>
              </p>
              <p>
                {site.weekly.trialDays}-day free trial when the App Store product includes that intro offer, then{" "}
                {site.weekly.price} per week until you cancel. Both passes use the {site.entitlementId} entitlement.
                Paid members still get {site.cloudAuditsPerUtcDay} cloud audits per UTC day, then the on-device
                benchmark.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="download">
        <div className="wrap download">
          <div>
            <p className="section-kicker">iOS</p>
            <h2>App Store preview</h2>
            <p>
              Quote Shield AI is built for iPhone. The App Store listing is not live, and this site does not invent a
              store id. The badge stays on this page until a real listing exists.
            </p>
            <p>
              Questions before then go to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. We reply
              within {site.responseHours} hours.
            </p>
          </div>
          <AppStoreBadge href="#download" />
        </div>
      </section>
    </>
  );
}
