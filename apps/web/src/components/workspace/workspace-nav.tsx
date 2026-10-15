'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Overview, new campaign and (for real organizations) team members. */
export function WorkspaceNav({ slug, isDemo }: { slug: string; isDemo: boolean }) {
  const path = usePathname();
  const items = [
    { href: `/w/${slug}`, label: 'Overview' },
    { href: `/w/${slug}/new`, label: 'Plan a show' },
    { href: `/w/${slug}/outreach`, label: 'Outreach' },
    ...(isDemo ? [] : [{ href: `/w/${slug}/members`, label: 'Team' }]),
  ];
  return (
    <nav aria-label="Workspace" className="mt-5 flex gap-1 overflow-x-auto border-b">
      {items.map((i) => {
        const active = path === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
