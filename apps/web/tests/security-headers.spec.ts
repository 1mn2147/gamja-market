import { expect, test } from '@playwright/test';

test('WBS-09 applies browser security headers to every route', async ({ request }) => {
  const response = await request.get('/reports/new');
  expect(response.ok()).toBe(true);
  const headers = response.headers();

  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  expect(headers['x-content-type-options']).toBe('nosniff');

  const policy = headers['content-security-policy'];
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("script-src 'self' 'unsafe-inline' https://js.tosspayments.com");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("form-action 'self'");
});
