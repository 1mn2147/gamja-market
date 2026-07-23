# 배포 전 테스트 보고서

- 실행 일시: 2026-07-21 10:13~10:21 UTC
- 대상 브랜치/기준 커밋: `main` / `d93d1baa849a19c3b7e732d090f223baffa24062`
- 작업 트리: 미커밋 변경 포함
- 테스트 이미지: `gamja-predeploy-test:20260721`
- 이미지 ID: `sha256:6c14bcfddf49399c313d178f0c5191cfe8d4ac4c3f11320d488b66c7b23a1816`
- 판정: **NO-GO — 장애 복구 결함 수정·재시험 및 외부 필수 검증 필요**

## 1. 실행 환경

| 구성 | 버전/조건 |
| --- | --- |
| Node.js | 24.18.0 |
| pnpm | 10.13.1 |
| PostgreSQL | 18.4, 빈 임시 데이터 디렉터리 |
| Redis | 8.8.0, 빈 임시 데이터 디렉터리 |
| Prisma | 7.8.0 |
| Playwright/Chromium | 1.61.1 / Chromium 149 계열 |
| 결제·정산 | 외부 키 없이 명시적 로컬 샌드박스 |

기존 개발 DB와 분리된 Docker 네트워크와 PostgreSQL·Redis 컨테이너를 사용했다.
프로덕션 빌드 산출물로 API, Worker, Web 프로세스를 별도 기동해 런타임 스모크를 수행했다.

## 2. 종합 결과

| 영역 | 결과 | 증거/수치 |
| --- | --- | --- |
| 작업 트리 무결성 | 통과 | `git diff --check`, `docker compose config --quiet` 성공 |
| 컨테이너 이미지 빌드 | 통과 | Dockerfile `test` target 새 빌드 성공 |
| 빈 DB 마이그레이션 | 통과 | 9개 migration 순차 적용 및 seed 성공 |
| Lint | 통과 | 전체 8개 대상 workspace |
| Typecheck | 통과 | 전체 8개 대상 workspace |
| 프로덕션 빌드 | 통과 | Web 18개 route, API, Worker 빌드 성공 |
| 단위 테스트 | 통과 | 22건: API 14, Web 2, 계약 패키지 6 |
| 통합 테스트 | 통과 | 14건: 인증 8, 결제 2, 거래 2, 관리자 2 |
| OpenAPI 계약 | 통과 | 6건 |
| 기준선 검증 | 통과 | 산출물 8개, 요구사항 88개 |
| 브라우저 E2E | 통과 | 22건, 두 사용자 에스크로 전체 여정 포함 |
| 자동 접근성 | 통과 | Axe 기반 20건 |
| 보안 기준선 | 통과 | 금지 비밀·카드 데이터 필드 검사 |
| 의존성 취약점 | 조건부 통과 | high/critical 0건, moderate 2건 |
| 프로덕션 프로세스 스모크 | 통과 | API health/readiness, 상품 조회, Web 200 및 보안 헤더 |
| 성능 smoke | 통과 | 80회, 동시 10, 실패 0, P50 13ms, P95 33ms, P99 67ms |
| Redis 장애 readiness | **실패** | 8초 내 503 없이 클라이언트 타임아웃 |
| Redis 복구 후 API | 통과 | Redis 재기동 후 `readyz` 정상 복구 |
| Redis 복구 후 Worker | **실패** | 50초 이상 새 Outbox 이벤트가 `PENDING` 유지 |
| Worker 재시작 우회 | 통과 | 재시작 후 이벤트 1회 처리, `attempts=1` |

성능 기준은 일반 조회 P95 1,000ms이며 이번 로컬 컨테이너 smoke 결과는 33ms였다.
이 수치는 실제 운영 용량·네트워크·외부 결제 지연 시험을 대신하지 않는다.

## 3. 배포 차단 결함

### PD-001 Redis 장애 시 readiness 응답 지연 — 높음

재현:

1. 정상 상태에서 `/api/v1/readyz`가 DB·Redis `ok`를 반환하는지 확인했다.
2. Redis 컨테이너를 중단했다.
3. 8초 제한으로 `/api/v1/readyz`를 호출했다.

실제 결과: 응답 본문과 HTTP 상태 없이 클라이언트가 타임아웃됐다.

기대 결과: Redis 연결 실패를 제한 시간 안에 종료하고 503과
`DEPENDENCY_UNAVAILABLE`을 반환해야 한다.

영향: 로드밸런서나 오케스트레이터가 장애 인스턴스를 신속히 제외하지 못하고 요청이
장시간 대기할 수 있다. `connectTimeout`만으로 Redis 클라이언트의 기본 재연결을
제한하지 못하는 경로를 점검해야 한다.

