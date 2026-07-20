import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/login', '/signup', '/verify', '/password/reset', '/me', '/me/account']) {
  test(`account route ${path} has no automatic accessibility violations @a11y`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
