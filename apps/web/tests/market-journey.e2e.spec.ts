import { expect, request as playwrightRequest, test } from '@playwright/test';

const password = 'Browser!Journey2026-Safe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WAAAAABJRU5ErkJggg==', 'base64');

async function activate(email: string) {
  const api = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:4000/api/v1/' });
  const signup = await api.post('auth/signups', { data: { email, password, adultConfirmed: true } });
  expect(signup.ok()).toBeTruthy();
  const issued = await signup.json() as { debugCode: string };
  const confirmation = await api.post('auth/contact-confirmations', { data: { identifier: email, code: issued.debugCode } });
  expect(confirmation.ok()).toBeTruthy();
  await api.dispose();
}

async function login(page: import('@playwright/test').Page, email: string, loginPassword = password) {
  await page.goto('/login');
  await page.getByLabel('이메일 또는 휴대전화').fill(email);
  await page.getByLabel('비밀번호').fill(loginPassword);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/me$/);
}

test('E2E-MARKET-001: two users complete the escrow trade journey', async ({ browser }) => {
  test.setTimeout(60_000);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sellerEmail = `journey-seller-${suffix}@example.test`;
  const buyerEmail = `journey-buyer-${suffix}@example.test`;
  await activate(sellerEmail);
  await activate(buyerEmail);

  const sellerContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  const buyer = await buyerContext.newPage();
  await login(seller, sellerEmail);
  await login(buyer, buyerEmail);

  await seller.goto('/products/new');
  await seller.getByLabel('제목').fill(`여정 감자 ${suffix}`);
  await seller.getByLabel('설명').fill('실제 브라우저 종단 간 거래 검증 상품입니다.');
  await seller.getByLabel('가격(원)').fill('15000');
  await seller.getByLabel('카테고리').fill('테스트');
  await seller.getByLabel(/사진/).setInputFiles({ name: 'potato.png', mimeType: 'image/png', buffer: png });
  await seller.getByRole('button', { name: '상품 등록' }).click();
  await expect(seller).toHaveURL(/\/products\/(?!new$)[A-Za-z0-9_-]+$/);
  await expect(seller.getByRole('heading', { name: `여정 감자 ${suffix}` })).toBeVisible();
  await expect(seller.getByText('내가 등록한 상품입니다.', { exact: false })).toBeVisible();
  await expect(seller.getByRole('button', { name: '판매자에게 거래 요청' })).toHaveCount(0);
  const productUrl = seller.url();

  await buyer.goto(productUrl);
  await expect(buyer.getByRole('button', { name: '판매자에게 거래 요청' })).toBeVisible();
  await buyer.getByRole('button', { name: '판매자에게 거래 요청' }).click();
  await expect(buyer).toHaveURL(/\/chats\/[A-Za-z0-9_-]+$/);
  await expect(buyer.getByRole('heading', { name: `여정 감자 ${suffix}` })).toBeVisible();
  await expect(buyer.getByRole('link', { name: /거래 보기 · REQUESTED/ })).toBeVisible();
  await expect(buyer.locator('.connection-status')).toHaveText('실시간 채팅에 연결되었습니다.');

  await seller.goto('/chats');
  await seller.getByRole('link', { name: new RegExp(`여정 감자 ${suffix}`) }).click();
  await expect(seller.locator('.connection-status')).toHaveText('실시간 채팅에 연결되었습니다.');

  const buyerMessage = `구매를 요청합니다 ${suffix}`;
  await buyer.getByRole('textbox', { name: '메시지', exact: true }).fill(buyerMessage);
  await buyer.getByRole('button', { name: '전송' }).click();
  await expect(buyer.getByText(buyerMessage, { exact: true })).toBeVisible();
  await expect(seller.getByText(buyerMessage, { exact: true })).toBeVisible();
  const sellerMessage = `거래 요청을 확인했습니다 ${suffix}`;
  await seller.getByRole('textbox', { name: '메시지', exact: true }).fill(sellerMessage);
  await seller.getByRole('button', { name: '전송' }).click();
  await expect(seller.getByText(sellerMessage, { exact: true })).toBeVisible();
  await expect(buyer.getByText(sellerMessage, { exact: true })).toBeVisible();

  await buyer.goto('/chats');
  await expect(buyer.getByRole('link', { name: new RegExp(`여정 감자 ${suffix}`) })).toBeVisible();
  await seller.getByRole('link', { name: /거래 보기 · REQUESTED/ }).click();
  await expect(seller).toHaveURL(/\/trades\/[A-Za-z0-9_-]+$/);
  const tradeUrl = seller.url();

  await seller.getByRole('button', { name: '거래 요청 수락' }).click();
  await expect(seller.getByText('15,000원 · 판매자 수락', { exact: true })).toBeVisible();
  await expect(seller.getByText('구매자의 에스크로 결제를 기다리고 있습니다.', { exact: false })).toBeVisible();
  await expect(seller.getByRole('button', { name: '인도 완료로 표시' })).toHaveCount(0);

  await buyer.goto(tradeUrl);
  await expect(buyer.getByText('생성된 결제 주문이 없습니다.')).toBeVisible();
  await expect(buyer.getByText('결제 기한:', { exact: false })).toBeVisible();
  await buyer.getByRole('button', { name: '에스크로 결제하기' }).click();
  await expect(buyer).toHaveURL(/\/payments\//);
  await buyer.getByRole('button', { name: '로컬 샌드박스 승인' }).click();
  await expect(buyer.getByText(/^결제 APPROVED · 정산 /)).toBeVisible();

  await seller.reload();
  await seller.getByRole('button', { name: '인도 완료로 표시' }).click();
  await expect(seller.getByText('15,000원 · 인도 완료', { exact: true })).toBeVisible();
  await buyer.goto(seller.url());
  await buyer.getByRole('button', { name: '구매 확정하기' }).click();
  await expect(buyer.getByText('15,000원 · 구매 확정', { exact: true })).toBeVisible();

  await Promise.all([sellerContext.close(), buyerContext.close()]);
});

test('E2E-TRADE-020: competing requests close safely and an unpaid reservation can be released', async ({ browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sellerEmail = `race-ui-seller-${suffix}@example.test`;
  const buyerAEmail = `race-ui-buyer-a-${suffix}@example.test`;
  const buyerBEmail = `race-ui-buyer-b-${suffix}@example.test`;
  await Promise.all([activate(sellerEmail), activate(buyerAEmail), activate(buyerBEmail)]);

  const sellerContext = await browser.newContext();
  const buyerAContext = await browser.newContext();
  const buyerBContext = await browser.newContext();
  const seller = await sellerContext.newPage();
  const buyerA = await buyerAContext.newPage();
  const buyerB = await buyerBContext.newPage();
  await Promise.all([
    login(seller, sellerEmail),
    login(buyerA, buyerAEmail),
    login(buyerB, buyerBEmail),
  ]);

  const productResponse = await seller.request.post('/api/v1/products', {
    data: {
      title: `경쟁 요청 UI ${suffix}`,
      description: '복수 구매 요청 종료와 미결제 예약 해제를 검증합니다.',
      priceKrw: '22000',
      category: '경쟁 거래 테스트',
      images: [{ dataBase64: png.toString('base64'), altText: '경쟁 거래 테스트 상품' }],
    },
  });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json() as { id: string };
  const [requestAResponse, requestBResponse] = await Promise.all([
    buyerA.request.post('/api/v1/trades', { data: { productId: product.id } }),
    buyerB.request.post('/api/v1/trades', { data: { productId: product.id } }),
  ]);
  expect(requestAResponse.status()).toBe(201);
  expect(requestBResponse.status()).toBe(201);
  const requestA = await requestAResponse.json() as { id: string };
  const requestB = await requestBResponse.json() as { id: string };

  const [acceptA, acceptB] = await Promise.all([
    seller.request.post(`/api/v1/trades/${requestA.id}/accept`),
    seller.request.post(`/api/v1/trades/${requestB.id}/accept`),
  ]);
  const acceptedTradeId = acceptA.ok() ? requestA.id : requestB.id;
  const rejectedTradeId = acceptA.ok() ? requestB.id : requestA.id;
  const rejectedBuyer = acceptA.ok() ? buyerB : buyerA;
  expect([acceptA.status(), acceptB.status()].filter((status) => status === 201)).toHaveLength(1);

  await rejectedBuyer.goto(`/trades/${rejectedTradeId}`);
  await expect(rejectedBuyer.getByText('22,000원 · 요청 거절', { exact: true })).toBeVisible();
  await expect(rejectedBuyer.getByText('다른 구매자의 거래 요청이 먼저 수락되었습니다.', { exact: true })).toBeVisible();

  await seller.goto(`/trades/${acceptedTradeId}`);
  await expect(seller.getByText('구매자의 에스크로 결제를 기다리고 있습니다.', { exact: false })).toBeVisible();
  await expect(seller.getByRole('button', { name: '인도 완료로 표시' })).toHaveCount(0);
  const cancellation = await seller.request.post(`/api/v1/trades/${acceptedTradeId}/cancel`, {
    data: { reason: '판매자의 미결제 예약 해제' },
  });
  expect(cancellation.status()).toBe(201);
  const storedProduct = await (await seller.request.get(`/api/v1/products/${product.id}`)).json() as { status: string };
  expect(storedProduct.status).toBe('ACTIVE');

  await Promise.all([sellerContext.close(), buyerAContext.close(), buyerBContext.close()]);
});

test('E2E-AUTH-010: authenticated product form uses the same-origin API gateway', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `same-origin-seller-${suffix}@example.test`;
  const title = `동일 출처 등록 검증 ${suffix}`;
  await activate(email);
  await login(page, email);

  // Embedded browsers may block direct requests to a different localhost
  // port. Authentication and product creation must work through the web origin.
  await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):4000\/api\/v1\//, (route) => route.abort('blockedbyclient'));
  await page.goto('/products/new');

  await expect(page.getByLabel('제목')).toBeVisible();
  await expect(page.getByRole('button', { name: '상품 등록' })).toBeEnabled();
  await expect(page.getByText('상품을 등록하려면 로그인이 필요합니다.')).toHaveCount(0);
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('설명').fill('외부 API 포트가 차단된 브라우저에서도 저장되는 회귀 테스트 상품입니다.');
  await page.getByLabel('가격(원)').fill('12000');
  await page.getByLabel('카테고리').fill('회귀 테스트');
  await page.getByLabel(/사진/).setInputFiles({ name: 'same-origin.png', mimeType: 'image/png', buffer: png });

  const productResponse = page.waitForResponse((response) => response.url().includes('/api/v1/products') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '상품 등록' }).click();
  const response = await productResponse;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).port).toBe('3000');
  await expect(page).toHaveURL(/\/products\/(?!new$)[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const productImage = page.getByRole('img', { name: /same-origin\.png 상품 사진/ });
  await expect.poll(() => productImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('E2E-CHAT-010: chat list connects through the same-origin Socket.IO gateway', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `chat-socket-${suffix}@example.test`;
  await activate(email);

  await page.goto('http://localhost:3000/login');
  await page.getByLabel('이메일 또는 휴대전화').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL('http://localhost:3000/me');

  const handshake = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.hostname === 'localhost'
      && url.port === '3000'
      && url.pathname === '/socket.io'
      && url.searchParams.get('transport') === 'polling';
  });
  await page.goto('http://localhost:3000/chats');
  expect((await handshake).ok()).toBeTruthy();
  await expect(page.locator('main').getByRole('status')).toHaveText('진행 중인 채팅이 없습니다.');
  await expect(page.getByText('실시간 연결을 복구하는 중입니다.')).toHaveCount(0);
});

