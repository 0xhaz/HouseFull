import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

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
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Badge variant="outline">Coming in {phase}</Badge>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </main>
  );
}
