'use client';

import { PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon className="size-3.5" />
      Save as PDF
    </Button>
  );
}
