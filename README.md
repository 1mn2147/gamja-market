# Gamja Market

안전한 지역 기반 중고거래 플랫폼의 TypeScript 모노레포입니다. 회원가입과 연락처
인증, 상품·검색, 1:1 채팅, 신고·차단, 직거래 요청, 에스크로 결제·정산 및
최고관리자 운영 기능을 포함합니다.

현재 상태는 로컬 기능·보안 출시 후보 `GO`이며, 실제 운영 배포는 Toss·연락처·
지급 공급자와 TLS·백업 복원·실기기 시험을 완료한 뒤 승인해야 합니다. 개발
전 과정과 보안 약점·개선 내용은
[시큐어코딩 개발 보고서](./docs/secure-coding-development-report.md)에 정리했습니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `apps/web` | Next.js 사용자·관리자 화면과 동일 출처 API/Socket 프록시 |
| `apps/api` | NestJS REST API, 인증·인가, Socket.IO와 업무 서비스 |
| `apps/worker` | Outbox, 거래 기한과 정산 비동기 처리 |
| `packages/database` | Prisma 스키마, migration과 seed |
| `packages/contracts` | OpenAPI 계약 검사 |
| `packages/config` | 공통 보안·품질 검사 |
| `docs` | 요구사항, 설계, 테스트, 운영 실행서와 개발 보고서 |

런타임은 PostgreSQL 18, Redis 8, API, Worker와 Web으로 구성됩니다.

## 사전 준비

가장 간단한 실행 방식은 Docker Compose입니다.

- Docker Engine 24 이상 권장
- Docker Compose v2
- 사용 가능한 포트: `3000`, `4000`, `5432`, `6379`

호스트 개발 모드에는 다음 항목이 추가로 필요합니다.

- Node.js `24.x`
- pnpm `10.13.x` 또는 `corepack`

## 빠른 실행

```bash
git clone https://github.com/1mn2147/gamja-market.git
cd gamja-market
cp .env.example .env
docker compose up --build -d
docker compose ps
```

첫 실행은 의존성 설치, 이미지 빌드, 12개 migration과 멱등 seed 적용 때문에
시간이 걸릴 수 있습니다. `db-init`가 완료되고 API·Web이 `healthy`가 되면
접속합니다.

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/healthz`
- API readiness: `http://localhost:4000/api/v1/readyz`

```bash
curl -fsS http://localhost:4000/api/v1/healthz
curl -fsS http://localhost:4000/api/v1/readyz
docker compose logs --since=10m db-init api worker web
```

소스 변경을 반영할 때는 다시 빌드합니다.

```bash
docker compose up --build -d
```

데이터를 유지하며 종료하려면 다음을 실행합니다.

```bash
docker compose down
```

다음 명령은 PostgreSQL과 Redis 볼륨을 함께 삭제합니다. 로컬 데이터를 모두
초기화하려는 경우에만 사용합니다.

```bash
docker compose down -v
```

## 환경 설정

`.env.example`을 `.env`로 복사한 뒤 환경에 맞게 변경합니다. `.env`와 실제
비밀키는 Git에 추가하지 않습니다.

### 기본 연결과 인증

| 변수 | 로컬 기본값·설명 |
| --- | --- |
| `DATABASE_URL` | 호스트 개발용 PostgreSQL URL. Compose 컨테이너는 내부 URL을 사용 |
| `REDIS_URL` | 호스트 개발용 Redis URL. Compose 컨테이너는 내부 URL을 사용 |
| `WEB_ORIGIN` | CORS·Socket 허용 Web Origin. 외부 접속 주소와 정확히 일치해야 함 |
| `NEXT_PUBLIC_API_ORIGIN` | 빌드 시 브라우저에 제공할 API Origin |
| `COOKIE_SECURE` | 로컬 HTTP는 `false`, 운영 HTTPS는 반드시 `true` |
| `AUTH_CODE_PEPPER` | 인증 코드 해시에 사용할 충분히 긴 무작위 비밀 |
| `AUTH_DEBUG_CODES` | 로컬만 `true`; 운영에서는 반드시 `false` |

로컬 Compose는 인증 코드를 화면에서 확인할 수 있도록
`AUTH_DEBUG_CODES=true`를 사용합니다. 공개 또는 운영 환경에서는 이를 끄고
연락처 전달 공급자를 설정해야 합니다.

### 결제·정산

기본 설정은 실제 결제가 발생하지 않는 결정적 로컬 어댑터입니다.

```dotenv
TOSS_SANDBOX_MODE=true
NEXT_PUBLIC_PAYMENT_SANDBOX_MODE=true
```

실제 Toss 테스트 환경을 사용하려면 다음 값을 설정합니다.

```dotenv
TOSS_SANDBOX_MODE=false
NEXT_PUBLIC_PAYMENT_SANDBOX_MODE=false
TOSS_SANDBOX_CLIENT_KEY=...
TOSS_SANDBOX_SECRET_KEY=...
NEXT_PUBLIC_TOSS_CLIENT_KEY=...
TOSS_WEBHOOK_SECRET=...
TOSS_API_ORIGIN=https://api.tosspayments.com
```

