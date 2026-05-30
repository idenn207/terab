import type { TrashItem } from '@/entities/trash';
import { Button } from '@/shared/ui';
import { useState } from 'react';
import { PurgeConfirmDialog } from './PurgeConfirmDialog';

interface PurgeButtonProps {
  itemId: string;
  itemType: TrashItem['type'];
  itemName: string;
}

export function PurgeButton({ itemId, itemType, itemName }: PurgeButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button variant="filled" tone="danger" type="button" onClick={() => setIsDialogOpen(true)} aria-label={`${itemName} 영구 삭제`}>
        영구 삭제
      </Button>
      <PurgeConfirmDialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} itemId={itemId} itemType={itemType} itemName={itemName} />
    </>
  );
}
