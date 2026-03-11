FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci --only=production

COPY dist ./dist
COPY .env.production ./.env 2>/dev/null || true

RUN apk add --no-cache python3 make g++

EXPOSE 8080

CMD ["node", "dist/index.js"]
