import type { Metadata } from "next";
import { FaqList } from "../../components/FaqList";
import { TicketForm } from "../../components/TicketForm";
import { site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: `Contact ${site.name} at ${site.supportEmail}. Restore purchases, daily cloud audits, and the on-device benchmark.`,
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <article className="prose narrow">
      <p className="kicker">Support</p>
      <h1>Help with a pass, a quote audit, or your data.</h1>
      <p className="meta">We reply within {site.responseHours} hours.</p>

      <aside className="sla">
        <p className="section-kicker">Direct support</p>
        <p>
          <a className="mail" href={`mailto:${site.supportEmail}`}>
            {site.supportEmail}
          </a>
        </p>
        <p>
          Email that address, or use the form. The form prepares the message on this device. Quote Shield AI replies
          within {site.responseHours} hours after the email arrives.
        </p>
      </aside>

      <h2 id="contact">Contact form</h2>
      <TicketForm />

      <h2>FAQ</h2>
      <FaqList
        items={[
          {
            id: "restore",
            question: "How do I restore my Pro Pass or Weekly Subscription?",
            answer: (
              <>
                <p>
                  Open the paywall in {site.name} and tap Restore Purchases. The app asks Apple, through RevenueCat,
                  whether this Apple ID has the {site.entitlementId} entitlement. That entitlement covers a purchased{" "}
                  {site.projectPass.name} and an active {site.weekly.name} subscription.
                </p>
                <p>
                  Restore follows the Apple ID that paid. It does not use your name or a street address. If that Apple
                  ID has no active pass, the fair-price table stays locked. Write {site.supportEmail} with the category
                  Billing &amp; Restore Purchase if the button does not restore a purchase you can see in Apple’s
                  subscription settings.
                </p>
              </>
            ),
          },
          {
            id: "quota",
            question: "How does the daily cloud AI quota (3 credits per day) work?",
            answer: (
              <>
                <p>
                  Paid members get {site.cloudAuditsPerUtcDay} cloud AI audits per UTC day. Each cloud audit is one
                  multimodal read of a contractor quote, used so the line items can be checked with care. The count
                  resets at 00:00 UTC. The built-in demo quote does not use a credit.
                </p>
                <p>
                  When you are unpaid, or when those {site.cloudAuditsPerUtcDay} cloud audits are used, {site.name}{" "}
                  switches to the on-device local benchmark. You can keep estimating on the device. Cloud audits are
                  available again on the next UTC day if the pass is still active.
                </p>
              </>
            ),
          },
          {
            id: "local-band",
            question: "Why can the local fair band differ from a cloud audit?",
            answer: (
              <>
                <p>
                  The on-device estimator prices a regional band from the US metro labor matrix (30 metro areas) and
                  the trade blueprint for your ZIP. It uses those statistical medians. It does not identify the
                  equipment SKU printed on the quote.
                </p>
                <p>
                  A cloud audit, while a daily credit remains, reads the quote once and checks the lines it can see,
                  including equipment descriptions, against the benchmark. The local fair band can differ from a cloud
                  one-shot read. The result screen says so when you are looking at the local benchmark.
                </p>
              </>
            ),
          },
          {
            id: "cancel",
            question: "How do I cancel my subscription?",
            answer: (
              <>
                <p>
                  {site.weekly.name} renews through Apple. On iPhone open Settings → Apple ID → Subscriptions, select{" "}
                  {site.weekly.name}, and cancel. Cancel at least 24 hours before the free trial ends, or before the
                  next weekly renewal, so the next period is not charged. Payment is charged to your Apple ID.{" "}
                  {site.name} cannot cancel an Apple subscription from this website.
                </p>
                <p>
                  {site.projectPass.name} is a one-time {site.projectPass.price} purchase. It does not auto-renew.
                </p>
              </>
            ),
          },
        ]}
      />
    </article>
  );
}
