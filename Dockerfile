# syntax=docker/dockerfile:1
# Multi-stage production image (OPS-1 / DEV-3).
# See Informe_deuda.md: the previous single-stage image copied the whole
# repo (including .env*) and kept build tooling in the final image.
# .dockerignore already excludes .env*, node_modules and build outputs.

########## Stage 1: deps — full install (incl. dev) needed for building ##########
FROM node:20-alpine AS deps
WORKDIR /app

# Build dependencies for native modules (canvas, sharp) and PDF rendering
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev pixman-dev

# Layer-cache-friendly: copy manifests first, install second
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

########## Stage 2: build — compile frontend (dist/) and backend (server/dist/) ##########
FROM deps AS build
COPY . .
RUN npm run build

########## Stage 3: prod-deps — production node_modules only ##########
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

########## Stage 4: runtime — minimal production image, non-root ##########
FROM node:20-alpine AS runtime
WORKDIR /app

# GraphicsMagick + Ghostscript: runtime requirement of pdf2pic (PDF page rendering)
RUN apk add --no-cache graphicsmagick ghostscript

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY index.js ./
# Tesauro reference docs are read by the extraction pipeline at runtime
COPY "tesauro(pyme).md" /app/
COPY tesauro-extensiones.md /app/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Upload scratch space; world-writable so the non-root user can write there
RUN mkdir -p /tmp/uploads

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "index.js"]
