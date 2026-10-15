# Build from the repo root:  docker build -f apps/api/Dockerfile -t housefull-api .
FROM node:24.21.0-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@housefull/api...
# Self-contained production bundle: the API plus built workspace packages, prod deps only.
RUN pnpm --filter @housefull/api deploy --prod --legacy /out

FROM node:24.21.0-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
