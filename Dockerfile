FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript compilation)
RUN npm ci

# Copy source code and assets
COPY src ./src
COPY db ./db
COPY public ./public
COPY tsconfig.json .

# Compile TypeScript
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --omit=dev

# Create upload directory
RUN mkdir -p /data/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start the server
CMD ["node", "dist/server.js"]
