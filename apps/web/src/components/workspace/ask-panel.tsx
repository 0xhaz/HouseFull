'use client';

import { useAuth } from '@clerk/nextjs';
import type { Persona } from '@housefull/shared';
import { ArrowUpIcon, FileTextIcon, LoaderIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type AskAnswer, askWorkspace } from '@/lib/client-api';
import { useWorkspace } from '@/lib/workspace-context';

const SUGGESTIONS: Record<Persona, string[]> = {
  promoter: [
    'Which show needs the most help this week?',
    'Where should the next $500 go?',
    'Which audience is converting best so far?',
  ],
  venue: [
    'Who does my room draw?',
    'Which partner should I call first, and why?',
    'Which upcoming show fits my room best?',
  ],
  artist: [
    'What carries over between cities?',
    'How do the new fans differ by city?',
    'Which city needs the most push?',
  ],
};

/** "Ask your workspace": grounded answers over this workspace's briefs and results. */
export function AskPanel() {
  const ws = useWorkspace();
  const { getToken } = useAuth();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  if (!ws) return null;
  const workspace = ws;

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setAsked(text);
    setError(null);
    setAnswer(null);
    try {
      setAnswer(
        await askWorkspace(workspace.slug, text, workspace.isDemo ? null : await getToken()),
      );
      setQuestion('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section aria-labelledby="ask-heading" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="ask-heading" className="flex items-center gap-2 font-medium">
        <SparklesIcon className="size-4 text-primary" aria-hidden />
        Ask your workspace
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Answers come only from this workspace&apos;s briefs and results, with links to the source.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Your question
        </label>
        <Input
          id={inputId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={SUGGESTIONS[workspace.persona][0]}
          maxLength={500}
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={busy || question.trim().length < 3}
          aria-label="Ask"
        >
          {busy ? <LoaderIcon className="animate-spin" /> : <ArrowUpIcon />}
        </Button>
      </form>
      {!asked && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTIONS[workspace.persona].map((s) => (
            <li key={s}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal py-1 text-left"
                onClick={() => ask(s)}
              >
                {s}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {asked && (
        <div className="mt-4 grid gap-3" aria-live="polite">
          <p className="text-sm font-medium">{asked}</p>
          {busy && <p className="text-sm text-muted-foreground">Reading your briefs…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {answer && (
            <>
              <p className="text-sm leading-relaxed text-pretty">{answer.answer}</p>
              {answer.sources.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Sources">
                  {answer.sources.map((s) => (
                    <li key={s.ref}>
                      <Link
                        href={`/runs/${s.runId}/brief`}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
                      >
                        <FileTextIcon className="size-3" aria-hidden />
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {answer.followUps.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Follow-up questions">
                  {answer.followUps.map((f) => (
                    <li key={f}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto whitespace-normal py-1 text-left text-primary"
                        onClick={() => ask(f)}
                      >
                        {f}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
