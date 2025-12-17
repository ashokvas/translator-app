'use client';

import * as React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

export function Select(props: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { id, value, onValueChange, disabled, className, children } = props;
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        'disabled:bg-gray-50 disabled:text-gray-400',
        className
      )}
    >
      {children}
    </select>
  );
}

export function SelectItem(props: { value: string; children: React.ReactNode }) {
  return <option value={props.value}>{props.children}</option>;
}


