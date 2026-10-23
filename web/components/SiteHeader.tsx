import { paths, site } from "../lib/site";

export function ShieldMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" rx="28" fill="#020617" />
      <path
        d="M64 18 L100 34 V62 C100 86 64 110 64 110 C64 110 28 86 28 62 V34 Z"
        fill="#0F172A"
        stroke="#F59E0B"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M46 66 L58 78 L84 50"
        fill="none"
        stroke="#10B981"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#samples", label: "Sample reports" },
  { href: paths.download, label: "Download" },
  { href: paths.support, label: "Support" },
  { href: paths.privacy, label: "Privacy" },
  { href: paths.terms, label: "Terms" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap header-bar">
        <a className="brand" href={paths.home}>
          <ShieldMark />
          <span>{site.name}</span>
        </a>
        <nav className="desk-nav" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <details className="mob-nav">
          <summary>Menu</summary>
          <nav aria-label="Mobile">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
