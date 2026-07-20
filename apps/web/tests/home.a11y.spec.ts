import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home has an accessible document landmark @a11y', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
