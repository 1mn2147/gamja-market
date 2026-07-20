# 도메인·상태 모델

## 공통 불변 조건

- 상태 변경은 서버 명령과 현재 상태·행위자 권한을 함께 검증한다.
- 시간 정책은 클라이언트 시간이 아닌 UTC 서버 시간으로 계산한다.
- 결제, 환불, 정산, 감사 기록은 추가 전용이다. 현재 상태는 이력에서 파생한다.
- 숨김·정지·차단은 UI 표시가 아니라 REST와 실시간 채널 모두에서 집행한다.

## 사용자

`PENDING -> ACTIVE -> SUSPENDED -> ACTIVE`, 그리고 `PENDING|ACTIVE|SUSPENDED -> WITHDRAWN`.

`PENDING`은 연락처·성인 확인 전이므로 쓰기·거래를 할 수 없다. `SUSPENDED`와
`WITHDRAWN`은 로그인 및 신규 쓰기가 거부되며 기존 세션도 다음 요청과 소켓
이벤트에서 다시 검사한다.

## 상품

`DRAFT -> LISTED -> RESERVED -> SOLD`, `LISTED|RESERVED -> HIDDEN|DELETED`.

P0에서는 `DRAFT`를 외부에 노출하지 않는다. 소유자만 수정·삭제할 수 있고,
활성 결제·거래가 있는 `RESERVED` 상품은 가격과 핵심 거래 조건을 바꿀 수 없다.
`HIDDEN`, `DELETED`, `SOLD`는 신규 거래 요청 대상이 아니다.

## 거래와 결제

정상 흐름은 `REQUESTED -> ACCEPTED -> PAID_IN_ESCROW -> DELIVERED -> CONFIRMED -> SETTLEMENT_PENDING -> SETTLED`다.
예외 상태는 `REJECTED`, `CANCELLED`, `REFUNDED`, `DISPUTED`, `PAYMENT_FAILED`,
`SETTLEMENT_FAILED`다.

| 명령 | 허용 상태 | 행위자 | 결과 |
| --- | --- | --- | --- |
| 거래 요청 | 상품 `LISTED` | 구매자 | `REQUESTED` |
| 수락·거절 | `REQUESTED` | 판매자 | `ACCEPTED`·`REJECTED` |
| 서버 승인 확인 | `ACCEPTED` | 서버 | `PAID_IN_ESCROW`, 상품 `RESERVED` |
| 인도 완료 | `PAID_IN_ESCROW` | 판매자 | `DELIVERED` |
| 구매확정 | `DELIVERED` | 구매자 또는 자동 작업 | `CONFIRMED` |
| 정산 보류 시작 | `CONFIRMED` | 서버 | `SETTLEMENT_PENDING` |
| 정산 | `SETTLEMENT_PENDING` | 승인된 서버 작업 | `SETTLED` |

`DELIVERED` 후 정확히 7일이 지나면 자동확정을 단 한 번만 시도한다. `CONFIRMED`
후 7일 동안 정산을 보류한다. 취소·환불·분쟁 접수는 정산을 중지한다. 분쟁은
재인증된 최고관리자 1인의 사유 있는 도메인 명령으로만 최종 처리한다. DEC-01에
따라 실정산은 구현하지 않고 Toss sandbox와 테스트 UI만 연결한다.

## 신고와 차단

신고 상태는 `RECEIVED -> IN_REVIEW -> RESOLVED|DISMISSED`다. 신고자는 자신이
접수한 상태만 보고, 내부 메모·다른 신고자·조사 증거는 볼 수 없다. 차단은
관계 레코드로 관리하며 즉시 신규 채팅과 거래 요청을 막고, 차단자 화면에서만
기존 대화와 상대 상품을 숨긴다.
