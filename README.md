# Gamja Market

안전한 동네 중고거래 플랫폼의 모노레포입니다.

## 시작하기

Docker와 Docker Compose만 준비하면 전체 애플리케이션을 한 번에 실행할 수 있습니다.

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Compose는 PostgreSQL과 Redis의 healthcheck를 기다린 뒤 데이터베이스 마이그레이션과
멱등 시드를 수행하고, API·Worker·Web을 순서대로 시작합니다. 첫 빌드에는 의존성 설치로
시간이 걸릴 수 있습니다. 소스 변경을 이미지에 다시 반영할 때는 `docker compose up --build -d`를 사용합니다.
로그는 다음 명령으로 확인합니다.

```bash
docker compose logs -f db-init api worker web
```

웹은 `http://localhost:3000`, API 상태 확인은 `http://localhost:4000/api/v1/healthz`에서
가능합니다. 종료하되 데이터는 보존하려면 `docker compose down`, 데이터까지 초기화하려면
`docker compose down -v`를 사용합니다.

### 호스트 개발 모드

애플리케이션만 호스트에서 개발 모드로 실행하려면 인프라 컨테이너를 먼저 시작합니다.

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install --frozen-lockfile
pnpm --filter @gamja/database db:generate
pnpm --filter @gamja/database db:migrate
pnpm --filter @gamja/database db:seed
pnpm dev
```

실제 Toss 결제·실정산은 구현 범위에 포함하지 않습니다.

## 품질 명령

`pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`,
`pnpm test:contract`, `pnpm test:e2e`, `pnpm test:a11y`, `pnpm test:security`를
제공합니다. 자세한 정책은 `docs/`와 `docs/baseline/`을 따릅니다.
