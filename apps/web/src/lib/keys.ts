/**
 * Stable React keys from content. Listings can repeat (a concert series lists the same show
 * at several times), so a repeat gets "~2", "~3" instead of colliding.
 */
export function keyed<T>(items: readonly T[], key: (item: T) => string): Array<[string, T]> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const k = key(item);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return [n === 1 ? k : `${k}~${n}`, item];
  });
}
