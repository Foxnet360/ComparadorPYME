# ==========================================
# STAGE 1: Build Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copiar package.json raíz e instalar dependencias del frontend
COPY package*.json ./
RUN npm ci

# Copiar código fuente frontend
COPY index.html ./
COPY index.css ./
COPY index.tsx ./
COPY index.js ./
COPY App.tsx ./
COPY components/ ./components/
COPY services/ ./services/
COPY types.ts ./
COPY constants.ts ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.cjs ./
COPY tailwind.config.cjs ./

# Variables de entorno necesarias en build time del frontend
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Build del frontend (produce dist/)
RUN npm run build

# ==========================================
# STAGE 2: Build Backend
# ==========================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/server

# Copiar package.json del backend e instalar
COPY server/package*.json ./
RUN npm ci

# Copiar código fuente backend
COPY server/src/ ./src/
COPY server/tsconfig.json ./
COPY server/.env.example ./

# Build del backend (produce dist/)
RUN npm run build

# ==========================================
# STAGE 3: Production
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# Copiar entry point principal
COPY index.js ./

# Copiar frontend compilado desde stage 1
COPY --from=frontend-builder /app/dist ./dist

# Copiar backend compilado y sus dependencias desde stage 2
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/package.json ./server/
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# Crear directorio de uploads
RUN mkdir -p /tmp/uploads

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8080

# Puerto expuesto
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["npm", "start"]