지급·정산 공급자는 다음 서버 전용 값을 사용합니다.

```dotenv
SETTLEMENT_PAYOUT_WEBHOOK_URL=...
SETTLEMENT_PAYOUT_WEBHOOK_SECRET=...
```

클라이언트에 노출되는 `NEXT_PUBLIC_*`에는 공개 가능한 client key만 넣습니다.
Toss secret, 웹훅 secret과 지급 secret을 `NEXT_PUBLIC_*`에 넣으면 안 됩니다.

### 연락처 전달과 관측

```dotenv
CONTACT_DELIVERY_WEBHOOK_URL=...
CONTACT_DELIVERY_WEBHOOK_SECRET=...
LOG_LEVEL=info
OTEL_EXPORTER_OTLP_ENDPOINT=
```

연락처 전달 요청은 HMAC 서명과 함께 공급자 웹훅으로 전송됩니다.
`OTEL_EXPORTER_OTLP_ENDPOINT`가 비어 있으면 원격 telemetry export를 사용하지
않습니다.

## 외부 주소에서 실행

리버스 프록시나 포트 포워딩으로 외부 주소를 사용할 때 `.env`의 Origin을 실제
브라우저 주소로 지정한 후 Web 이미지를 다시 빌드합니다.

```dotenv
WEB_ORIGIN=https://market.example.com
NEXT_PUBLIC_API_ORIGIN=https://market.example.com
COOKIE_SECURE=true
AUTH_DEBUG_CODES=false
```

운영에서는 HTTPS/WSS, HSTS와 신뢰할 수 있는 프록시 설정을 사용해야 합니다.
Web은 `/api/v1`과 `/socket.io`를 내부 API로 전달하므로 브라우저에 내부
`localhost:4000` 주소를 노출하지 않습니다.

## 호스트 개발 모드

```bash
cp .env.example .env
docker compose up -d postgres redis
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @gamja/database db:generate
pnpm --filter @gamja/database build
pnpm --filter @gamja/database db:deploy
pnpm --filter @gamja/database db:seed
pnpm dev
```

개발 서버 기본 주소는 Web `http://localhost:3000`, API
`http://localhost:4000`입니다.

## 데이터베이스

마이그레이션 적용:

```bash
pnpm --filter @gamja/database db:deploy
```

개발용 새 migration 작성:

```bash
pnpm --filter @gamja/database db:migrate
```

seed는 기본 거래 지역인 사림동과 최초 화면 확인용 상품 4개를 멱등 생성합니다.
상품은 로그인 비밀번호가 공개되지 않은 전용 데모 판매자가 소유합니다. 관리자
비밀번호나 외부 공급자 비밀은 seed 또는 저장소에 포함하지 않습니다.

## 품질과 테스트

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:contract
pnpm test:e2e
pnpm test:a11y
pnpm test:security
pnpm test:performance
```

전체 로컬 릴리스 게이트:

```bash
pnpm test:release
```

통합·E2E 시험은 테스트 데이터를 만들거나 정리하므로 운영 DB가 아닌 격리된
PostgreSQL과 Redis에서 실행합니다. 실제 Toss·연락처·지급 계정과 실기기가
필요한 시험은 [사용자 테스트 체크리스트](./docs/user-test-checklist.md)를
따릅니다.

GitHub Actions의 `quality-gate`는 push와 pull request에서 lint, typecheck,
build, 단위·통합·계약·E2E·접근성·기초 보안 검사를 실행합니다.

## 보안 운영 주의사항

- `.env`, DB dump, 인증 코드, 세션 쿠키와 실제 공급자 키를 커밋하지 않습니다.
- 운영은 `AUTH_DEBUG_CODES=false`, `COOKIE_SECURE=true`를 강제합니다.
- 카드번호, 유효기간, CVC/CVV, PIN을 테스트 데이터·로그·DB에 넣지 않습니다.
- 관리자 고위험 작업은 재인증·사유·감사 로그를 우회하지 않습니다.
- migration은 API 배포 전에 적용하고 이미 적용된 migration을 자동으로
  되돌리지 않습니다.
- 장애·대사·백업·롤백 절차는 [운영 실행서](./docs/operations-runbook.md)를
  따릅니다.

## 주요 문서

- [제품 요구사항](./docs/requirements.md)
- [화면 설계](./docs/page_desc.md)
- [기술 스택과 개발 계획](./docs/tech_stack.md)
- [테스트 전략과 명세](./docs/test_plan.md)
- [시큐어코딩 개발 보고서](./docs/secure-coding-development-report.md)
- [심층 기능 테스트 보고서](./docs/deep-functional-test-report-2026-07-23.md)
- [운영·복구 실행서](./docs/operations-runbook.md)