재시험 통과 기준: Redis 중단 상태에서 `readyz`가 3초 이내 503을 반환하고,
Redis 재기동 후 30초 이내 200으로 복구한다.

### PD-002 Redis 재기동 후 Worker 자동 복구 실패 — 높음

재현:

1. Worker가 Outbox 스케줄 작업을 수행하는 상태에서 Redis를 중단·재기동했다.
2. DB에 `predeploy.smoke` Outbox 이벤트를 `PENDING`으로 추가했다.
3. 50초 이상 상태와 Worker 로그를 관찰했다.

실제 결과: Worker 프로세스는 실행 중이었지만 이벤트의 `attempts=0`,
`status=PENDING`이 유지됐다. Worker를 재시작하자 즉시 한 번 처리되어
`PROCESSED`, `attempts=1`이 됐다.

기대 결과: Redis 재기동 후 Worker가 자동 재연결하고 예약 작업과 Outbox 처리를
재개해야 한다.

영향: 프로세스 상태만으로는 장애를 감지하기 어렵고 웹훅·정산·자동 구매확정이
무기한 적체될 수 있다. 데이터 유실은 관찰되지 않았으나 운영자 재시작 없이는
처리가 재개되지 않았다.

재시험 통과 기준: Worker 재시작 없이 Redis 복구 30초 이내 새 Outbox 이벤트를
정확히 한 번 처리하고, Worker health/metric이 연결 단절과 복구를 표시해야 한다.

## 4. 보안·배포 구성 확인 사항

`pnpm audit --prod --audit-level high`는 통과했지만 중간 등급 2건이 보고됐다.

- `@hono/node-server <1.19.13`: 반복 슬래시를 이용한 `serveStatic` middleware 우회
- `postcss <8.5.10`: CSS stringify의 `</style>` 이스케이프 관련 XSS

직접 노출 경로와 상위 패키지의 패치 버전을 확인하고 배포 전 업데이트 또는 위험 수용
근거를 남긴다.

현재 `compose.yaml`과 `.env.example`은 로컬 개발용 기본값이다. 실제 배포 정의에서는
아래 값을 별도로 증명해야 한다.

- API·Worker `NODE_ENV=production`
- `AUTH_DEBUG_CODES=false`, `COOKIE_SECURE=true`
- 로컬 결제·정산 샌드박스 비활성화
- 실제 Web/API origin을 Web 이미지 build arg에 주입
- Toss, 웹훅, 연락처 전달, 지급 공급자 비밀을 비밀 저장소로 주입
- OTLP endpoint, 경보 수신자, 백업·복원 대상 구성

응답에 `X-Powered-By: Next.js`가 노출되는 점은 낮은 위험의 하드닝 후보로 기록한다.

## 5. 미실행 필수 시험

외부 계정·실기기·운영 권한이 없어 다음 항목은 자동화 결과로 대체하지 않았다.
상세 절차와 증거 양식은 `docs/user-test-checklist.md`를 따른다.

- UT-EXT-001 실제 Toss 테스트 승인·취소·환불·웹훅 재전송
- UT-EXT-002 실제 이메일/SMS 연락처 전달 공급자
- UT-EXT-003 실제 지급·정산 공급자
- UT-UX-001 모바일·Firefox·NVDA/VoiceOver 수동 접근성
- UT-OPS-001 2분 장애, PostgreSQL 백업 복원, 경보·감사 로그 훈련

## 6. 최종 판정과 재시험 범위

정상 경로의 기능·계약·브라우저·접근성·성능 게이트는 통과했다. 그러나 PD-001과
PD-002는 결제 웹훅과 정산의 운영 지속성에 직접 영향을 주므로 현 상태로는 배포하지 않는다.

배포 승인 전 필요한 조치는 다음과 같다.

1. PD-001 readiness 제한 시간과 Redis 재시도 정책을 수정하고 장애 통합 테스트를 추가한다.
2. PD-002 Worker 자동 재연결 또는 프로세스 종료·재시작 보장을 구현하고 Outbox 복구 시험을 추가한다.
3. 중간 등급 취약점 2건을 업데이트하거나 위험 수용한다.
4. 운영 전용 배포 설정과 비밀 주입 증거를 확인한다.
5. 외부 필수 시험 5종의 통과 증거를 기록한다.
6. 동일 이미지 후보로 migration, `test:release`, 프로덕션 스모크, Redis 장애·복구를 재실행한다.

위 조건이 모두 충족되면 `GO` 판정으로 보고서를 갱신한다.
