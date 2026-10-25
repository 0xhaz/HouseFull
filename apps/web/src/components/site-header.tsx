import Link from 'next/link';
import { Suspense } from 'react';
import { AccountMenu } from '@/components/account-menu';
import { CitySwitcher } from '@/components/city-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Skeleton } from '@/components/ui/skeleton';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href="/"
          aria-label="HouseFull home"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold"
          >
            HF
          </span>
          <span className="hidden sm:inline">HouseFull</span>
        </Link>
        <nav aria-label="Main" className="flex items-center sm:ml-2">
          {[
            ['/tonight', 'Tonight', ''],
            ['/guide', 'Guide', 'hidden md:inline-flex'],
            ['/about', 'About', 'hidden md:inline-flex'],
          ].map(([href, label, cls]) => (
            <Link
              key={href}
              href={href as string}
              className={`rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground ${cls}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<Skeleton className="h-8 w-36" />}>
            <CitySwitcher />
          </Suspense>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
