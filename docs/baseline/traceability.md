# 요구사항·화면 추적표

## 기준선 검사

2026-07-23 기준 `docs/requirements.md`의 기능·보안 요구사항은 89개이고,
`docs/page_desc.md`의 페이지는 29개다. 아래 표는 중복 구현을 피하기 위한
WBS·화면·테스트 묶음의 단일 연결점이다. 세부 테스트 ID와 통과 기준은
[`../test_plan.md`](../test_plan.md)를 따른다.

| 요구사항 | 수 | WBS | 화면 | 테스트 묶음 |
| --- | ---: | --- | --- | --- |
| AUTH-001~010 | 10 | WBS-02 | AUTH-01~04, ACCOUNT-01~02 | `*-AUTH-*` |
| ITEM-001~009 | 9 | WBS-03 | PUB-01, PUB-03, SELL-01~03 | `*-ITEM-*` |
| SEARCH-001~007 | 7 | WBS-02.05, WBS-03.05~07 | PUB-01~02 | `*-SEARCH-*` |
| CHAT-001~006 | 6 | WBS-04.01~03, WBS-04.07 | CHAT-01~02 | `*-CHAT-*` |
| PAY-001~015 | 15 | WBS-05, WBS-06.07~08 | TRADE-01~02, PAY-01~02 | `*-TRADE-*`, `UT-TIME-*` |
| PAY-016~025 | 10 | WBS-06, WBS-09.02~04 | PAY-01~02, ADMIN-06, SYS-01 | `*-PAY-*`, `COMP-PCI-*`, `RES-*` |
| SAFE-001~009 | 9 | WBS-04.04~07, WBS-07.03~04 | SAFE-01~03, ADMIN-03~05 | `*-SAFE-*` |
| ADMIN-001~008 | 8 | WBS-07 | ADMIN-01~07 | `*-ADMIN-*`, `*-AUDIT-*` |
| SEC-001~015 | 15 | WBS-01, WBS-09 | 전 화면과 API | `SEC-*`, `A11Y-*`, `COMP-*` |
| **합계** | **89** |  | **29 pages** |  |

## M0 인수 기준

- 모든 요구사항 범위가 하나의 WBS와 테스트 묶음에 연결된다.
- API, 상태, 결제 보안은 각각 `api-contract.md`, `domain-state-model.md`,
  `payment-threat-model.md`가 기준 문서다.
- 승인된 정책은 `decision-register.md`에서 관리한다. 코드는 sandbox 결제 범위, 최고관리자 분쟁 처리, 재인증·감사, 탈퇴 후 1년 데이터 및 2년 로그 보존을 준수한다.

## 변경 규칙

요구사항, 화면, API 또는 상태 전이를 수정할 때에는 이 표와 관련 ADR, OpenAPI,
테스트 ID를 같은 변경에서 갱신한다. P1은 P0 출시 판정을 막지 않지만, 구현하면
같은 추적·검증 규칙을 적용한다.
