# KAR-TA BASKI — VPS/Docker derlemesi (Vercel yerine). Ayrıntı: docs/YAYIN.md
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Görsel optimizasyonu için sharp (standalone çıktıya izlenerek dahil edilir)
RUN npm install --no-save sharp
# NEXT_PUBLIC_* değerleri derleme anında koda gömülür: sunucudaki .env burada okunur.
# Bu katman son imaja girmez (çok aşamalı derleme), sırlar imajda kalmaz.
ENV DOCKER_BUILD=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown -R app:app .next
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null 2>&1 || exit 1
CMD ["node", "server.js"]
