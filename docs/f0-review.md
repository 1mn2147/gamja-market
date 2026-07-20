# F0 기반 구현 검토 기록

작성일: 2026-07-15  
대상: WBS-01.01~07 (저장소·환경, CI, 데이터 기반, 관측성, 보안, UI 토대, 품질 게이트)

## 구현 범위

- pnpm 모노레포(`apps/web`, `apps/api`, `apps/worker`, `packages/*`)와 공통 TypeScript·ESLint 설정을 구성했다.
- Docker Compose로 PostgreSQL 18과 Redis 8의 로컬 개발 환경을 구성했다.
- Prisma 7 스키마와 최초 마이그레이션에 아웃박스 이벤트, 감사 로그, 원장 엔터티를 추가했다.
- NestJS API에 `/api/v1/healthz`, `/api/v1/readyz`, 요청 ID, 보안 헤더, CORS, 입력 검증, RFC 7807 오류 형식, 속도 제한과 민감정보가 제거되는 구조화 로그를 구성했다.
- Next.js 웹 토대, 공통 셸, 접근성 자동 검사와 API·계약·보안 검사 기준을 추가했다.
- GitHub Actions CI와 Alertmanager 규칙 초안을 추가했다.

## 검증 증적

| 구분 | 실행 명령 | 결과 |
| --- | --- | --- |
| 기준 문서 | `node scripts/verify-baseline.mjs` | 통과 (8개 산출물, 88개 요구사항) |
| 의존성 재현 | `corepack pnpm install --frozen-lockfile` | 통과 |
| 정적 검사 | `corepack pnpm lint`, `corepack pnpm typecheck` | 통과 |
| 빌드 | `corepack pnpm build` | 통과 (web, api, worker) |
| 단위·통합·계약 | `corepack pnpm test:unit`, `test:integration`, `test:contract` | 통과 |
| 브라우저·접근성 | `corepack pnpm test:e2e`, `test:a11y` | 통과 |
| 보안·릴리스 묶음 | `corepack pnpm test:security`, 당시 `test:release` | 당시 구성 통과; 확장된 release 게이트는 F3에서 재검증 |
| 로컬 인프라 | `docker compose up -d`, Prisma migration deploy, API health 요청 | PostgreSQL·Redis healthy, migration 및 `/healthz`·`/readyz` 확인 |

## 잔여 운영 검토

1. F0 구현은 후속 F1~F3 작업의 선행 기반으로 사용 중이며, 최종 완료 전 M0·M1 승인 기록을 확정한다.
2. 운영 환경에서 DB·Redis를 실제로 ping하는 readiness 검사와 OpenTelemetry exporter/수집 백엔드 연결은 WBS-09 운영 준비에서 확정한다. 현재 F0의 readiness는 필수 연결 문자열 존재 여부를 검증하며, 로컬 Compose 및 Prisma 배포로 연결성을 별도 확인했다.
3. Prisma 마이그레이션 관리, 비밀값 주입, CI 시크릿과 원격 알림 채널은 배포 환경이 정해질 때 운영 구성으로 검토한다.

## 후속 이력

이 검토 이후 WBS-02 계정·인증, WBS-03 상품·검색 구현을 거쳐 WBS-04 채팅·안전 구현이 진행 중이다. 현재 상태는 `wbs.md` 진행표와 `f3-review.md`를 따른다.
