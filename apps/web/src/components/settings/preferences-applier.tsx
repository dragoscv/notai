'use client';

import { useEffect } from 'react';
import { useAppPreferences } from '@/lib/preferences';

/**
 * Reflects the current `AppPreferences` onto the `<html>` element so
 * components can react via CSS (via the `--editor-max-w` var / `data-*`
 * attrs) without each prop-drilling the values.
 *
 * Mounted once near the root layout. Renders nothing.
 */
export function PreferencesApplier() {
  const [prefs] = useAppPreferences();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.editorWidth = prefs.editorWidth;
    html.spellcheck = prefs.spellcheck;
  }, [prefs.editorWidth, prefs.spellcheck]);

  return null;
}
