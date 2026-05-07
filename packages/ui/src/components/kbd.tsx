import * as React from 'react';
import { cn } from '@notai/lib/utils';

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium',
        className,
      )}
      {...props}
    />
  ),
);
Kbd.displayName = 'Kbd';
