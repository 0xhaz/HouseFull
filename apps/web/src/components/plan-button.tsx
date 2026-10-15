'use client';

import { LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startRun } from '@/lib/runs';
import { useRunContext } from '@/lib/workspace-context';

export function PlanButton({ presetId }: { presetId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const runContext = useRunContext();
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          router.push(`/runs/${await startRun({ presetId }, await runContext())}`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy && <LoaderIcon className="size-3.5 animate-spin" />}
      Plan campaign
    </Button>
  );
}
