# 운영·복구 실행서

## 상태 확인

```bash
curl -fsS http://127.0.0.1:4000/api/v1/healthz
curl -fsS http://127.0.0.1:4000/api/v1/readyz
docker compose ps
docker compose logs --since=15m api worker
```

`readyz`가 503이면 트래픽을 투입하지 않는다. 로그를 공유할 때 요청 ID는 유지하되
쿠키, 비밀번호, 결제 키, 웹훅 원문과 연락처는 제거한다.

## 웹훅·Outbox 장애

1. `gamja_outbox_pending_events`, dead-letter 이벤트와 워커 연결을 확인한다.
2. Toss 조회 API에서 주문 ID·금액·상태를 확인한다.
3. 원인을 제거한 뒤 관리자 화면에서 해당 이벤트를 재처리한다.
4. 동일 전송 ID의 웹훅 수와 원장 항목 수가 각각 하나인지 확인한다.

DB 상태를 직접 수정하지 않는다. 관리자 재처리는 재인증, 사유, 감사 로그를 요구한다.

## 정산 실패

1. 거래가 `CONFIRMED`이고 분쟁이 없는지 확인한다.
2. `Payment.failureCode`와 지급 공급자 멱등 키 `settlement-<paymentId>`를 대조한다.
3. 공급자에서 이미 지급됐다면 재호출하지 말고 대사 결과를 기록한다.
4. 미지급이 확인된 경우 워커의 다음 재시도를 관찰한다.

## PostgreSQL 백업·복원 검증

암호는 명령행에 직접 넣지 않고 `.pgpass` 또는 비밀 주입을 사용한다.

```bash
pg_dump --format=custom --no-owner --file=gamja-backup.dump "$DATABASE_URL"
createdb gamja_restore_check
pg_restore --exit-on-error --no-owner --dbname=gamja_restore_check gamja-backup.dump
```

복원 DB에서 사용자·거래·결제·원장·감사 로그·웹훅·outbox 개수를 원본과 비교한다.
복원 검증 DB는 운영 트래픽과 완전히 분리하고, 검증 후 조직의 데이터 폐기 절차로 삭제한다.

## 배포와 롤백

1. CI release gate와 migration dry-run 결과를 확인한다.
2. DB migration을 API보다 먼저 적용한다.
3. API, worker, web 순서로 배포하고 readiness와 backlog를 관찰한다.
4. 애플리케이션 롤백은 이전 이미지로 수행한다. 이미 적용된 migration은 자동으로 되돌리지 않는다.
5. 결제 상태 변경 중 롤백했다면 Toss 대사와 outbox 처리를 완료한 뒤 정상화 선언한다.

## 출시 전 필수 수동 검증

외부 계정과 실기기가 필요한 항목은 `user-test-checklist.md`의 UT-EXT-001~003,
UT-UX-001, UT-OPS-001을 수행하고 증거 위치를 기록한다.
