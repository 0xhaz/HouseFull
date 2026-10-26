'use client';

import { useAuth } from '@clerk/nextjs';
import {
  type ContactKind,
  OUTREACH_STATUS_LABEL,
  type OutreachContact,
  type OutreachStatus,
  type Persona,
} from '@housefull/shared';
import {
  AtSignIcon,
  ClockIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TagIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getOutreach, saveOutreachStatus } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace-context';
import { DraftDialog } from './draft-dialog';

const KIND_LABEL: Record<Persona, Record<ContactKind, string>> = {
  promoter: { place: 'Places nearby', act: 'Opening acts', media: 'Podcasts' },
  venue: { place: 'Neighbors', act: 'Acts to book', media: 'Podcasts' },
  artist: { place: 'Shops and bars', act: 'Support acts', media: 'Podcasts' },
};
const STATUSES = Object.keys(OUTREACH_STATUS_LABEL) as OutreachStatus[];

/** Demo workspaces are public: their outreach status stays in this browser. */
function demoKey(slug: string) {
  return `housefull:outreach:${slug}`;
}
function readDemo(slug: string): Record<string, OutreachStatus> {
  try {
    return JSON.parse(localStorage.getItem(demoKey(slug)) ?? '{}');
  } catch {
    return {};
  }
}

export function OutreachBoard() {
  const ws = useWorkspace();
  const { getToken } = useAuth();
  const [contacts, setContacts] = useState<OutreachContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ContactKind | 'all'>('all');
  const [status, setStatus] = useState<OutreachStatus | 'all'>('all');
  const [open, setOpen] = useState<OutreachContact | null>(null);

  const token = useCallback(
    async () => (ws?.isDemo ? null : await getToken()),
    [ws?.isDemo, getToken],
  );

  useEffect(() => {
    if (!ws) return;
    token()
      .then((t) => getOutreach(ws.slug, t))
      .then((list) => {
        const local = ws.isDemo ? readDemo(ws.slug) : {};
        setContacts(list.map((c) => (local[c.id] ? { ...c, status: local[c.id] } : c)));
      })
      .catch((e: Error) => setError(e.message));
  }, [ws, token]);

  const setContactStatus = useCallback(
    async (id: string, next: OutreachStatus) => {
      if (!ws) return;
      setContacts((cur) => cur?.map((c) => (c.id === id ? { ...c, status: next } : c)) ?? cur);
      if (ws.isDemo) {
        try {
          localStorage.setItem(
            demoKey(ws.slug),
            JSON.stringify({ ...readDemo(ws.slug), [id]: next }),
          );
        } catch {
          // storage unavailable: status lasts for this visit
        }
        return;
      }
      try {
        await saveOutreachStatus(ws.slug, id, { status: next }, await token());
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [ws, token],
  );

  const counts = useMemo(() => {
    const c = { all: 0, place: 0, act: 0, media: 0 } as Record<ContactKind | 'all', number>;
    for (const x of contacts ?? []) {
      c.all += 1;
      c[x.kind] += 1;
    }
    return c;
  }, [contacts]);
  const progress = useMemo(
    () => (contacts ?? []).filter((c) => c.status === 'contacted' || c.status === 'replied').length,
    [contacts],
  );
  const shown = (contacts ?? []).filter(
    (c) => (kind === 'all' || c.kind === kind) && (status === 'all' || c.status === status),
  );

  if (!ws) return null;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!contacts)
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  if (!contacts.length)
    return (
      <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        No contacts yet. Plan a show: its brief finds the places, acts and podcasts worth reaching.
      </p>
    );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {progress} of {contacts.length} contacted. Each contact comes from one of your briefs
            and says why it fits.
          </p>
          {ws.isDemo && (
            <p className="mt-1 text-xs text-muted-foreground">
              Demo workspace: statuses are saved in this browser only.
            </p>
          )}
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OutreachStatus | 'all')}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {OUTREACH_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Contact type">
        {(['all', 'place', 'act', 'media'] as const).map((k) => (
          <Button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            onClick={() => setKind(k)}
          >
            {k === 'all' ? 'All' : KIND_LABEL[ws.persona][k]}
            <span className="tabular-nums opacity-70">{counts[k]}</span>
          </Button>
        ))}
      </div>

      <ul className="grid gap-3 md:grid-cols-2" aria-label="Contacts">
        {shown.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            onEmail={() => setOpen(c)}
            onStatus={(s) => setContactStatus(c.id, s)}
          />
        ))}
      </ul>

      {open && (
        <DraftDialog
          contact={open}
          persona={ws.persona}
          slug={ws.slug}
          getToken={token}
          onClose={() => setOpen(null)}
          onDrafted={() => {
            if (open.status === 'new') void setContactStatus(open.id, 'drafted');
          }}
          onContacted={() => setContactStatus(open.id, 'contacted')}
        />
      )}
    </div>
  );
}

