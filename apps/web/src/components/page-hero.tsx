import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The site's stage lighting: a dark band with warm and violet glows, the same in light and
 * dark themes (like a room at night). Every page opens with one.
 */
export function HeroGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_15%_0%,color-mix(in_oklab,var(--primary)_55%,transparent),transparent_60%),radial-gradient(50%_70%_at_95%_20%,rgba(147,51,234,0.45),transparent_60%),radial-gradient(40%_60%_at_60%_120%,rgba(14,165,233,0.25),transparent_60%)]"
    />
  );
}

/** Gradient text for the one word that matters in a title ("New York", "fans"). */
export function Accent({ children }: { children: ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-sky-300 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/** Small pill above a title; `live` adds the pulsing dot. */
export function HeroEyebrow({ children, live }: { children: ReactNode; live?: boolean }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
      {live && (
        <span className="relative flex size-2 text-primary" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </p>
  );
}

/** Pill buttons and links on the dark band. */
export const heroPill = (active: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
    active
      ? 'bg-white text-zinc-950'
      : 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20',
  );

/** Glass card for content that sits on the dark band. */
export const heroGlass = 'rounded-2xl bg-white/[0.06] ring-1 ring-white/15 backdrop-blur';

export function PageHero({
  eyebrow,
  live,
  title,
  description,
  aside,
  children,
  size = 'md',
  className,
}: {
  eyebrow?: ReactNode;
  live?: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Right column on wide screens (a preview card, stats). */
  aside?: ReactNode;
  /** Controls under the title: tabs, filters, actions. */
  children?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  className?: string;
}) {
  return (
    <section className={cn('relative isolate overflow-hidden bg-zinc-950 text-white', className)}>
      <HeroGlow />
      <div
        className={cn(
          'mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4',
          size === 'lg'
            ? 'pt-12 pb-12 sm:pt-20 sm:pb-16'
            : size === 'md'
              ? 'pt-10 pb-8 sm:pt-12'
              : 'pt-8 pb-6',
          aside && 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center',
        )}
      >
        <div className="grid min-w-0 content-start gap-5">
          <div>
            {eyebrow && <HeroEyebrow live={live}>{eyebrow}</HeroEyebrow>}
            <h1
              className={cn(
                'font-extrabold tracking-tight text-balance',
                eyebrow && 'mt-4',
                size === 'lg'
                  ? 'text-4xl sm:text-6xl'
                  : size === 'md'
                    ? 'text-3xl sm:text-5xl'
                    : 'text-2xl sm:text-4xl',
              )}
            >
              {title}
            </h1>
            {description && (
              <div className="mt-3 max-w-2xl text-white/70 text-pretty sm:text-lg">
                {description}
              </div>
            )}
          </div>
          {children}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}
