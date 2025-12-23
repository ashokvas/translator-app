# Production Dockerfile for Translator App
# Includes LibreOffice for document processing

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production=false

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:20-slim AS runner

WORKDIR /app

# Install LibreOffice and required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy convex files (needed for runtime)
COPY --from=builder /app/convex ./convex

# Create directory for Google Cloud credentials
RUN mkdir -p /app/secrets && chown nextjs:nodejs /app/secrets

# Script to decode Google Cloud credentials at runtime
COPY --chown=nextjs:nodejs <<'EOF' /app/setup-credentials.sh
#!/bin/bash
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" ]; then
    echo "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" | base64 -d > /app/secrets/google-credentials.json
    export GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/google-credentials.json
    echo "Google Cloud credentials configured"
fi
exec "$@"
EOF
RUN chmod +x /app/setup-credentials.sh

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Use the setup script as entrypoint
ENTRYPOINT ["/app/setup-credentials.sh"]
CMD ["node", "server.js"]

