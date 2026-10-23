import { paths, site } from "../lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-name">{site.name}</p>
          <p className="footer-note">{site.neutralLine}</p>
          <p>
            <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
          </p>
        </div>
        <nav aria-label="Footer">
          <a href={paths.support}>Support</a>
          <a href={paths.privacy}>Privacy Policy</a>
          <a href={paths.terms}>Terms of Use</a>
          <a href={paths.download}>App Store preview</a>
        </nav>
      </div>
      <div className="wrap">
        <p className="disclaimer">{site.disclaimer}</p>
        <p className="fine">© 2026 {site.name}. Sample reports are educational fixtures.</p>
      </div>
    </footer>
  );
}
