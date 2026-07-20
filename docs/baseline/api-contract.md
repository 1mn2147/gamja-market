# API 계약 기준

## 범위와 원칙

공개 API의 버전 접두어는 `/api/v1`이다. 구현은 OpenAPI 원본
[`openapi.yaml`](./openapi.yaml)을 변경한 뒤 진행한다. 모든 시간은 RFC 3339 UTC,
모든 식별자는 불투명 문자열, 모든 금액은 KRW 최소 단위 정수(`int64`)로 전송한다.
부동소수점 금액과 클라이언트가 정한 결제 금액은 금지한다.

## 인증·인가

인증 세션은 HttpOnly·Secure 쿠키로 전송한다. 서버는 모든 보호된 요청에서
사용자 상태, 역할, 객체 소유권, 차단 관계와 대상 상태를 재검증한다. API는
권한이 없는 객체의 존재 여부를 불필요하게 노출하지 않는다.

## 오류 형식

모든 오류는 `application/problem+json`이며 다음 필드를 사용한다.

```json
{
  "type": "https://api.gamja-market.example/problems/validation-error",
  "title": "Invalid request",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "requestId": "req_...",
  "errors": [{ "field": "price", "code": "MINIMUM", "message": "0 이상의 정수여야 합니다." }]
}
```

응답에는 스택, 내부 호스트, SQL, 비밀값, 인증 코드, 카드 정보, 다른 사용자
객체의 존재를 포함하지 않는다.

## 목록·동시성·멱등성

- 목록은 `limit`(1~100)과 불투명 `cursor`를 사용하며, 안정된 정렬의 마지막
  키를 커서에 포함한다.
- 변경 요청은 `X-Request-Id`를 지원한다. 결제·취소·환불·정산처럼 외부 부작용이
  있는 명령은 서버가 생성·보관한 `Idempotency-Key`를 사용한다.
- 결제 성공 상태는 클라이언트 리다이렉트나 웹훅 본문만으로 바꾸지 않는다.
  서버 주문의 소유자·주문번호·금액과 공급자 조회 결과가 모두 일치해야 한다.

## 채팅·신고·차단

- 채팅방 생성·조회·메시지, 신고, 차단 REST API는 모두 불투명 세션 쿠키를 요구하며 객체 참여자와 차단 관계를 요청마다 재검증한다.
- Socket.IO `chats` 네임스페이스는 REST와 같은 세션·참여자·차단 검사를 사용한다. OpenAPI는 REST 계약만 표현하고 소켓 이벤트 계약은 `packages/contracts`에서 별도로 관리한다.
- 신고 목록은 현재 신고자의 공개 상태만 반환하고 내부 메모, 다른 신고자, 조사 증거를 노출하지 않는다.

## 계약 변경 규칙

호환되지 않는 변경은 새 버전 또는 명시적 마이그레이션 기간을 요구한다. OpenAPI,
이벤트 JSON Schema, API 통합·계약 테스트는 같은 변경에서 갱신한다.
