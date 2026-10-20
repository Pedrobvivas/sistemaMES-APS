# Imagem de produção do projeto-base (usada pelo Coolify ou por `docker build`).

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2. Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* entra no código no momento do build.
ARG NEXT_PUBLIC_APP_NAME="Camargo MES"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
# Valores provisórios só para o build; os reais vêm do ambiente em execução.
RUN BETTER_AUTH_SECRET=somente-para-o-build \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    npm run build

# 3. Execução
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migrations do banco, aplicadas ao iniciar (veja src/instrumentation.ts).
COPY --from=build --chown=app:app /app/drizzle ./drizzle

USER app
EXPOSE 3000
CMD ["node", "server.js"]
