import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
};

/** Primary action block — title, helper text, and one main CTA with breathing room. */
export function ActionPanel({ title, description, children, testId }: Props) {
  return (
    <section className="card space-y-5" data-testid={testId}>
      <div className="space-y-2 max-w-2xl">
        <h2 className="text-sm font-semibold text-content">{title}</h2>
        {description ? <p className="text-sm leading-relaxed text-content-muted">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">{children}</div>
    </section>
  );
}
