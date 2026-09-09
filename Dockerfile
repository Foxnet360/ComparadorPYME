FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install canvas dependencies (optional, suppresses pdfjs-dist warnings)
RUN apk add --no-cache cairo-dev pango-dev pixman-dev

# Install GraphicsMagick and Ghostscript for pdf2pic to render PDF pages to images
RUN apk add --no-cache graphicsmagick ghostscript

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy application code
COPY . .

# Copy tesauro files explicitly to ensure they're in the Docker image
COPY tesauro(pyme).md /app/
COPY tesauro-extensiones.md /app/

# Build the application (frontend + backend).
# Client config (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) is read by
# vite.config.ts via loadEnv from the build environment — do NOT pass it
# through ARG/ENV (Docker linter flags it and it bakes values into the image).
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
