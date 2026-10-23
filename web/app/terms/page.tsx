import type { Metadata } from "next";
import { paths, site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `Terms of Use for ${site.name}, including the Weekly Auditor auto-renewable subscription and the Project Pro Pass.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="prose narrow">
      <p className="kicker">Terms of Use</p>
      <h1>Terms of Use</h1>
      <p className="meta">
        Effective {site.effectiveDate}. These terms are the end-user license agreement for {site.name} and the
        subscription terms required by Apple Guideline 3.1.2.
      </p>

      <aside className="disclosure">
        <h2>Auto-renewable subscription · Apple Guideline 3.1.2</h2>
        <p>
          <strong>{site.weekly.name}</strong> is an auto-renewable subscription. Length: 1 week. Price: {site.weekly.price}{" "}
          (USD) per week.
        </p>
        <p>
          {site.weekly.name} is {site.weekly.price} per week after a {site.weekly.trialDays}-day free trial when the
          App Store product includes that intro offer. During that trial the price is $0. If you do not cancel at
          least 24 hours before the trial ends, the subscription continues and Apple charges {site.weekly.price} per
          week.
        </p>
        <p>
          Payment is charged to your Apple ID at confirmation of purchase. The subscription renews automatically unless
          you turn off auto-renew at least 24 hours before the end of the current period. Your account is charged for
          renewal within 24 hours before the end of the current period. The renewal price is {site.weekly.price} per
          week unless Apple shows you a different price and you accept it.
        </p>
        <p>
          Cancel and manage the subscription in iOS Settings → Apple ID → Subscriptions. Any unused portion of a free
          trial, if offered, is forfeited when you purchase a subscription that replaces it, where Apple applies that
          rule.
        </p>
        <p>
          Privacy Policy: <a href={paths.privacy}>{site.url}/privacy</a>
          <br />
          Terms of Use (EULA): <a href={paths.terms}>{site.url}/terms</a>
        </p>
      </aside>

      <h2>{site.projectPass.name}</h2>
      <p>
        {site.projectPass.name} is a one-time in-app purchase of {site.projectPass.price} (USD). It is not a
        subscription and it does not auto-renew. Payment is charged to your Apple ID at confirmation of purchase. It
        reveals the fair-price table and the educational negotiation templates for audits in that install, under the{" "}
        {site.entitlementId} entitlement.
      </p>

      <h2>What a pass includes</h2>
      <p>
        Both {site.projectPass.name} and an active {site.weekly.name} turn on {site.entitlementId}. Paid members get{" "}
        {site.cloudAuditsPerUtcDay} cloud AI audits per UTC day. When those are used, or when there is no active pass,
        {site.name} uses the on-device local benchmark. The local fair band can differ from a cloud one-shot read.
        Wholesale benchmarks, exact overcharge dollars, and counter-offer scripts stay available with an active pass.
      </p>

      <h2>Restore Purchases</h2>
      <p>
        Tap Restore Purchases on the paywall. {site.name} checks the Apple ID through RevenueCat for {site.entitlementId}.
        A pass restores to the Apple ID that bought it.
      </p>

      <aside className="disclosure">
        <h2>No professional advice</h2>
        <p>{site.disclaimer}</p>
        <p>
          Benchmarks and negotiation templates are based on regional industry data, including public labor statistics
          and published supply references. {site.name} is not a contractor, law firm, engineer, or licensed building
          inspector. You decide whether to sign. You are responsible for permits, safety, and the contract.
        </p>
      </aside>

      <h2>The service</h2>
      <p>
        {site.name} lets a US homeowner photograph a contractor quote, pick one from the photo library, or upload a
        PDF, enter a 5-digit ZIP, and compare the quote with regional cost benchmarks for HVAC, Electrical Panel,
        Smart Home, Plumbing, and Roofing. The Try Demo Quote path uses a built-in example and does not require a
        photo.
      </p>
      <p>
        Sample reports published on {site.url} are educational fixtures. They are not findings against a named
        contractor and they are not a prediction of savings on your job.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use {site.name} for quotes you are allowed to review. Do not upload someone else’s private documents, attempt
        to break the service, or present an audit as a licensed inspection. We may refuse a cloud audit that we cannot
        verify as a paid {site.entitlementId} entitlement.
      </p>

      <h2>Apple</h2>
      <p>
        These purchases are processed by Apple, not by this website. Apple’s standard licensed application terms apply
        between you and Apple for the download. Refunds of App Store charges are handled by Apple. This website cannot
        cancel {site.weekly.name} for you.
      </p>

      <h2>The website</h2>
      <p>
        The pages at {site.url}, {site.url}/support, {site.url}/privacy, and {site.url}/terms are public and do not
        require a login. The support form opens an email. It does not create a stored ticket by itself.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms by posting a new effective date on this page. Subscription prices and trial
        eligibility shown in the App Store at the time you subscribe control that purchase.
      </p>

      <h2>Contact</h2>
      <p>
        {site.supportEmail}. We reply within {site.responseHours} hours. See also the{" "}
        <a href={paths.privacy}>Privacy Policy</a> and <a href={paths.support}>Support</a>.
      </p>
    </article>
  );
}
