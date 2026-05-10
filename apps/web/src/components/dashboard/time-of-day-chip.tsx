'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';

/**
 * Ambient time-of-day chip — counters time-blindness by showing where
 * you are in the day at a glance, with a soft "X hours until evening"
 * label. Updates every minute. Strictly ambient; never blocks input.
 */
const SEGMENTS = [
  { name: 'Early morning', from: 5, to: 8 },
  { name: 'Morning', from: 8, to: 12 },
  { name: 'Afternoon', from: 12, to: 17 },
  { name: 'Evening', from: 17, to: 21 },
  { name: 'Night', from: 21, to: 29 }, // wraps past midnight
];

function currentSegment(hour: number) {
  const h = hour < 5 ? 24 + hour : hour;
  for (const s of SEGMENTS) {
    if (h >= s.from && h < s.to) return s;
  }
  return SEGMENTS[SEGMENTS.length - 1]!;
}

export function TimeOfDayChip() {
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const hour = now.getHours();
  const seg = currentSegment(hour);
  const next = SEGMENTS[(SEGMENTS.indexOf(seg) + 1) % SEGMENTS.length]!;
  const minsToNext = ((seg.to - hour) * 60 - now.getMinutes() + 60 * 24) % (60 * 24);
  const hoursToNext = Math.max(0, Math.floor(minsToNext / 60));
  const remMins = Math.max(0, minsToNext % 60);
  const label =
    hoursToNext > 0
      ? `${hoursToNext}h ${remMins}m to ${next.name.toLowerCase()}`
      : `${remMins}m to ${next.name.toLowerCase()}`;

  return (
    <span
      className="bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      title={now.toLocaleTimeString()}
    >
      <Clock className="size-3" />
      <span className="text-foreground font-medium">{seg.name}</span>
      <span className="opacity-60">·</span>
      <span>{label}</span>
    </span>
  );
}
