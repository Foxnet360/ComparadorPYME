FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy application code
COPY . .

# Copy tesauro files explicitly to ensure they're in the Docker image
COPY tesauro(pyme).md /app/
COPY tesauro-extensiones.md /app/

# Build the application (frontend + backend)
RUN npm run build

# Create uploads directory
RUN mkdir -p /tmp/uploads

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
