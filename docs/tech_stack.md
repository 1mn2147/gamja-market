# 감자마켓 기술 스택 및 개발 계획

## 1. 문서 목적

이 문서는 `requirements.md`와 `page_desc.md`를 구현하기 위한 기술 기준선과 단계별 개발 계획을 정의한다. 별도 변경 결정이 승인되기 전까지 WBS, 테스트, 배포 자동화는 이 문서를 기준으로 한다.

## 2. 아키텍처 원칙

- 초기 제품은 **TypeScript 기반 모듈형 모놀리스**로 개발한다.
- 저장소는 pnpm workspace 모노레포로 구성하고, 웹·API·비동기 워커는 독립 프로세스와 독립 배포 단위로 운영한다.
- 업무 모듈은 회원, 상품, 검색, 채팅, 신고·차단, 거래·에스크로, 관리자, 감사로 분리한다.
- 외부 공개 인터페이스는 REST `/api/v1`과 OpenAPI를 기준으로 한다.
- 실시간 통신은 Socket.IO, 지연·재시도 작업은 BullMQ를 사용한다.
- 카드 원문 정보는 감자마켓 시스템을 통과하거나 저장하지 않는다.
- 결제, 웹훅, 정산 상태 변경은 멱등성과 감사 가능성을 우선한다.
- 초기 검색은 PostgreSQL 내장 전문 검색과 `pg_trgm`으로 구현하고, 별도 검색 엔진은 성능 지표가 임계치를 넘을 때 도입한다.

~~~mermaid
flowchart LR
    U["웹/모바일 브라우저"] --> W["Next.js Web"]
    W --> A["NestJS API"]
    W <--> S["Socket.IO Gateway"]
    S --> A
    A --> P[("PostgreSQL (도메인·P0 이미지)")]
    A --> R[("Redis")]
    A --> T["토스페이먼츠 SDK/API"]
    A --> Q["BullMQ"]
    Q --> J["NestJS Worker"]
    J --> P
    J --> T
~~~

## 3. 확정 기술 기준선

### 3.1 코어 런타임

| 영역 | 선택 | 기준 버전 | 선택 이유 |
|---|---|---:|---|
| 런타임 | Node.js | 24 LTS | 장기 지원, Next.js·NestJS·Prisma 지원 범위 충족 |
| 언어 | TypeScript | 6.0.x | 최신 도구 호환성이 안정적인 기준선 |
| 패키지/모노레포 | pnpm workspaces | 10.x | 빠른 설치, 엄격한 의존성, 공통 패키지 관리 |
| 프런트엔드 | Next.js App Router | 16.x | 서버 렌더링, 라우팅, 이미지 최적화, React 19.2 지원 |
| UI | React | 19.2.x | Next.js 16 기준 버전 |
| 스타일 | Tailwind CSS | 4.x | 디자인 토큰과 반응형 UI를 일관되게 관리 |
| 서버 | NestJS | 11.x | 모듈 경계, 검증, OpenAPI, WebSocket, 큐 통합 |
| HTTP 어댑터 | Express | 5.x | NestJS 11 기본 어댑터와 생태계 호환성 |
| ORM | Prisma ORM | 7.x | 타입 안전 쿼리, 마이그레이션, PostgreSQL 지원 |
| 주 데이터베이스 | PostgreSQL | 18.x | 트랜잭션, 전문 검색, 감사·결제 데이터 무결성 |
| 캐시/세션/큐 | Redis | 8.x | 세션, 제한 정책, Socket.IO 어댑터, BullMQ 기반 |

버전은 위 메이저 범위 안에서 lockfile로 고정한다. TypeScript 7은 안정적인 프로그램 API와 핵심 도구 호환성이 확인된 후 별도 ADR로 검토한다.

### 3.2 프런트엔드

