# M0 기준선 산출물

이 디렉터리는 WBS-00의 산출물을 보관한다. 이후 구현은 아래 문서를 변경
계약으로 사용한다.

| WBS | 산출물 | 상태 |
| --- | --- | --- |
| WBS-00.01 | `traceability.md` | 검토중 |
| WBS-00.02 | `decision-register.md` | 승인 반영 (DEC-05 수치 기준 보완 필요, DEC-06 PostgreSQL 이미지 저장) |
| WBS-00.03 | `adr/0001-architecture-baseline.md` | 검토중 |
| WBS-00.04 | `domain-state-model.md` | 검토중 |
| WBS-00.05 | `api-contract.md`, `openapi.yaml` | 검토중 |
| WBS-00.06 | `payment-threat-model.md` | 검토중 |

`node scripts/verify-baseline.mjs`는 문서 간 필수 링크, 요구사항 수와 API
계약의 최소 형식을 점검한다. 이는 구현 테스트를 대신하지 않으며 M0 문서의
회귀 검사다.

