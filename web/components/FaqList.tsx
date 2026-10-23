import type { ReactNode } from "react";

export function FaqList({
  items,
}: {
  items: { id: string; question: string; answer: ReactNode }[];
}) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.id} id={item.id}>
          <summary>{item.question}</summary>
          <div className="faq-answer">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