test('E2E-AUTH-011: header action changes from login to logout and clears the session', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `header-auth-${suffix}@example.test`;
  const header = page.locator('.site-header');
  await activate(email);

  await page.goto('/');
  await expect(header.getByRole('link', { name: '로그인' })).toBeVisible();
  await expect(header.getByRole('button', { name: '로그아웃' })).toHaveCount(0);

  await login(page, email);
  await expect(header.getByRole('button', { name: '로그아웃' })).toBeVisible();
  await expect(header.getByRole('link', { name: '로그인' })).toHaveCount(0);
  await header.getByRole('button', { name: '로그아웃' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(header.getByRole('link', { name: '로그인' })).toBeVisible();
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
});

test('E2E-AUTH-012: password reset changes the password and revokes the old session', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `password-reset-${suffix}@example.test`;
  const newPassword = 'Fresh!Credential2027-New';
  await activate(email);
  await login(page, email);

  await page.goto('/password/reset');
  await page.getByLabel('검증된 이메일 또는 휴대전화').fill(email);
  await page.getByRole('button', { name: '재설정 코드 받기' }).click();
  const resetStatus = page.locator('main').getByRole('status');
  await expect(resetStatus).toContainText(/로컬 개발 인증 코드: \d{6}/);
  const codeMessage = await resetStatus.innerText();
  const code = codeMessage.match(/\b\d{6}\b/)?.[0];
  expect(code).toBeTruthy();

  const resetPolicy = page.getByLabel('비밀번호 안전 조건');
  await expect(resetPolicy.locator('.password-policy-item.is-missing')).toHaveCount(5);
  await expect(resetPolicy.locator('.password-policy-icon').first()).toHaveText('✕');
  await page.getByLabel('6자리 인증 코드').fill(code!);
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword);
  await page.getByLabel('새 비밀번호 확인').fill(newPassword);
  await expect(resetPolicy.locator('.password-policy-item.is-passed')).toHaveCount(8);
  await expect(resetPolicy.locator('.password-policy-item.is-missing')).toHaveCount(0);
  await expect(resetPolicy.locator('.password-policy-icon').first()).toHaveText('✓');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);

  await login(page, email, newPassword);
  await expect(page.getByText(email, { exact: false })).toBeVisible();
});

