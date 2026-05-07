'use client';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

export const APP_THEMES = [
  { id: 'paper', label: 'Paper', mode: 'light', swatch: ['#fbfaf5', '#7e63d6'] },
  { id: 'mocha', label: 'Mocha', mode: 'light', swatch: ['#f1ead8', '#a06a3a'] },
  { id: 'midnight', label: 'Midnight', mode: 'dark', swatch: ['#0c0a13', '#a78bfa'] },
  { id: 'oled', label: 'OLED Black', mode: 'dark', swatch: ['#000000', '#3aa6ff'] },
  { id: 'slate', label: 'Slate', mode: 'dark', swatch: ['#161b22', '#5fc4ff'] },
  { id: 'rose', label: 'Rose', mode: 'dark', swatch: ['#1c1316', '#f08aa0'] },
  { id: 'forest', label: 'Forest', mode: 'dark', swatch: ['#121a16', '#5fd6a3'] },
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]['id'];

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      // Include 'light'/'dark' so legacy stored values (and `enableSystem`'s
      // resolved keys) map correctly via the `value` table below.
      themes={[...APP_THEMES.map((t) => t.id), 'light', 'dark']}
      defaultTheme="system"
      enableSystem
      // next-themes treats `value` as exhaustive — themes missing from this
      // map have their attribute removed entirely. Map every theme to itself
      // and add `light`/`dark` aliases for the system resolver.
      value={{
        light: 'paper',
        dark: 'midnight',
        ...Object.fromEntries(APP_THEMES.map((t) => [t.id, t.id])),
      }}
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
