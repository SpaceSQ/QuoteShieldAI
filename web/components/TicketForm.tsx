"use client";

import { FormEvent, useState } from "react";
import { site } from "../lib/site";

const CATEGORIES = [
  "Billing & Restore Purchase",
  "Quote Audit Feedback",
  "Data Deletion Request",
  "Feature Request",
] as const;

type Category = (typeof CATEGORIES)[number];

interface Fields {
  name: string;
  email: string;
  category: string;
  message: string;
}

interface Errors {
  name?: string;
  email?: string;
  category?: string;
  message?: string;
}

interface Ready {
  reference: string;
  mailto: string;
  text: string;
}

const EMPTY: Fields = { name: "", email: "", category: "", message: "" };

function referenceCode(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `QS-${y}${m}${d}-${suffix}`;
}

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  const name = fields.name.trim();
  const email = fields.email.trim();
  const message = fields.message.trim();
  if (name.length < 2) errors.name = "Enter your name.";
  else if (name.length > 80) errors.name = "Use 80 characters or fewer.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!CATEGORIES.includes(fields.category as Category)) errors.category = "Choose a category.";
  if (message.length < 10) errors.message = "Describe the issue in at least 10 characters.";
  else if (message.length > 2000) errors.message = "Use 2,000 characters or fewer.";
  return errors;
}

function compose(fields: Fields, reference: string): string {
  return [
    "Quote Shield AI support request",
    `Reference: ${reference}`,
    "This reference was created in the browser. It is not a server ticket id.",
    "",
    `Name: ${fields.name.trim()}`,
    `Email: ${fields.email.trim()}`,
    `Category: ${fields.category}`,
    "",
    fields.message.trim(),
  ].join("\n");
}

export function TicketForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [ready, setReady] = useState<Ready | null>(null);
  const [copied, setCopied] = useState(false);

  function update(key: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setCopied(false);
    if (Object.keys(nextErrors).length > 0) {
      setReady(null);
      return;
    }
    const reference = referenceCode();
    const text = compose(fields, reference);
    const subject = `Quote Shield AI ${fields.category} [${reference}]`;
    const mailto = `mailto:${site.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    setReady({ reference, mailto, text });
    const anchor = document.createElement("a");
    anchor.href = mailto;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function copyMessage() {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(ready.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form className="ticket" noValidate onSubmit={onSubmit}>
      <p className="form-note">
        This form checks your entries in the browser, then opens an email to {site.supportEmail}. Quote Shield AI
        does not store a ticket on a server. Nothing is sent until you send that email.
      </p>
      <div className="field">
        <label htmlFor="ticket-name">Name</label>
        <input
          id="ticket-name"
          name="name"
          autoComplete="name"
          value={fields.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "ticket-name-error" : undefined}
          onChange={(event) => update("name", event.target.value)}
        />
        {errors.name ? (
          <p id="ticket-name-error" className="field-error">
            {errors.name}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="ticket-email">Email</label>
        <input
          id="ticket-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={fields.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "ticket-email-error" : undefined}
          onChange={(event) => update("email", event.target.value)}
        />
        {errors.email ? (
          <p id="ticket-email-error" className="field-error">
            {errors.email}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="ticket-category">Issue category</label>
        <select
          id="ticket-category"
          name="category"
          value={fields.category}
          aria-invalid={errors.category ? true : undefined}
          aria-describedby={errors.category ? "ticket-category-error" : undefined}
          onChange={(event) => update("category", event.target.value)}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        {errors.category ? (
          <p id="ticket-category-error" className="field-error">
            {errors.category}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="ticket-message">Message</label>
        <textarea
          id="ticket-message"
          name="message"
          rows={6}
          value={fields.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "ticket-message-error" : undefined}
          onChange={(event) => update("message", event.target.value)}
        />
        {errors.message ? (
          <p id="ticket-message-error" className="field-error">
            {errors.message}
          </p>
        ) : null}
      </div>
      <button className="button" type="submit">
        Prepare email
      </button>
      {ready ? (
        <div className="success" role="status">
          <p className="success-kicker">Email reference</p>
          <p className="success-code">{ready.reference}</p>
          <p>
            Put this reference in the subject if you write to us by hand. It was generated on this device. Quote
            Shield AI has not stored a ticket. Send the draft to{" "}
            <a href={ready.mailto}>{site.supportEmail}</a> to reach us. We reply within {site.responseHours} hours.
          </p>
          <div className="success-actions">
            <a className="button" href={ready.mailto}>
              Open email draft
            </a>
            <button className="button button-quiet" type="button" onClick={() => void copyMessage()}>
              {copied ? "Copied" : "Copy message"}
            </button>
          </div>
          <pre className="draft">{ready.text}</pre>
        </div>
      ) : null}
    </form>
  );
}
