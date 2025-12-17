import * as React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

export function Progress(props: {
  value: number; // 0..100
  className?: string;
}) {
  const value = Number.isFinite(props.value) ? Math.min(100, Math.max(0, props.value)) : 0;
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-100', props.className)}
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      role="progressbar"
    >
      <div
        className="h-full bg-blue-600 transition-[width] duration-200"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}


