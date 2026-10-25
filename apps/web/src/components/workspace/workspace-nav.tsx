'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { heroPill } from '@/components/page-hero';

/** Overview, planning, outreach and (for real organizations) team members, as pills on the hero. */
export function WorkspaceNav({ slug, isDemo }: { slug: string; isDemo: boolean }) {
  const path = usePathname();
  const items = [
    { href: `/w/${slug}`, label: 'Overview' },
    { href: `/w/${slug}/new`, label: 'Plan a show' },
    { href: `/w/${slug}/outreach`, label: 'Outreach' },
    ...(isDemo ? [] : [{ href: `/w/${slug}/members`, label: 'Team' }]),
  ];
  return (
    <nav
      aria-label="Workspace"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      {items.map((i) => {
        const active = path === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={heroPill(active)}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