| 목적 | 기술 | 적용 원칙 |
|---|---|---|
| 서버 상태 | TanStack Query 5 | 캐시, 재시도, 낙관적 갱신을 API별로 명시 |
| 폼/검증 | React Hook Form + Zod | 사용자 입력과 화면 전용 검증 스키마 관리 |
| API 타입 | OpenAPI 생성 타입 | 서버 DTO를 단일 계약으로 사용하고 수기 중복 타입 금지 |
| 아이콘 | Lucide React | 공통 접근성 레이블과 크기 토큰 적용 |
| 접근성 | eslint-plugin-jsx-a11y + axe-core | WCAG 2.2 AA 기준 자동·수동 검증 |

Next.js Server Component를 기본으로 사용하고, 브라우저 상태나 상호작용이 필요한 경계만 Client Component로 둔다. 비동기 Server Component는 단위 테스트보다 Playwright E2E 테스트를 우선한다.

### 3.3 백엔드

| 목적 | 기술 | 적용 원칙 |
|---|---|---|
| API 계약 | REST `/api/v1` + OpenAPI 3 | `@nestjs/swagger`로 생성하고 CI에서 변경 감지 |
| 입력 검증 | `class-validator` + 전역 `ValidationPipe` | 화이트리스트와 알 수 없는 필드 거부 |
| 인증 | 서버 저장형 불투명 세션 | HttpOnly, Secure, SameSite 쿠키와 세션 토큰 해시 저장 |
| 비밀번호 | Argon2id | 파라미터는 보안 벤치마크 후 환경별 확정 |
| 실시간 채팅 | Socket.IO 4 | 방 권한을 매 연결·이벤트마다 서버에서 검증 |
| 비동기 작업 | BullMQ | 알림, 검색 후처리, 결제 조정, 보존 정책 작업 처리 |
| 상품 이미지 저장 | P0 PostgreSQL `Bytes` | 실제 바이트 형식·크기 검증, 권한 검사 API 반환; DEC-06 임계 도달 시 S3 전환 |
| 결제 | Toss Payments JavaScript SDK v2 | 호스팅 결제 UI만 사용하고 카드 원문 미수집 |

NestJS 모듈은 `Auth`, `Users`, `Products`, `Search`, `Chat`, `Moderation`, `Trades`, `Payments`, `Admin`, `Audit`로 시작한다. 모듈 간 호출은 공개 application service 또는 도메인 이벤트를 사용하고 다른 모듈의 저장소를 직접 접근하지 않는다.

### 3.4 데이터와 검색

- PostgreSQL을 거래 상태, 원장, 상품, 채팅 메타데이터, 신고, 감사 로그의 원본 저장소로 사용한다.
- Prisma migration은 한 명의 소유자가 순차 적용하며, 배포 전후 호환 가능한 확장·전환·정리 순서를 따른다.
- 거래 금액은 소수점이 아닌 최소 통화 단위의 `BIGINT`로 저장한다.
- 모든 서버 시각은 UTC로 저장하고 화면에서 사용자 시간대로 변환한다.
- 상품 검색은 PostgreSQL 전문 검색, `pg_trgm` 유사도, 카테고리·동네·가격·상태 필터, 커서 페이지네이션으로 구현한다.
- Redis는 캐시와 일시 상태에만 사용하며 거래·결제의 최종 사실 저장소로 사용하지 않는다.

### 3.5 큐와 실시간 처리

- BullMQ 작업은 최소 한 번 실행될 수 있다고 가정하여 소비자를 멱등하게 구현한다.
- 결제 상태와 큐 발행의 원자성을 위해 트랜잭셔널 아웃박스를 사용한다.
- 재시도는 지수 백오프와 최대 횟수를 설정하고, 초과 작업은 실패 큐와 관리자 알림으로 보낸다.
- Socket.IO 확장 시 Redis 어댑터를 사용하되, 메시지 원본은 PostgreSQL에 먼저 기록한다.
- 채팅 전송은 클라이언트 메시지 ID로 중복을 제거하고 서버 순번을 반환한다.

