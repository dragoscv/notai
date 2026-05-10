import { describe, it, expect } from 'vitest';
import { parseTaskLine, rollRecurringTasks, nextOccurrence, TODO_LINE_GLOBAL } from './tasks';

describe('parseTaskLine', () => {
  it('parses an open task with no markers', () => {
    const t = parseTaskLine('- [ ] write the report');
    expect(t).not.toBeNull();
    expect(t!.text).toBe('write the report');
    expect(t!.priority).toBeNull();
    expect(t!.estimateMin).toBeNull();
  });

  it('extracts @est minute estimates and strips them from the text', () => {
    const t = parseTaskLine('- [ ] write the report @est(15m)');
    expect(t!.estimateMin).toBe(15);
    expect(t!.text).toBe('write the report');
  });

  it('converts hour estimates to minutes', () => {
    const t = parseTaskLine('- [ ] deep work @est(2h)');
    expect(t!.estimateMin).toBe(120);
  });

  it('returns null on non-task lines', () => {
    expect(parseTaskLine('just a paragraph')).toBeNull();
    expect(parseTaskLine('# heading')).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('rolls a daily task to the next UTC midnight', () => {
    const next = nextOccurrence('daily', '2025-01-01T00:00:00.000Z');
    expect(next).not.toBeNull();
    expect(next!.startsWith('2025-01-02')).toBe(true);
  });

  it('rolls a weekly task by 7 days', () => {
    const next = nextOccurrence('weekly', '2025-01-01T00:00:00.000Z');
    expect(next).not.toBeNull();
    expect(next!.startsWith('2025-01-08')).toBe(true);
  });
});

describe('rollRecurringTasks', () => {
  it('appends a fresh open task after a completed @repeat line', () => {
    const input = '- [x] water the plants @repeat(daily) @due(2025-01-01)';
    const out = rollRecurringTasks(input);
    expect(out.rolled).toBe(1);
    expect(out.next).toContain('- [ ] water the plants');
    // Idempotent — running twice yields zero new rolls.
    expect(rollRecurringTasks(out.next).rolled).toBe(0);
  });

  it('does nothing for non-recurring done tasks', () => {
    const input = '- [x] one-off thing';
    const out = rollRecurringTasks(input);
    expect(out.rolled).toBe(0);
    expect(out.next).toBe(input);
  });
});

describe('TODO_LINE_GLOBAL', () => {
  it('counts only unchecked tasks', () => {
    const md = '- [ ] a\n- [x] b\n- [ ] c\n';
    const matches = md.match(TODO_LINE_GLOBAL);
    expect(matches?.length).toBe(2);
  });
});
