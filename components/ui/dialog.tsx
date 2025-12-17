'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

export function Dialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { open, onOpenChange, title, children } = props;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Dialog'}
          className={cn(
            'w-full max-w-3xl rounded-xl bg-white shadow-xl',
            'border border-gray-200'
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <div className="min-w-0">
              {title ? <h2 className="text-sm font-semibold text-gray-900">{title}</h2> : null}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-[80vh] overflow-auto p-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}


