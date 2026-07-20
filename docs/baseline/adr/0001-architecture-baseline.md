# ADR-0001: 모듈형 모놀리스와 계약 우선 기반

- 상태: 검토중
- 결정일: 2026-07-15
- 근거: WBS-00.03, SEC-008, SEC-014

## 결정

초기 제품은 pnpm workspace 기반 모듈형 모놀리스로 구현한다. 사용자·관리자
웹은 `apps/web`, REST·Socket.IO API는 `apps/api`, 비동기 소비자와 배치 작업은
`apps/worker`가 소유한다. 데이터와 API 계약은 각각 `packages/database`,
`packages/contracts`가 단일 원본이 된다.

기술 기준은 Node.js 24 LTS, TypeScript 6, Next.js 16/React 19.2, NestJS 11,
PostgreSQL 18/Prisma 7, Redis 8/BullMQ, Socket.IO 4이며 상세 버전은 lockfile로
고정한다. 외부 HTTP 계약은 `/api/v1` OpenAPI 3.1 문서에서 먼저 변경하고,
이벤트 계약은 `packages/contracts`에서 관리한다.

## 이유

결제 웹훅, 큐, WebSocket, 관리자 감사의 배포·권한 경계는 필요하지만 현 시점에
마이크로서비스 운영 복잡도를 정당화할 근거는 없다. 서버 세션, 거래 상태 전이,
불변 원장에는 PostgreSQL 트랜잭션 경계가 필요하다.

## 결과와 제약

- Prisma schema·migration과 OpenAPI 원본은 단계별 단일 작업자만 변경한다.
- 카드 계정 데이터는 어떤 앱·로그·큐·저장소도 통과하지 않는다.
- API는 입력 검증, 인증·인가, 객체 소유권 검사를 서버에서 수행한다.
- 검색 품질 또는 부하 목표가 PostgreSQL FTS/`pg_trgm`으로 충족되지 않을 때만
  ADR로 검색 엔진 도입을 재검토한다.
- 상품 이미지의 P0 원본 저장소는 DEC-06에 따라 PostgreSQL `Bytes`이며, 용량·트래픽 근거가 생기면 S3 호환 저장소 전환을 별도 ADR로 다룬다.

## 선택하지 않은 대안

- Next.js 단일 풀스택: 결제·큐·실시간·감사 경계가 불명확해진다.
- 초기 마이크로서비스: 운영·배포·분산 트랜잭션 비용이 현재 규모에 과하다.
- JWT 단독 인증: 강제 로그아웃과 제재 즉시 반영 요구에 맞지 않는다.
- 카드 API 직접 연동: PCI 범위와 카드 원문 노출 위험을 불필요하게 확대한다.
