# Production Runtime - Pre-built Artifacts
FROM node:22-slim
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy bundled backend
COPY server/dist/bundle.js ./server.js

# Copy pre-built frontend
COPY dist ./public

# Expose port
EXPOSE 8080

# Start command
CMD ["node", "server.js"]
