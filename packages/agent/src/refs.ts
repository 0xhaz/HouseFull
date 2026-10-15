import type { QlooEntity } from '@housefull/qloo-client';
import type { QlooRef } from '@housefull/shared';

export function toRef(e: QlooEntity, sourceRef: string): QlooRef {
  return {
    entityId: e.entity_id,
    name: e.name,
    type: e.subtype ?? e.type ?? 'urn:entity',
    affinity: e.query?.affinity,
    sourceRef,
  };
}
