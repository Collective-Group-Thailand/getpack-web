# syntax=docker/dockerfile:1.7
# getpack-web production image: Next.js standalone server on :3000, one container for all three
# zones (customer / admin / partner, chosen by Host header in src/proxy.ts).
#
# NEXT_PUBLIC_* values are inlined at build time, so they arrive as build args per environment.
# The server env (PUBLIC_HOST, ADMIN_HOST, PARTNER_HOST, API_INTERNAL_URL, …) is read at run time from
# the container env; the build only needs valid values because NODE_ENV=production validates them.
# Built natively on an arm64 runner (collective-infra reusable-build-push.yml).

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- deps: workspace install (the app + packages/dieline) ----------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/dieline/package.json ./packages/dieline/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- build -----------------------------------------------------------------------------------------
FROM deps AS build
COPY . .
ARG PUBLIC_HOST=localhost:3000
ARG ADMIN_HOST=admin.localhost:3000
ARG PARTNER_HOST=partner.localhost:3000
ARG API_INTERNAL_URL=http://getpack-api:3000
ARG NEXT_PUBLIC_ENV_BADGE
ARG NEXT_PUBLIC_ASSET_BASE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_LIFF_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV PUBLIC_HOST=$PUBLIC_HOST ADMIN_HOST=$ADMIN_HOST PARTNER_HOST=$PARTNER_HOST API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_PUBLIC_ENV_BADGE=$NEXT_PUBLIC_ENV_BADGE \
    NEXT_PUBLIC_ASSET_BASE_URL=$NEXT_PUBLIC_ASSET_BASE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_LIFF_ID=$NEXT_PUBLIC_LIFF_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# CI type-checked this commit before the deploy workflow could run (next.config.ts).
RUN NODE_OPTIONS=--max-old-space-size=4096 NEXT_SKIP_TYPECHECK=1 pnpm build

# --- runtime ---------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
