'use client';

import { CITY_META, type City } from '@housefull/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseCity } from '@/lib/city';

export function CitySwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const city = parseCity(searchParams.get('city'));

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('city', next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  return (
    <Select value={city} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="City" className="w-32 sm:w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CITY_META) as City[]).map((c) => (
          <SelectItem key={c} value={c}>
            {CITY_META[c].name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
