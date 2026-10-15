import { createHmac } from 'node:crypto';

/** Salted per-day hash of the caller's IP: enough for per-IP limits, useless for tracking people. */
export function dailyIpHash(ip: string, now = new Date()): string {
  const salt = process.env.CLICK_SALT || 'dev-only-click-salt';
  return createHmac('sha256', salt)
    .update(`${now.toISOString().slice(0, 10)}\n${ip}`)
    .digest('hex')
    .slice(0, 24);
}
