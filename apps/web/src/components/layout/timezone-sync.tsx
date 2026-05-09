'use client';
import * as React from 'react';
import { setUserTimezone } from '@/server/actions/timezone';

const STORAGE_KEY = 'notai:tz-synced';

/**
 * Detects the browser's IANA timezone and posts it to the server once
 * per session if it changed. Mounted in the app layout; renders nothing.
 *
 * We cache the last-synced value in localStorage so we don't spam the
 * server on every page navigation — only the first mount per browser
 * (or after the user travels through a time zone) hits the network.
 */
export function TimezoneSync({ initialTimezone }: { initialTimezone: string | null }) {
  React.useEffect(() => {
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    const cached = (() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    if (cached === tz && initialTimezone === tz) return;

    void setUserTimezone(tz)
      .then((res) => {
        if (res.ok) {
          try {
            window.localStorage.setItem(STORAGE_KEY, tz);
          } catch {
            /* quota — ignore */
          }
        }
      })
      .catch(() => {
        /* network/auth failure — try again next mount */
      });
  }, [initialTimezone]);

  return null;
}
