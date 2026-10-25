import type { ReactNode } from 'react';
import { PageHero } from '@/components/page-hero';

export function PagePlaceholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex-1">
      <PageHero size="sm" eyebrow={`Coming in ${phase}`} title={title} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-muted-foreground">{children}</div>
    </main>
  );
}
