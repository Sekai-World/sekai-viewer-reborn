FROM node:24-alpine AS deps

WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/content-site/package.json apps/content-site/package.json
COPY packages/sekai-master-api-sdk/package.json packages/sekai-master-api-sdk/package.json
COPY packages/auth-client/package.json packages/auth-client/package.json
COPY packages/i18n-runtime/package.json packages/i18n-runtime/package.json
COPY packages/ui-shell/package.json packages/ui-shell/package.json
COPY packages/ui-tokens/package.json packages/ui-tokens/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build

COPY . .
RUN rm tsconfig.json \
  && pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild esbuild
RUN pnpm --filter @apps/content-site exec svelte-kit sync
RUN pnpm --filter @apps/content-site build

FROM node:24-alpine AS runner

WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /repo/apps/content-site/build ./build

USER appuser
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["node", "build"]
