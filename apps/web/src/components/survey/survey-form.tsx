'use client';

import type { SurveyAnswer, SurveyInfo } from '@housefull/shared';
import { CheckIcon, LoaderIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { toast } from 'sonner';
import { postSurveyAnswer } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const RATING_WORDS = ['', 'Not for me', 'It was OK', 'Good night', 'Great night', 'Unforgettable'];

/** The post-show survey: anonymous, two minutes, nothing required but the stars. */
export function SurveyForm({ info }: { info: SurveyInfo }) {
  const [rating, setRating] = useState(0);
  const [again, setAgain] = useState<boolean | undefined>();
  const [likes, setLikes] = useState<string[]>([]);
  const [via, setVia] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const commentId = useId();

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return toast.error('Pick a star rating first');
    setBusy(true);
    try {
      await postSurveyAnswer(info.surveyId, {
        rating,
        wouldReturn: again,
        heardVia: via as SurveyAnswer['heardVia'],
        alsoLikes: likes,
        tags: tags as SurveyAnswer['tags'],
        comment: comment.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="grid justify-items-center gap-4 rounded-3xl border bg-card p-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-7" aria-hidden />
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight">Thanks for coming!</h2>
        <p className="max-w-md text-muted-foreground text-pretty">
          Your answers help {info.show.venue} and the organizers book more nights you’ll love.
        </p>
        <Link
          href="/tonight"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
        >
          Find your next show →
        </Link>
      </div>
    );

  const shown = rating;
  return (
    <form onSubmit={submit} className="grid gap-5">
      <Question title="How was the show?" required>
        {/* Native radios styled as stars: arrow keys and screen readers work as expected. */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-lg p-1 transition-transform hover:scale-110 has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className="sr-only">
                {n} star{n > 1 ? 's' : ''}
              </span>
              <StarIcon
                aria-hidden
                className={cn(
                  'size-10',
                  n <= shown ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
                )}
              />
            </label>
          ))}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {RATING_WORDS[shown]}
          </span>
        </div>
      </Question>

      <Question title="Would you come to another show like this?">
        <div className="flex gap-2">
          {[
            [true, 'Yes'],
            [false, 'Not really'],
          ].map(([v, label]) => (
            <Chip
              key={String(v)}
              on={again === v}
              onClick={() => setAgain(again === v ? undefined : (v as boolean))}
            >
              {label as string}
            </Chip>
          ))}
        </div>
      </Question>

      <Question
        title="Which of these artists do you also like?"
        hint="Pick any. It helps book the right openers and nights."
      >
        <div className="flex flex-wrap gap-2">
          {info.options.map((o) => (
            <Chip
              key={o.entityId}
              on={likes.includes(o.entityId)}
              onClick={() => setLikes(toggle(likes, o.entityId))}
            >
              {o.name}
            </Chip>
          ))}
        </div>
      </Question>

      <Question title="How did you hear about it?">
        <div className="flex flex-wrap gap-2">
          {info.heardVia.map((h) => (
            <Chip key={h} on={via === h} onClick={() => setVia(via === h ? undefined : h)}>
              {h}
            </Chip>
          ))}
        </div>
      </Question>

      <Question title="What stood out?">
        <div className="flex flex-wrap gap-2">
          {info.tags.map((t) => (
            <Chip key={t} on={tags.includes(t)} onClick={() => setTags(toggle(tags, t))}>
              {t}
            </Chip>
          ))}
        </div>
      </Question>

      <Question
        title="Anything else?"
        hint="Optional. Please don’t include names or contact details."
      >
        <label htmlFor={commentId} className="sr-only">
          Comment
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Question>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !rating}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy && <LoaderIcon className="size-4 animate-spin" />}
          Send
        </button>
        <span className="text-xs text-muted-foreground">
          Anonymous: no name, email or IP address is stored with your answers.
        </span>
      </div>
    </form>
  );
}

function Question({
  title,
  hint,
  required,
  children,
}: {
  title: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border bg-card p-5">
      <legend className="sr-only">{title}</legend>
      <p className="font-semibold" aria-hidden>
        {title}
        {required && <span className="text-primary"> *</span>}
      </p>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
