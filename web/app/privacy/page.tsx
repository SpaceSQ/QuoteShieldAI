import type { Metadata } from "next";
import { paths, site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${site.name}. Camera and photo library are used only to audit a contractor quote. Personal information is not sold.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="prose narrow">
      <p className="kicker">Privacy Policy</p>
      <h1>Privacy Policy</h1>
      <p className="meta">
        Effective {site.effectiveDate}. This policy covers the {site.name} iOS app and this website, for Apple
        Guideline 5.1.1 and the California Consumer Privacy Act (CCPA).
      </p>

      <div className="disclosure">
        <h2>In short</h2>
        <ul>
          <li>Camera and photo library are used only to audit a contractor quote.</li>
          <li>We collect a 5-digit US ZIP. We do not collect a precise street address.</li>
          <li>Quote files are not sold to contractors and are not used to train public foundation models.</li>
          <li>You can ask us to delete your data. Instructions are below.</li>
        </ul>
      </div>

      <h2>Who this policy is for</h2>
      <p>
        {site.name} is a homeowner tool that compares a contractor quote with regional cost benchmarks. You can use an
        anonymous session. A legal name is not required. Contact {site.supportEmail} for privacy requests.
      </p>

      <h2>Data minimization</h2>
      <p>We collect only what the audit needs:</p>
      <ul>
        <li>A 5-digit US ZIP code, so the regional labor band can be selected.</li>
        <li>The quote image or PDF you choose to upload, so the quote can be read.</li>
        <li>An anonymous account id when the audit service is configured, so the session can continue without an email login.</li>
        <li>The trade you pick and the answers on the short onboarding quiz.</li>
        <li>Purchase status for the {site.entitlementId} entitlement. Apple processes the payment. We do not receive your card number.</li>
      </ul>
      <p>
        We do not collect a precise street address, GPS coordinates, contacts, or a government id. The ZIP is an area
        code for labor rates, not a map pin of your house.
      </p>

      <h2>Camera and photo library</h2>
      <p>
        Camera and photo library are used only to audit a contractor quote. The camera photographs the quote. The
        photo library lets you choose a saved photo or screenshot of the quote. A PDF can be chosen the same way. The
        file is read for line items, totals, and equipment descriptions on that quote. It is not used to identify a
        person, and it is not used for advertising.
      </p>
      <p>
        Permission is requested when you choose the camera or the library. The built-in demo quote stays on the device
        and does not upload a photo.
      </p>

      <h2>How a quote file is handled</h2>
      <p>
        The app does not call OpenAI, xAI, or any other model provider itself. A cloud audit is sent to the {site.name}{" "}
        server. When a cloud audit runs, the server sends the quote over an encrypted connection to the configured
        vision provider (OpenAI or xAI) for that one read. API keys and the raw image are not written to application
        logs. A completed cloud audit may be stored with your anonymous account, including the quote file in a private
        bucket and the audit result.
      </p>
      <p>
        Paid members get {site.cloudAuditsPerUtcDay} cloud audits per UTC day. If you are unpaid, or those daily cloud
        audits are used, the app shows the on-device local benchmark. That benchmark is calculated from the ZIP and
        the trade. The local fair band can differ from a cloud one-shot read. The on-device result does not call a
        model provider.
      </p>

      <h2>We do not sell your information</h2>
      <p>
        User data is not sold to contractors and is not used to train public foundation models. {site.name} does not
        sell or share personal information for cross-context behavioral advertising. There is no contractor lead
        marketplace and no contractor kickback. Quote images are not given to the contractor who wrote the quote.
      </p>

      <h2>Service providers</h2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Anonymous authentication, database, and private file storage. The project is hosted in the US East region.</td>
          </tr>
          <tr>
            <td>RevenueCat</td>
            <td>Checks the Apple in-app purchase receipt for the {site.entitlementId} entitlement. It does not receive your card number.</td>
          </tr>
          <tr>
            <td>Apple</td>
            <td>Processes payment for {site.projectPass.name} and {site.weekly.name} and handles subscription cancellation.</td>
          </tr>
          <tr>
            <td>OpenAI or xAI</td>
            <td>Temporary vision read of a quote during a cloud audit. The read produces your audit. It is not a training set for a public foundation model.</td>
          </tr>
        </tbody>
      </table>

      <h2>CCPA rights</h2>
      <p>
        If you are a California resident, you may ask us to disclose the categories and specific pieces of personal
        information we hold, to delete that information, and to correct inaccurate information. You will not be
        discriminated against for exercising these rights. We do not sell personal information, and we do not share it
        for cross-context behavioral advertising, so there is no sale to opt out of.
      </p>
      <p>Categories we may hold:</p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Identifiers</td>
            <td>Anonymous account id, the email you send support</td>
            <td>Run the session and answer you</td>
          </tr>
          <tr>
            <td>Approximate location</td>
            <td>5-digit US ZIP</td>
            <td>Regional labor band</td>
          </tr>
          <tr>
            <td>User content</td>
            <td>Quote photos and PDFs, audit results</td>
            <td>Audit that quote</td>
          </tr>
          <tr>
            <td>Commercial information</td>
            <td>{site.entitlementId} purchase status</td>
            <td>Unlock a pass you bought</td>
          </tr>
        </tbody>
      </table>
      <p>
        Send CCPA requests to {site.supportEmail} or use the Data Deletion Request category on the{" "}
        <a href={paths.support}>support page</a>. We may need enough detail to find the anonymous account. An
        authorized agent may write for you with proof of authorization. We aim to respond within 45 days.
      </p>

      <h2>Other privacy rights</h2>
      <p>
        Depending on where you live, you may also have rights to access, delete, or export your information, and to
        object to or limit certain processing. The audit is provided at your request. Email {site.supportEmail} to
        use those rights. This website does not require an account.
      </p>

      <h2>Data deletion</h2>
      <p>You can delete your {site.name} data in either of these ways:</p>
      <ul>
        <li>
          In the app, open Settings → Clear My Audit History &amp; Delete Account. That control is there to erase the
          cloud audit history for the account and the copy stored on the device.
        </li>
        <li>
          Email {site.supportEmail} with the subject “Data Deletion Request”, or choose that category in the support
          form and send the email. Tell us the Apple ID email if a purchase is involved, and any detail that
          identifies the anonymous session. We delete the cloud audit records and stored quote files tied to that
          account. Removing the app also clears what remains only on the device.
        </li>
      </ul>
      <p>
        Apple keeps its own purchase record. Deleting your {site.name} account does not cancel {site.weekly.name}.
        Cancel that subscription in Settings → Apple ID → Subscriptions.
      </p>

      <h2>Retention and security</h2>
      <p>
        Audit records stay until you delete them or you ask us to delete them. Support emails are kept long enough to
        resolve the request and any follow-up. Access to production data is limited to operating the service. No
        method of transmission is perfectly secure.
      </p>

      <h2>Children</h2>
      <p>
        {site.name} is for homeowners, not for children under 13. We do not knowingly collect personal information
        from children.
      </p>

      <h2>This website</h2>
      <p>
        The marketing pages at {site.url} do not require a login. The support form does not store a ticket on a
        server. It opens an email draft. The site does not sell visitor data.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the effective date at the top will change. Continued use of the app after the new date
        means you have the updated policy available at {site.url}/privacy.
      </p>

      <h2>Contact</h2>
      <p>
        {site.supportEmail}. Related pages: <a href={paths.terms}>Terms of Use</a> and{" "}
        <a href={paths.support}>Support</a>.
      </p>
      <p>{site.disclaimer}</p>
    </article>
  );
}
