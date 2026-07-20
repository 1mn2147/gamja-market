import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/chats', '/chats/example', '/reports/new', '/me/blocked-users', '/me/reports']) {
  test(`WBS-04 route ${path} has no automatic accessibility violations @a11y`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
