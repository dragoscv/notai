'use client';
import * as React from 'react';
import { Check, Monitor, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { APP_THEMES } from './theme-provider';

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = mounted ? theme : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <Palette className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor />
          <span className="flex-1">System</span>
          {current === 'system' && <Check className="size-3.5 opacity-70" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {APP_THEMES.map((t) => {
          const active = current === t.id || (current === 'system' && resolvedTheme === t.id);
          return (
            <DropdownMenuItem key={t.id} onClick={() => setTheme(t.id)}>
              <span
                aria-hidden
                className="ring-border grid size-4 shrink-0 place-items-center overflow-hidden rounded-full ring-1"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                }}
              />
              <span className="flex-1">{t.label}</span>
              <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">
                {t.mode}
              </span>
              {active && <Check className="size-3.5 opacity-70" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