function ContactCard({
  contact: c,
  onEmail,
  onStatus,
}: {
  contact: OutreachContact;
  onEmail: () => void;
  onStatus: (s: OutreachStatus) => void;
}) {
  const host = c.website ? hostOf(c.website) : undefined;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{c.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{c.subtype}</p>
        </div>
        <select
          aria-label={`Status for ${c.name}`}
          value={c.status}
          onChange={(e) => onStatus(e.target.value as OutreachStatus)}
          className={cn(
            'h-7 shrink-0 rounded-md border bg-background px-1.5 text-xs',
            (c.status === 'contacted' || c.status === 'replied') && 'border-primary text-primary',
          )}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {OUTREACH_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid gap-1 text-sm">
        {distinctByVenue(c.reasons).map((r) => (
          <li key={r} className="text-pretty">
            {r}
          </li>
        ))}
      </ul>
      {c.suggestedOffer && (
        <p className="flex gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-sm">
          <TagIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium">Brief suggests:</span> {c.suggestedOffer}
          </span>
        </p>
      )}

      <dl className="grid gap-1 text-sm">
        {c.address && (
          <Detail icon={MapPinIcon} label="Address">
            {c.mapsUrl ? (
              <a
                href={c.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {c.address}
              </a>
            ) : (
              c.address
            )}
          </Detail>
        )}
        {c.phone && (
          <Detail icon={PhoneIcon} label="Phone">
            <a href={`tel:${c.phone}`} className="hover:underline">
              {formatPhone(c.phone)}
            </a>
          </Detail>
        )}
        {c.website && (
          <Detail icon={GlobeIcon} label="Website">
            <a
              href={c.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {host}
            </a>
          </Detail>
        )}
        {c.instagram && (
          <Detail icon={AtSignIcon} label="Instagram">
            <a
              href={c.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {c.instagram.replace('https://www.instagram.com/', '@')}
            </a>
          </Detail>
        )}
        {c.hours && (
          <Detail icon={ClockIcon} label="Hours on show day">
            {c.hours === 'closed' ? 'Closed on show day' : c.hours}
          </Detail>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={onEmail}>
          <MailIcon />
          Write email
        </Button>
        <span className="flex flex-wrap gap-1">
          {c.shows.slice(0, 2).map((s) => (
            <Badge key={s.runId} variant="outline" className="font-normal">
              {s.label}
            </Badge>
          ))}
        </span>
      </div>
    </li>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof PhoneIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 pt-0.5">
        <Icon className="size-3.5 text-muted-foreground" aria-label={label} />
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** One reason per venue: the same bar near the same room for two dates says the same thing. */
function distinctByVenue(reasons: string[]) {
  const seen = new Set<string>();
  return reasons
    .filter((r) => {
      const key = r.split(';')[0] ?? r;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** +17183023770 → (718) 302-3770; other formats pass through. */
function formatPhone(p: string) {
  const m = p.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
