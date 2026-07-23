# 외부 HTTP 채팅 장애 분석 및 수정 보고서

## 현상

- 대상 화면: `http://1mnhomenetwork.iptime.org:30001/chats/{chatId}`
- 표시 상태: “실시간 연결을 복구하는 중입니다. 메시지는 안전한 대체 경로로
  전송됩니다.”
- 실제 현상: 전송 버튼을 눌러도 화면과 DB에 메시지가 추가되지 않음

## 원인

두 가지 독립 원인이 동시에 있었다.

1. 외부 HTTP 주소는 안전한 브라우저 컨텍스트가 아니므로
   `window.crypto.randomUUID`가 제공되지 않았다. 전송 함수가 REST·Socket 분기보다
   먼저 이를 호출해 `crypto.randomUUID is not a function` 예외로 종료됐다.
2. Web 빌드의 Socket.IO 주소가 `http://localhost:4000`으로 고정돼 있었다. 외부
   사용자의 브라우저에서 `localhost`는 서버가 아닌 사용자 기기를 의미하며,
   외부 라우터에는 API 포트도 공개돼 있지 않아 연결할 수 없었다.

실제 외부 Chromium 재현 값은 `isSecureContext=false`,
`typeof crypto.randomUUID='undefined'`, `typeof crypto.getRandomValues='function'`이었고,
전송 클릭 시 위 TypeError와 DB 메시지 0건을 확인했다.

## 수정

- `crypto.randomUUID`가 없는 HTTP 환경에서는 `crypto.getRandomValues`로 RFC 4122
  UUID v4를 생성하는 공통 클라이언트 ID 함수를 추가했다.
- UUID 함수는 채팅 메시지 멱등 ID뿐 아니라 거래·결제 멱등 ID에도 적용했다.
- Next.js Web에 같은 출처 `/socket.io` 폴링 프록시를 추가했다. 브라우저는 더
  이상 외부에 공개되지 않은 API 포트나 `localhost:4000`에 직접 연결하지 않는다.
- Socket.IO 클라이언트는 외부 포트와 관계없이 현재 Web Origin의
  `/socket.io`를 사용한다.
- 프록시는 브라우저 쿠키를 내부 API에 전달하므로 기존 세션·채팅 참여자·차단
  검사가 그대로 적용된다.

## 실제 두 계정 검증

외부 주소에서 새 판매자와 구매자를 각각 가입·인증·로그인하고 상품 등록과 거래
요청으로 채팅방을 생성했다.

| 검증 | 결과 |
| --- | --- |
| 외부 `/socket.io` Engine.IO handshake | HTTP 200 |
| 판매자 실시간 연결 | 성공 |
| 구매자 실시간 연결 | 성공 |
| 구매자 메시지를 판매자가 새로고침 없이 수신 | 성공 |
| 판매자 답장을 구매자가 새로고침 없이 수신 | 성공 |
| Socket 요청 강제 차단 후 REST 대체 저장 | 성공 |
| 대체 저장 메시지를 판매자 재조회에서 확인 | 성공 |
| 브라우저 JavaScript 예외 | 0건 |

검증 채팅방 `cmrxkgtaw000i01ujf282fvyx`을 PostgreSQL에서 직접 조회한 결과 참가자
2명, 메시지 3건이 저장됐다. 세 메시지는 구매자 실시간 전송, 판매자 실시간 답장,
Socket 차단 상태의 REST 대체 전송이다.

## 자동 회귀

- 프로덕션 빌드 통과
- Lint·Typecheck 통과
- 단위 테스트: HTTP UUID 대체 생성 2건 포함 통과
- `E2E-MARKET-001`: 두 계정 양방향 실시간 수신과 전체 거래 여정 통과
- `E2E-CHAT-010`: 동일 출처 Socket.IO handshake 통과

## 운영 참고

현재 프록시는 방화벽에 API 포트를 추가로 공개하지 않고 Socket.IO long-polling을
제공한다. HTTPS/WSS와 WebSocket Upgrade를 지원하는 운영 리버스 프록시를 구성하면
연결 오버헤드를 더 줄일 수 있다. UUID는 멱등성 식별자이며 인증 비밀로 사용하지
않는다.