### 3.6 보안과 관측성

| 영역 | 기술/규칙 |
|---|---|
| 전송 보안 | 외부·내부 통신 TLS 1.2 이상, 가능하면 TLS 1.3 |
| 웹 보안 | Helmet, 엄격한 CSP, CSRF 방어, NestJS Throttler |
| 저장 암호화 | 인프라 저장 암호화 + 민감 필드 애플리케이션 계층 봉투 암호화 |
| 권한 | 사용자/최고관리자 RBAC, 객체 소유권 검증, 고위험 작업 재인증 |
| 로그 | Pino 구조화 로그, 개인정보·토큰·결제 비밀 마스킹 |
| 추적/지표 | OpenTelemetry, Prometheus 호환 지표, 오류 추적 도구 연동 가능 구조 |
| 감사 | 관리자·결제·권한 변경 불변 감사 이벤트와 상관관계 ID |
| 공급망 | lockfile 고정, 비밀 탐지, SCA, 컨테이너 이미지 스캔 |

PCI-DSS 범위는 Toss Payments 호스팅 결제창을 사용해 SAQ-A 수준을 목표로 한다. 결제 스크립트 무결성, CSP, TLS 설정, 웹훅 서명과 금액·주문 상태 검증을 출시 차단 조건으로 둔다.

## 4. 저장소 구성

~~~text
.
├── apps/
│   ├── web/             # Next.js 사용자·관리자 웹
│   ├── api/             # NestJS REST 및 Socket.IO API
│   └── worker/          # NestJS BullMQ 소비자와 배치 작업
├── packages/
│   ├── database/        # Prisma schema, migrations, generated client
│   ├── contracts/       # OpenAPI 생성 타입과 공통 이벤트 계약
│   ├── ui/              # 공통 UI 컴포넌트와 디자인 토큰
│   ├── config/          # ESLint, TypeScript, Tailwind 공통 설정
│   └── test-utils/      # 픽스처, 빌더, 테스트 도우미
├── infra/
│   ├── compose/         # 로컬 PostgreSQL, Redis
│   └── docker/          # 서비스별 컨테이너 정의
└── docs/
~~~

## 5. 개발 단계

| 단계 | 구현 범위 | 완료 기준 |
|---|---|---|
| F0 기반 | 모노레포, CI, 로컬 인프라, OpenAPI, 로깅·추적 | 웹/API/워커 빌드, 헬스체크와 마이그레이션 자동화 |
| F1 계정 | 가입, 로그인, 세션, 프로필, 만 19세 확인 | 인증·인가·세션 보안과 계정 상태 테스트 통과 |
| F2 상품·검색 | 상품 CRUD, 이미지, 동네 공개, 검색·필터 | 검색 정확도·권한·페이지 성능 기준 충족 |
| F3 소통·안전 | 1:1·전체 채팅, 신고, 차단, 관리자 제재 | 실시간 재연결·중복 방지·차단 전파 검증 |
| F4 거래·결제 | 직거래 약속, 에스크로, Toss 결제, 7일 정책 | 웹훅 멱등성·원장 보존·취소/환불 테스트 통과 |
| F5 관리자 | 사용자·상품·신고·거래·감사 관리 | 최고관리자 권한과 고위험 작업 감사 검증 |
| F6 출시 | 부하, 보안, 접근성, 복구, PCI 증빙 | `test_plan.md`의 출시 게이트 모두 통과 |

각 단계는 세로 기능 단위로 웹, API, 데이터, 테스트를 함께 완료한다. API 계약과 Prisma migration은 병렬 충돌을 피하기 위해 단계별 단일 소유자를 둔다.

## 6. 개발 명령 계약

루트 `package.json`은 다음 명령을 제공해야 한다.

