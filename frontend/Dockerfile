# Cloud Run 用 Dockerfile
# Next.js アプリケーションをコンテナ化

FROM node:20-alpine AS base

# 依存関係インストール用ステージ
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package.json package-lock.json* ./
RUN npm ci

# ビルド用ステージ
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 環境変数（ビルド時に必要なもの）
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js をビルド
RUN npm run build

# 本番用ステージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 必要なファイルをコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# knowledge ディレクトリをコピー（読み取り専用の設定ファイル用）
COPY --from=builder /app/knowledge ./knowledge

USER nextjs

# Cloud Run は PORT 環境変数を設定する
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
