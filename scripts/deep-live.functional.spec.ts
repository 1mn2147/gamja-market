import { expect, request as playwrightRequest, test, type APIResponse, type Page } from '@playwright/test';

const runId = process.env.DEEP_RUN_ID ?? `deep-${Date.now()}`;
const webOrigin = process.env.DEEP_WEB_ORIGIN ?? 'http://localhost:3000';
const apiOrigin = process.env.DEEP_API_ORIGIN ?? 'http://localhost:4000/api/v1';
const password = 'DeepFunctional!2026-User';
const adminPassword = 'DeepFunctional!2026-Admin';
const emails = {
  seller: `${runId}-seller@example.test`,
  buyer: `${runId}-buyer@example.test`,
  outsider: `${runId}-outsider@example.test`,
  reset: `${runId}-reset@example.test`,
  withdraw: `${runId}-withdraw@example.test`,
  lock: `${runId}-lock@example.test`,
  admin: `${runId}-admin@example.test`,
};

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==', 'base64');
// A valid PNG may contain trailing bytes. The larger payload exercises the
// browser's base64 conversion and the API request-body limit that previously
// caused otherwise valid product uploads to fail.
const realisticUpload = Buffer.concat([tinyPng, Buffer.alloc(160 * 1024, 0x41)]);
const ids: Record<string, string> = {};

async function body(response: APIResponse) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>;
}

async function expectStatus(response: APIResponse, status: number, label: string) {
  const payload = await body(response);
  expect(response.status(), `${label}: ${response.status()} ${JSON.stringify(payload)}`).toBe(status);
  return payload;
}

async function activateByApi(email: string, userPassword = password) {
  const api = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  const signup = await api.post('auth/signups', { data: { email, password: userPassword, adultConfirmed: true } });
  const issued = await expectStatus(signup, 201, `signup ${email}`);
  const confirmation = await api.post('auth/contact-confirmations', { data: { identifier: email, code: issued.debugCode } });
  await expectStatus(confirmation, 201, `confirmation ${email}`);
  await api.dispose();
}

async function signupThroughBrowser(page: Page, email: string) {
  await page.goto(`${webOrigin}/signup`);
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel(/비밀번호/).fill(password);
  await page.getByLabel('만 19세 이상입니다.').check();
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await expect(page).toHaveURL(`${webOrigin}/verify`);
  const status = await page.getByRole('status').textContent();
  const code = status?.match(/\b(\d{6})\b/)?.[1];
  expect(code, `debug verification code missing from ${status}`).toBeTruthy();
  await page.getByLabel('6자리 인증 코드').fill(code!);
  await page.getByRole('button', { name: '인증 완료' }).click();
  await expect(page).toHaveURL(`${webOrigin}/login`);
}

async function login(page: Page, email: string, userPassword = password) {
  await page.goto(`${webOrigin}/login`);
  await page.getByLabel('이메일 또는 휴대전화').fill(email);
  await page.getByLabel('비밀번호').fill(userPassword);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(`${webOrigin}/me`);
  await expect(page.getByText(email, { exact: false })).toBeVisible();
}

async function api(page: Page, path: string, options: Parameters<Page['request']['fetch']>[1] = {}) {
  return page.request.fetch(`${apiOrigin}${path}`, options);
}

async function createProduct(page: Page, title: string, priceKrw = '27000') {
  const response = await api(page, '/products', {
    method: 'POST',
    data: {
      title,
      description: `${runId} 실제 DB 저장 검증 상품`,
      priceKrw,
      category: `심층테스트-${runId}`,
      images: [{ dataBase64: realisticUpload.toString('base64'), altText: `${title} 사진` }],
    },
  });
  return expectStatus(response, 201, `create product ${title}`);
}

