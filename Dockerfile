# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Add build tools for native modules if needed
RUN apk add --no-cache python3 make g++

RUN npm ci --only=production

# Copy entry point
COPY index.js ./

# Copy pre-built frontend
COPY dist ./dist

# Copy pre-built backend
COPY server/dist ./server/dist
COPY server/package.json ./server/

# Optionally copy .env.production if it exists
COPY .env.production* ./.env

# Set environment variables
ENV NODE_ENV=production

# Railway assigns PORT dynamically, we listen on it via process.env.PORT
EXPOSE 8080

CMD ["npm", "start"]