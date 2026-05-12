import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility smoke test on key public pages. Fails on serious /
 * critical violations only — moderate/minor are reported but tolerated
 * to avoid blocking CI on known shadcn / 3rd-party issues.
 *
 * Run locally:  pnpm --filter @notai/web e2e
 * Run focused:  pnpm --filter @notai/web exec playwright test a11y
 */
const PUBLIC_PAGES = [
  '/',
  '/features',
  '/pricing',
  '/about',
  '/docs',
  '/docs/getting-started',
  '/changelog',
  '/roadmap',
  '/status',
  '/faq',
  '/privacy-policy',
  '/terms',
  '/refund',
  '/aup',
  '/cookies',
  '/accessibility',
  '/signin',
];

for (const path of PUBLIC_PAGES) {
  test(`a11y: ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // brand palette tuning is design work, not blocker
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (blocking.length) {
      console.log(JSON.stringify(blocking, null, 2));
    }
    expect(blocking, `serious/critical a11y violations on ${path}`).toHaveLength(0);
  });
}