test('E2E-PRODUCT-020: long product text stays inside its card and the owner can delete it', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `product-delete-${suffix}@example.test`;
  const title = `긴상품${'A'.repeat(84)}${suffix.slice(-8)}`;
  const description = `설명${'B'.repeat(500)}`;
  await activate(email);
  await login(page, email);

  await page.goto('/products/new');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('설명').fill(description);
  await page.getByLabel('가격(원)').fill('3000');
  await page.getByLabel('카테고리').fill('레이아웃 테스트');
  await page.getByLabel(/사진/).setInputFiles({ name: 'long-product.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '상품 등록' }).click();
  await expect(page).toHaveURL(/\/products\/(?!new$)[A-Za-z0-9_-]+$/);
  const productUrl = page.url();

  await page.goto('/me/products');
  const card = page.locator('.product-card').filter({ hasText: title });
  await expect(card).toHaveCount(1);
  expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(`/api/v1${new URL(productUrl).pathname}`)).status()).toBe(404);
});

test('E2E-SEARCH-020: multiple partial title tokens find a product without exact matching', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `partial-search-${suffix}@example.test`;
  const title = `프리미엄 자색 감자 ${suffix}`;
  await activate(email);
  await login(page, email);

  await page.goto('/products/new');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('설명').fill('부분 문자열 검색을 브라우저에서 검증하는 상품입니다.');
  await page.getByLabel('가격(원)').fill('7000');
  await page.getByLabel('카테고리').fill('검색 테스트');
  await page.getByLabel(/사진/).setInputFiles({ name: 'partial-search.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '상품 등록' }).click();
  await expect(page).toHaveURL(/\/products\/(?!new$)[A-Za-z0-9_-]+$/);

  await page.goto('/search');
  await page.getByLabel('검색어').fill('리미 자색');
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});

test('E2E-AUTH-013: withdrawal hides the member products from public access', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `withdraw-product-${suffix}@example.test`;
  const title = `탈퇴 비공개 상품 ${suffix}`;
  await activate(email);
  await login(page, email);

  await page.goto('/products/new');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('설명').fill('회원 탈퇴와 동시에 공개 목록에서 숨겨져야 하는 상품입니다.');
  await page.getByLabel('가격(원)').fill('4500');
  await page.getByLabel('카테고리').fill('탈퇴 테스트');
  await page.getByLabel(/사진/).setInputFiles({ name: 'withdraw-product.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '상품 등록' }).click();
  await expect(page).toHaveURL(/\/products\/(?!new$)[A-Za-z0-9_-]+$/);
  const productPath = new URL(page.url()).pathname;

  await page.goto('/me/account');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '회원 탈퇴' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('판매중 상품 1개');
  expect((await page.request.get(`/api/v1${productPath}`)).status()).toBe(404);
});

test('SEC-AUTH-009: weak signup passwords are blocked in the UI and API', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `weak-password-ui-${suffix}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('안전한 비밀번호').fill('Password123!');
  await page.getByLabel('만 19세 이상입니다.').check();

  const signupPolicy = page.getByLabel('비밀번호 안전 조건');
  const commonPatternCheck = signupPolicy.getByText('흔한 단어·연속 문자열 제외').locator('..');
  await expect(commonPatternCheck).toHaveClass(/is-missing/);
  await expect(commonPatternCheck.locator('.password-policy-icon')).toHaveText('✕');
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('흔한 단어나 연속된 문자열');
  await expect(page).toHaveURL(/\/signup$/);

  const bypassAttempt = await page.request.post('/api/v1/auth/signups', {
    data: { email, password: 'Password123!', adultConfirmed: true },
  });
  expect(bypassAttempt.status()).toBe(400);
  expect(await bypassAttempt.json()).toMatchObject({ code: 'WEAK_PASSWORD' });

  await page.getByLabel('안전한 비밀번호').fill('Orchid!Vault2026-Safe');
  await expect(signupPolicy.locator('.password-policy-item.is-passed')).toHaveCount(8);
  await expect(signupPolicy.locator('.password-policy-item.is-missing')).toHaveCount(0);
  await expect(signupPolicy.locator('.password-policy-icon').first()).toHaveText('✓');
  await page.getByRole('button', { name: '인증 코드 받기' }).click();
  await expect(page).toHaveURL(/\/verify$/);
});
