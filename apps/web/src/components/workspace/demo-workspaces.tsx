import { PERSONA_META } from '@housefull/shared';
import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { ApiError, getDemoWorkspaces } from '@/lib/api';
import { PERSONA_ICONS } from './persona-icons';

/** One-click demo workspaces: no sign-up, one per persona. */
export async function DemoWorkspaces() {
  let workspaces: Awaited<ReturnType<typeof getDemoWorkspaces>>;
  try {
    workspaces = await getDemoWorkspaces();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return null;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {workspaces.map((w) => {
        const Icon = PERSONA_ICONS[w.persona];
        return (
          <li key={w.slug}>
            <Link
              href={`/w/${w.slug}`}
              className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-primary">
                <Icon className="size-4" aria-hidden />
                {PERSONA_META[w.persona].label}
              </span>
              <span className="font-medium">{w.name.replace(/ \(demo\)$/, '')}</span>
              <span className="text-sm text-muted-foreground text-pretty">
                {PERSONA_META[w.persona].blurb}
              </span>
              <span className="mt-auto flex items-center gap-1 pt-1 text-sm text-primary">
                Open the demo
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
