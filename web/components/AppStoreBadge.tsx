export function AppStoreBadge({ href = "#download" }: { href?: string }) {
  return (
    <a className="store-badge" href={href}>
      <svg width="22" height="26" viewBox="0 0 18 22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M14.8 11.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.2c.7-1 1.2-2.1 1.5-3.2-3.9-1.5-3.8-5.5-3.8-5.3zM12.4 4.7c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.8-.9 2.9 1.1.1 2.1-.5 2.8-1.4z"
        />
      </svg>
      <span>
        <small>Coming soon</small>
        <strong>Download on the App Store</strong>
      </span>
    </a>
  );
}
