'use client';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface NoticeState {
  title: string;
  message: string;
}

export function NoticeDialog(props: {
  notice: NoticeState | null;
  onClose: () => void;
}) {
  const { notice, onClose } = props;
  return (
    <Dialog open={!!notice} onOpenChange={(open) => !open && onClose()} title={notice?.title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{notice?.message}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
}


