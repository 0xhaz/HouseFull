import { createHmac, randomBytes } from 'node:crypto';
import type { TrackingLink } from '@housefull/shared';

// Crockford-style alphabet: no 0/O or 1/I/L, so codes survive being read aloud or printed.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** Short code like `hf-7k2m`. 31^4 ≈ 920k per length; callers retry on a collision. */
export function generateCode(length = 4, bytes: (n: number) => Uint8Array = randomBytes): string {
  const buf = bytes(length);
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[(buf[i] as number) % ALPHABET.length];
  return `hf-${code}`;
}

export const CODE_PATTERN = /^hf-[2-9a-hjkmnp-z]{4,8}$/;

/**
 * Dedupe key for a click: HMAC of (ip, user agent, day) under a secret salt.
 * Only this hash is stored; the raw IP and user agent never reach the database,
 * and a new day means a new hash, so clicks can't be linked across days.
 */
export function clickDedupeHash(input: {
  ip: string;
  userAgent: string;
  day: string;
  salt: string;
}) {
  return createHmac('sha256', input.salt)
    .update(`${input.day}\n${input.ip}\n${input.userAgent}`)
    .digest('hex')
    .slice(0, 32);
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

/**
 * Decision #23: send to the promoter's sign-up page when the show is more than
 * 21 days out, or the segment converts below the median after a check-in;
 * otherwise straight to tickets.
 */
export function chooseDestination(input: {
  daysOut: number;
  segmentConversion?: number;
  medianConversion?: number;
  hasSignupPage: boolean;
}): TrackingLink['destination'] {
  if (!input.hasSignupPage) return 'tickets';
  if (input.daysOut > 21) return 'signup';
  const { segmentConversion: seg, medianConversion: median } = input;
  if (seg !== undefined && median !== undefined && seg < median) return 'signup';
  return 'tickets';
}

/** Only absolute http(s) URLs are allowed as targets, so `/r/:code` can't become a javascript: or data: redirect. */
export function isSafeTargetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
