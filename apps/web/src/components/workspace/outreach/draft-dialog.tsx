'use client';

import {
  OUTREACH_PURPOSES,
  type OutreachContact,
  type OutreachDraft,
  type Persona,
} from '@housefull/shared';
import { CheckIcon, CopyIcon, LoaderIcon, MailIcon, SparklesIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { draftOutreachEmail } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/**
 * Pick a purpose, get a draft grounded in the briefs, edit it, then copy it or open it in
 * the user's own email app. HouseFull never sends anything.
 */
export function DraftDialog({
  contact,
  persona,
  slug,
  getToken,
  onClose,
  onDrafted,
  onContacted,
}: {
  contact: OutreachContact;
  persona: Persona;
  slug: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onDrafted: () => void;
  onContacted: () => void;
}) {
  const purposes = OUTREACH_PURPOSES[persona][contact.kind];
  const [purpose, setPurpose] = useState(purposes[0]?.id ?? '');
  const [runId, setRunId] = useState(contact.shows[0]?.runId ?? '');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ids = { note: useId(), subject: useId(), body: useId(), show: useId() };

  async function generate() {
    setBusy(true);
    try {
      setDraft(
        await draftOutreachEmail(
          slug,
          { contactId: contact.id, runId, purpose, note: note.trim() || undefined },
          await getToken(),
        ),
      );
      onDrafted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Couldn’t copy. Select the text and copy it instead.');
    }
  }

  const mailto = draft
    ? `mailto:?${new URLSearchParams({ subject: draft.subject, body: draft.body })
        .toString()
        .replace(/\+/g, '%20')}`
    : undefined;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {contact.name}</DialogTitle>
          <DialogDescription>
            Drafted from your briefs. Edit it, then copy it or open it in your email app. Nothing is
            sent from HouseFull.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">What do you want to ask for?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {purposes.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'cursor-pointer rounded-lg border p-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  purpose === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="purpose"
                  value={p.id}
                  checked={purpose === p.id}
                  onChange={() => setPurpose(p.id)}
                  className="sr-only"
                />
                <span className="font-medium">{p.label}</span>
                <span className="mt-0.5 block text-muted-foreground">{p.brief}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {contact.shows.length > 1 && (
          <div className="grid gap-1.5">
            <Label htmlFor={ids.show}>About which show?</Label>
            <select
              id={ids.show}
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {contact.shows.map((s) => (
                <option key={s.runId} value={s.runId}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor={ids.note}>
            Anything to include?{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={ids.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={
              contact.suggestedOffer
                ? `Brief suggests: ${contact.suggestedOffer}`
                : 'e.g. we can offer two guest-list spots'
            }
          />
        </div>

        <div>
          <Button type="button" onClick={generate} disabled={busy || !purpose}>
            {busy ? <LoaderIcon className="animate-spin" /> : <SparklesIcon />}
            {draft ? 'Draft again' : 'Draft the email'}
          </Button>
        </div>

        {draft && (
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor={ids.subject}>Subject</Label>
              <Input
                id={ids.subject}
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.body}>Message</Label>
              <Textarea
                id={ids.body}
                value={draft.body}
                rows={12}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Replace [Your name] before sending.
                {contact.website ? ' Their email is usually on their website.' : ''}
              </p>
            </div>
          </div>
        )}

        {draft && (
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild variant="outline">
              <a href={mailto}>
                <MailIcon />
                Open in email app
              </a>
            </Button>
            <Button
              type="button"
              onClick={() => {
                onContacted();
                onClose();
              }}
            >
              Mark as contacted
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