test('deep live functional, persistence, authorization and operations journey', async ({ browser }) => {
  test.setTimeout(600_000);

  const sellerContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  const outsider = await outsiderContext.newPage();

  // AUTH: actual browser signup/verification/login for both marketplace roles.
  await signupThroughBrowser(seller, emails.seller);
  await login(seller, emails.seller);
  await signupThroughBrowser(buyer, emails.buyer);
  await login(buyer, emails.buyer);
  await activateByApi(emails.outsider);
  await login(outsider, emails.outsider);

  const duplicateApi = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  await expectStatus(await duplicateApi.post('auth/signups', { data: { email: emails.seller.toUpperCase(), password, adultConfirmed: true } }), 409, 'duplicate normalized contact');
  await expectStatus(await duplicateApi.get('auth/me'), 401, 'anonymous protected endpoint');
  const neighborhoods = await expectStatus(await duplicateApi.get('neighborhoods'), 200, 'service area');
  expect(neighborhoods.neighborhoods).toEqual([{ code: 'KR-CH-UC-SARIM', name: '사림동' }]);
  await duplicateApi.dispose();

  // ITEM/SEARCH: two larger valid photos through the real browser form.
  const title = `${runId} 실사용 감자`;
  const editedTitle = `${title} 수정완료`;
  await seller.goto(`${webOrigin}/products/new`);
  await seller.getByLabel('제목').fill(title);
  await seller.getByLabel('설명').fill(`${runId} 브라우저 업로드와 검색 검증 설명`);
  await seller.getByLabel('가격(원)').fill('27000');
  await seller.getByLabel('카테고리').fill(`심층테스트-${runId}`);
  await seller.getByLabel(/사진/).setInputFiles([
    { name: `${runId}-front.png`, mimeType: 'image/png', buffer: realisticUpload },
    { name: `${runId}-back.png`, mimeType: 'image/png', buffer: realisticUpload },
  ]);
  await expect(seller.getByRole('status')).toContainText('2장의 사진을 선택했습니다.');
  await seller.getByRole('button', { name: '상품 등록' }).click();
  await expect(seller).toHaveURL(/\/products\/(?!new$)[a-z0-9]+$/i);
  await expect(seller.getByRole('heading', { name: title })).toBeVisible();
  ids.product = seller.url().split('/').pop()!;
  await expect(seller.getByText('거래 지역: 사림동')).toBeVisible();
  await expect(seller.locator('img.product-image')).toHaveCount(2);

  await seller.goto(`${webOrigin}/products/${ids.product}/edit`);
  await seller.getByLabel('제목').fill(editedTitle);
  await seller.getByRole('button', { name: '변경 저장' }).click();
  await expect(seller.getByRole('heading', { name: editedTitle })).toBeVisible();

  await outsider.goto(`${webOrigin}/search`);
  await outsider.getByLabel('검색어').fill(runId);
  await outsider.getByRole('button', { name: '검색' }).click();
  await expect(outsider.getByRole('heading', { name: editedTitle })).toBeVisible();
  await expect(outsider.getByRole('article').filter({ hasText: editedTitle }).getByText('27,000원 · 사림동')).toBeVisible();

  const productDetail = await expectStatus(await api(seller, `/products/${ids.product}`), 200, 'product detail');
  expect(productDetail.images).toHaveLength(2);
  const imageResponse = await seller.request.get(`http://localhost:4000${productDetail.images[0].url}`);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/png');
  expect((await imageResponse.body()).byteLength).toBe(realisticUpload.byteLength);
  await expectStatus(await api(outsider, `/products/${ids.product}`, { method: 'PATCH', data: { title: '권한 탈취' } }), 404, 'product IDOR');
  await expectStatus(await api(seller, '/products', {
    method: 'POST',
    data: { title: '위장 파일', description: '보안 음수 테스트', priceKrw: '1', category: 'test', images: [{ dataBase64: Buffer.from('not-a-real-png').toString('base64'), altText: '위장' }] },
  }), 400, 'image magic-byte rejection');

  // CHAT/SAFE: REST creation, actual Socket.IO send, stored XSS inertness, IDOR and immediate block.
  const chat = await expectStatus(await api(buyer, `/products/${ids.product}/chats`, { method: 'POST' }), 201, 'chat create');
  ids.chat = chat.id;
  await buyer.goto(`${webOrigin}/chats/${ids.chat}`);
  await expect(buyer.getByRole('heading', { name: editedTitle })).toBeVisible();
  const xssMessage = `<img src=x onerror=window.__deepXss=1>${runId}`;
  await buyer.getByLabel('메시지').fill(xssMessage);
  await buyer.getByRole('button', { name: '전송' }).click();
  await expect(buyer.getByRole('listitem').filter({ hasText: xssMessage })).toBeVisible();
  expect(await buyer.evaluate(() => (window as any).__deepXss)).toBeUndefined();
  const chatDetail = await expectStatus(await api(buyer, `/chats/${ids.chat}`), 200, 'chat detail');
  ids.message = chatDetail.messages.at(-1).id;
  await expectStatus(await api(outsider, `/chats/${ids.chat}`), 404, 'chat participant IDOR');

  const sellerMe = await expectStatus(await api(seller, '/auth/me'), 200, 'seller identity');
  const buyerMe = await expectStatus(await api(buyer, '/auth/me'), 200, 'buyer identity');
  ids.seller = sellerMe.user.id;
  ids.buyer = buyerMe.user.id;
  const block = await expectStatus(await api(buyer, '/blocks', { method: 'POST', data: { userId: ids.seller } }), 201, 'block user');
  expect(block.blockedId).toBe(ids.seller);
  await expectStatus(await api(buyer, `/chats/${ids.chat}`), 403, 'blocked chat read');
  await expectStatus(await api(buyer, `/chats/${ids.chat}/messages`, { method: 'POST', data: { body: 'blocked write' } }), 403, 'blocked chat write');
  await buyer.goto(`${webOrigin}/me/blocked-users`);
  const blockedUserRow = buyer.locator('main li').filter({ has: buyer.getByRole('button', { name: '차단 해제' }) });
  await expect(blockedUserRow).toContainText('사용자');
  await blockedUserRow.getByRole('button', { name: '차단 해제' }).click();
  await expect(buyer.getByRole('status')).toContainText('차단한 사용자가 없습니다.');
  await expectStatus(await api(buyer, `/chats/${ids.chat}`), 200, 'chat restored after unblock');

  await buyer.goto(`${webOrigin}/reports/new`);
  await buyer.getByLabel('대상 유형').selectOption('MESSAGE');
  await buyer.getByLabel('대상 ID').fill(ids.message);
  await buyer.getByLabel('사유').fill('심층 보안 테스트 신고');
  await buyer.getByLabel('상세').fill(`${runId} 실제 메시지 신고 저장 검증`);
  await buyer.getByRole('button', { name: '신고 접수' }).click();
  await expect(buyer.getByRole('status')).toContainText('신고가 접수되었습니다.');
  await buyer.getByRole('button', { name: '신고 접수' }).click();
  await expect(buyer.getByRole('status')).toContainText('이미 접수된 대상입니다.');
  const myReports = await expectStatus(await api(buyer, '/reports/me'), 200, 'my reports');
  ids.report = myReports.reports.find((report: any) => report.targetId === ids.message).id;
  await buyer.goto(`${webOrigin}/me/reports`);
  await expect(buyer.getByText('심층 보안 테스트 신고')).toBeVisible();

  // TRADE/PAY: real UI request -> seller accept -> buyer sandbox approval -> delivery -> confirmation.
  await buyer.goto(`${webOrigin}/products/${ids.product}`);
  await buyer.getByRole('button', { name: '판매자에게 거래 요청' }).click();
  await expect(buyer).toHaveURL(/\/trades\/[a-z0-9]+$/i);
  ids.trade = buyer.url().split('/').pop()!;
  await seller.goto(`${webOrigin}/trades/${ids.trade}`);
  await seller.getByRole('button', { name: '거래 요청 수락' }).click();
  await expect(seller.getByText('27,000원 · 판매자 수락', { exact: true })).toBeVisible();
  await expect(seller.getByRole('button', { name: '인도 완료로 표시' })).toHaveCount(0);
  await buyer.reload();
  await buyer.getByRole('button', { name: '에스크로 결제하기' }).click();
  await expect(buyer).toHaveURL(/\/payments\//);
  ids.order = buyer.url().split('/').pop()!;
  await buyer.getByRole('button', { name: '로컬 샌드박스 승인' }).click();
  await expect(buyer.getByText(/^결제 APPROVED · 정산 /)).toBeVisible();
  await seller.reload();
  await seller.getByRole('button', { name: '인도 완료로 표시' }).click();
  await expect(seller.getByText('27,000원 · 인도 완료', { exact: true })).toBeVisible();
  await buyer.goto(`${webOrigin}/trades/${ids.trade}`);
  await buyer.getByRole('button', { name: '구매 확정하기' }).click();
  await expect(buyer.getByText('27,000원 · 구매 확정', { exact: true })).toBeVisible();
  const tradeDetail = await expectStatus(await api(buyer, `/trades/${ids.trade}`), 200, 'confirmed trade detail');
  expect(tradeDetail.history.map((event: any) => event.toStatus)).toEqual(['REQUESTED', 'ACCEPTED', 'DELIVERED', 'CONFIRMED']);
  await expectStatus(await api(outsider, `/trades/${ids.trade}`), 404, 'trade participant IDOR');

  // Idempotency, cancellation, dispute, and locked-product mutation on additional real records.
  const idemProduct = await createProduct(seller, `${runId} 멱등성 상품`, '31000');
  ids.idemProduct = idemProduct.id;
  const idemTrade = await expectStatus(await api(buyer, '/trades', { method: 'POST', data: { productId: ids.idemProduct } }), 201, 'idempotency trade');
  ids.idemTrade = idemTrade.id;
  await expectStatus(await api(seller, `/trades/${ids.idemTrade}/accept`, { method: 'POST' }), 201, 'accept idempotency trade');
  await expectStatus(await api(seller, `/products/${ids.idemProduct}`, { method: 'PATCH', data: { priceKrw: '1' } }), 409, 'reserved product lock');
  const orderKey = `${runId}-order-key`;
  const firstOrder = await expectStatus(await api(buyer, '/payments/orders', { method: 'POST', headers: { 'idempotency-key': orderKey }, data: { tradeId: ids.idemTrade } }), 201, 'payment order');
  const duplicateOrder = await expectStatus(await api(buyer, '/payments/orders', { method: 'POST', headers: { 'idempotency-key': orderKey }, data: { tradeId: ids.idemTrade } }), 201, 'payment order duplicate');
  expect(duplicateOrder.id).toBe(firstOrder.id);
  ids.idemPayment = firstOrder.id;
  ids.idemOrder = firstOrder.orderId;
  const confirmData = { paymentKey: `${runId}-sandbox-key`, orderId: ids.idemOrder, amountKrw: '31000' };
  const confirmKey = `${runId}-confirm-key`;
  await expectStatus(await api(buyer, `/payments/${ids.idemOrder}/confirm`, { method: 'POST', headers: { 'idempotency-key': confirmKey }, data: confirmData }), 201, 'payment confirm');
  await expectStatus(await api(buyer, `/payments/${ids.idemOrder}/confirm`, { method: 'POST', headers: { 'idempotency-key': confirmKey }, data: confirmData }), 201, 'payment confirm duplicate');
  const cancellationKey = `${runId}-cancel-payment`;
  await expectStatus(await api(buyer, `/payments/${ids.idemOrder}/cancel`, { method: 'POST', headers: { 'idempotency-key': cancellationKey }, data: { reason: '심층 취소 검증' } }), 201, 'payment cancellation');
  const cancelledTrade = await expectStatus(await api(buyer, `/trades/${ids.idemTrade}`), 200, 'payment-linked trade cancellation');
  expect(cancelledTrade).toMatchObject({ status: 'CANCELLED', reason: '심층 취소 검증' });

  const disputeProduct = await createProduct(seller, `${runId} 분쟁 상품`, '19000');
  const disputeTrade = await expectStatus(await api(buyer, '/trades', { method: 'POST', data: { productId: disputeProduct.id } }), 201, 'dispute trade');
  ids.disputeTrade = disputeTrade.id;
  await expectStatus(await api(seller, `/trades/${ids.disputeTrade}/accept`, { method: 'POST' }), 201, 'accept dispute trade');
  await expectStatus(await api(buyer, `/trades/${ids.disputeTrade}/dispute`, { method: 'POST', data: { reason: '상품 상태 분쟁 심층 검증' } }), 201, 'open dispute');

  // AUTH lifecycle: reset invalidates sessions, withdrawal prevents login, throttle locks.
  await activateByApi(emails.reset);
  const resetContext = await browser.newContext();
  const resetPage = await resetContext.newPage();
  await login(resetPage, emails.reset);
  const resetRequestContext = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  const resetRequest = await expectStatus(await resetRequestContext.post('auth/password-resets', { data: { identifier: emails.reset } }), 202, 'password reset request');
  await resetRequestContext.dispose();
  const newPassword = 'DeepFunctional!2026-NewPassword';
  const resetApi = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  await expectStatus(await resetApi.post('auth/password-resets/confirm', { data: { identifier: emails.reset, code: resetRequest.debugCode, newPassword } }), 204, 'password reset confirm');
  await expectStatus(await api(resetPage, '/auth/me'), 401, 'old session invalidated by password reset');
  await expectStatus(await resetApi.post('auth/login', { data: { identifier: emails.reset, password: newPassword } }), 201, 'new password login');
  await resetApi.dispose();
  await resetContext.close();

  await activateByApi(emails.withdraw);
  const withdrawalContext = await browser.newContext();
  const withdrawalPage = await withdrawalContext.newPage();
  await login(withdrawalPage, emails.withdraw);
  await expectStatus(await api(withdrawalPage, '/auth/me/withdrawal', { method: 'POST' }), 201, 'account withdrawal');
  await expectStatus(await api(withdrawalPage, '/auth/me'), 401, 'withdrawn session revoked');
  const postWithdrawalApi = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  await expectStatus(await postWithdrawalApi.post('auth/login', { data: { identifier: emails.withdraw, password } }), 401, 'withdrawn login denied');
  await postWithdrawalApi.dispose();
  await withdrawalContext.close();

  await activateByApi(emails.lock);
  const lockApi = await playwrightRequest.newContext({ baseURL: `${apiOrigin}/` });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectStatus(await lockApi.post('auth/login', { data: { identifier: emails.lock, password: 'DefinitelyWrong!2026' } }), 401, `failed login ${attempt + 1}`);
  }
  await expectStatus(await lockApi.post('auth/login', { data: { identifier: emails.lock, password } }), 429, 'temporary login lock');
  await lockApi.dispose();

  // ADMIN: actual admin page, denied normal user, re-authenticated changes and audit endpoints.
  const normalAdminAttempt = await api(buyer, '/admin/overview');
  await expectStatus(normalAdminAttempt, 403, 'normal user admin denial');
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, emails.admin, adminPassword);
  await admin.goto(`${webOrigin}/admin`);
  await expect(admin.getByRole('heading', { name: '운영 관리' })).toBeVisible();
  await expect(admin.getByRole('status')).toHaveText('');
  await expect(admin.getByText('사용자', { exact: true }).first()).toBeVisible();
  const outsiderMe = await expectStatus(await api(outsider, '/auth/me'), 200, 'outsider identity');
  ids.outsider = outsiderMe.user.id;
  await expectStatus(await api(admin, `/admin/users/${ids.outsider}/suspend`, { method: 'POST', data: { reason: '심층 테스트 이용정지', password: adminPassword } }), 201, 'admin user suspension');
  await expectStatus(await api(outsider, '/auth/me'), 401, 'suspended existing session invalidated');
  await expectStatus(await api(admin, `/admin/users/${ids.outsider}/activate`, { method: 'POST', data: { reason: '심층 테스트 복구', password: adminPassword } }), 201, 'admin user activation');
  await expectStatus(await api(admin, `/admin/reports/${ids.report}/resolve`, { method: 'POST', data: { reason: '심층 테스트 신고 처리', password: adminPassword } }), 201, 'admin report resolution');
  const hiddenProduct = await createProduct(seller, `${runId} 관리자 숨김 상품`, '7000');
  ids.adminHiddenProduct = hiddenProduct.id;
  await expectStatus(await api(admin, `/admin/products/${ids.adminHiddenProduct}/hide`, { method: 'POST', data: { reason: '심층 테스트 정책 위반 숨김', password: adminPassword } }), 201, 'admin product hide');
  const audits = await expectStatus(await api(admin, '/admin/audit-logs'), 200, 'admin audit logs');
  expect(audits.auditLogs.filter((log: any) => [ids.outsider, ids.report, ids.adminHiddenProduct].includes(log.targetId)).length).toBeGreaterThanOrEqual(4);

  const malformed = await admin.request.post(`${apiOrigin}/admin/users/${ids.outsider}/suspend`, {
    headers: { 'content-type': 'application/json' },
    data: { reason: 'x', password: 'short', unexpectedSecret: 'must-not-echo' },
  });
  expect(malformed.status()).toBe(400);
  const malformedText = await malformed.text();
  expect(malformedText).not.toContain('must-not-echo');
  expect(malformedText).not.toMatch(/node_modules|at .*\.ts:/);

  console.log(`DEEP_LIVE_RESULT ${JSON.stringify({ runId, emails, ids })}`);
  await Promise.all([sellerContext.close(), buyerContext.close(), outsiderContext.close(), adminContext.close()]);
});