| 명령 | 목적 |
|---|---|
| `pnpm dev` | 웹, API, 워커 로컬 실행 |
| `pnpm lint` | 모든 패키지 정적 검사 |
| `pnpm typecheck` | TypeScript 프로젝트 참조 검사 |
| `pnpm test:unit` | 단위 테스트 |
| `pnpm test:integration` | PostgreSQL·Redis 포함 통합 테스트 |
| `pnpm test:contract` | OpenAPI·이벤트·웹훅 계약 테스트 |
| `pnpm test:e2e` | Playwright 핵심 사용자 흐름 |
| `pnpm test:a11y` | axe 접근성 검사 |
| `pnpm test:security` | SAST, SCA, 비밀·이미지 검사 |
| `pnpm test:release` | 출시 게이트 전체 실행 |

Next.js 16에서 `next lint`가 제거되었으므로 ESLint CLI를 직접 실행한다.

## 7. 선택하지 않은 대안

| 대안 | 결정 | 근거/재검토 조건 |
|---|---|---|
| Next.js 단일 풀스택 | 선택하지 않음 | 결제 웹훅, 큐, WebSocket, 관리자 감사 경계를 NestJS에 명확히 둠 |
| 초기 마이크로서비스 | 선택하지 않음 | 운영 복잡도 대비 규모 근거 부족. 모듈별 부하·팀 소유권이 분리되면 재검토 |
| GraphQL | 선택하지 않음 | 현재 화면은 REST와 OpenAPI로 충분하고 캐시·권한·감사 계약이 단순함 |
| Elasticsearch/OpenSearch | 보류 | PostgreSQL 검색의 p95 또는 품질 목표 미달 시 ADR 후 도입 |
| JWT 단독 인증 | 선택하지 않음 | 강제 로그아웃, 제재, 세션 탈취 대응이 필요한 플랫폼 특성 |
| S3 호환 이미지 저장소 즉시 도입 | 보류 | DEC-06에 따라 PostgreSQL 용량·트래픽 임계와 운영 비용 근거가 확보되면 ADR 후 전환 |
| 카드 API 직접 연동 | 금지 | PCI-DSS 범위 확대와 카드 원문 노출 위험 |
| TypeScript 7 즉시 채택 | 보류 | 7.1 이후 프로그램 API와 Prisma/Nest/검사 도구 호환성 확인 필요 |

## 8. 업그레이드 정책

- 런타임과 프레임워크 메이저 업그레이드는 ADR, 마이그레이션 계획, 회귀 테스트를 요구한다.
- 패치·마이너 업데이트는 주기적으로 묶어 자동 테스트와 보안 스캔 후 반영한다.
- Node.js는 LTS 라인만 운영 환경에 사용하고 EOL 6개월 전 이전 계획을 확정한다.
- PostgreSQL 메이저 업그레이드는 복원 리허설과 읽기·쓰기 호환 검증을 먼저 수행한다.
- Toss SDK와 웹훅 계약은 공식 변경 공지를 추적하고 sandbox 회귀 테스트를 실행한다.

## 9. 공식 참고 자료

- [Node.js 릴리스 일정](https://nodejs.org/en/about/previous-releases)
- [Next.js 16 릴리스](https://nextjs.org/blog/next-16)
- [Next.js App Router](https://nextjs.org/docs/app)
- [NestJS 11 마이그레이션](https://docs.nestjs.com/migration-guide)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [NestJS WebSocket Gateway](https://docs.nestjs.com/websockets/gateways)
- [NestJS Queue](https://docs.nestjs.com/techniques/queues)
- [Prisma 시스템 요구사항](https://docs.prisma.io/docs/orm/reference/system-requirements)
- [PostgreSQL 버전 정책](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 전문 검색](https://www.postgresql.org/docs/18/textsearch.html)
- [Toss Payments JavaScript SDK v2](https://docs.tosspayments.com/sdk/v2/js)
- [Toss Payments 웹훅](https://docs.tosspayments.com/guides/v2/webhook)
- [TypeScript 6.0 릴리스](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
