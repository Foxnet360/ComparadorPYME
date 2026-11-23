FROM node:20-alpine AS builder

WORKDIR /app

# Build toolchain only needed during native dependency compilation
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev pixman-dev

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time client config for frontend bundle (Supabase anon credentials are
# public by design; RLS enforces authorization). Declaring ARGs allows Docker to
# receive Railway service variables during build.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_ENABLE_ADVANCED_ANALYSIS
ARG VITE_ENABLE_MULTIMODAL_EXTRACTION
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ENABLE_ADVANCED_ANALYSIS=$VITE_ENABLE_ADVANCED_ANALYSIS
ENV VITE_ENABLE_MULTIMODAL_EXTRACTION=$VITE_ENABLE_MULTIMODAL_EXTRACTION

# Build frontend + backend, then strip devDependencies before copying to runtime
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app

# Runtime binaries required by pdf2pic for rendering PDF pages to images
RUN apk add --no-cache graphicsmagick ghostscript

COPY package*.json index.js ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/data ./data

RUN mkdir -p /tmp/uploads

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
