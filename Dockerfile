FROM node:24-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @gamja/database db:generate

FROM workspace AS build

ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY=
ENV NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY
ARG NEXT_PUBLIC_PAYMENT_SANDBOX_MODE=false
ENV NEXT_PUBLIC_PAYMENT_SANDBOX_MODE=$NEXT_PUBLIC_PAYMENT_SANDBOX_MODE

RUN corepack pnpm build

FROM build AS db-init

CMD ["sh", "-c", "corepack pnpm --filter @gamja/database db:deploy && corepack pnpm --filter @gamja/database db:seed"]

FROM build AS api

ENV API_PORT=4000
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM build AS worker

CMD ["node", "apps/worker/dist/main.js"]

FROM build AS web

WORKDIR /workspace/apps/web
ENV PORT=3000
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]

FROM build AS test

RUN corepack pnpm --filter @gamja/web exec playwright install --with-deps chromium

CMD ["sh", "-c", "corepack pnpm test:release"]
