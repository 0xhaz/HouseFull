import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'Post-show survey' };

async function Id({ params }: { params: PageProps<'/s/[id]'>['params'] }) {
  const { id } = await params;
  return <code className="font-mono text-xs">{id}</code>;
}

export default function Page({ params }: PageProps<'/s/[id]'>) {
  return (
    <PagePlaceholder title="Post-show survey" phase="Phase 2">
      <p>
        Anonymous survey{' '}
        <Suspense fallback={null}>
          <Id params={params} />
        </Suspense>
      </p>
    </PagePlaceholder>
  );
}
