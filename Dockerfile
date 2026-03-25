# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Add build tools for native modules if needed
RUN apk add --no-cache python3 make g++

RUN npm ci --only=production

# Copy pre-built application
COPY dist ./dist

# Optionally copy .env.production if it exists
COPY .env.production* ./.env

# Set environment variables
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
