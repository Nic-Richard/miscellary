FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS dev
EXPOSE 3000
