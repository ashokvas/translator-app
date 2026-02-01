# Production Dockerfile for Translator App
# Includes LibreOffice for document processing

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS deps

WORKDIR /app

# Install build dependencies for native modules (lightningcss, sharp, canvas, etc.)
# These are needed during npm install to compile native bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (use npm install to handle lock file mismatches)
RUN npm install --legacy-peer-deps

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependencies from deps stage (includes compiled native modules)
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

# Avoid any interactive prompts during apt installs (important in CI / docker builds)
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Install LibreOffice and required system dependencies
#
# NOTE:
# Some VPS/firewalls block outbound HTTP (port 80). Debian apt sources in slim images
# often default to http://deb.debian.org which can cause builds to fail mid-install.
# We switch apt sources to HTTPS and add small retries to make builds more reliable.
# IMPORTANT: ensure `ca-certificates` exists before switching apt to HTTPS, otherwise
# apt may fail TLS verification and then "Unable to locate package ..." will happen.
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends -o Dpkg::Use-Pty=0 ca-certificates; \
    update-ca-certificates; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g; s|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
    fi; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends -o Dpkg::Use-Pty=0 \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    curl \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    fc-cache -f -v

# Create non-root user for security with a proper home directory
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs

# Create necessary directories for LibreOffice to run as non-root user
# LibreOffice needs writable cache/config directories to function properly
RUN mkdir -p /home/nextjs/.cache/dconf \
    && mkdir -p /home/nextjs/.config/libreoffice \
    && mkdir -p /tmp/.X11-unix \
    && chown -R nextjs:nodejs /home/nextjs \
    && chmod -R 755 /home/nextjs

# Set HOME environment variable so LibreOffice finds its config directory
ENV HOME=/home/nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LIBREOFFICE_PATH=/usr/bin/soffice
# PORT will be set by Coolify dynamically (defaults to 3000 in startup script)
ENV HOSTNAME="0.0.0.0"

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy convex files (needed for runtime)
COPY --from=builder /app/convex ./convex

# Create directory for Google Cloud credentials
RUN mkdir -p /app/secrets && chown nextjs:nodejs /app/secrets

# Script to decode Google Cloud credentials at runtime and start server
COPY --chown=nextjs:nodejs <<'EOF' /app/setup-credentials.sh
#!/bin/bash
set -e

# Decode Google Cloud credentials if provided
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" ]; then
    # Remove all whitespace, newlines, and the % character (common shell prompt artifact)
    CLEAN_BASE64=$(echo -n "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" | tr -d '[:space:]%')
    
    # Check if base64 string is not empty after cleaning
    if [ -z "$CLEAN_BASE64" ]; then
        echo "⚠ Warning: GOOGLE_APPLICATION_CREDENTIALS_BASE64 is empty after cleaning"
    else
        # Try to decode base64 and write to file, capture error output
        DECODE_ERROR=$(echo -n "$CLEAN_BASE64" | base64 -d > /app/secrets/google-credentials.json 2>&1)
        if [ $? -eq 0 ] && [ -s /app/secrets/google-credentials.json ]; then
            export GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/google-credentials.json
            echo "✓ Google Cloud credentials configured successfully"
        else
            echo "⚠ Warning: Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64"
            echo "  Error: $DECODE_ERROR"
            echo "  Base64 length: ${#CLEAN_BASE64} characters"
            echo "  (Tip) Re-generate base64 with: base64 -w0 service-account.json"
        fi
    fi
else
    echo "⚠ Warning: GOOGLE_APPLICATION_CREDENTIALS_BASE64 not set (app may use API key instead)"
fi

# IMPORTANT:
# Coolify may inject a dynamic PORT env var. For Next.js standalone behind Traefik,
# we want a stable internal port that matches Traefik's service label.
# Coolify's generated Traefik label uses server.port=3000, so force the app to bind to 3000.
export PORT=3000
export HOSTNAME="0.0.0.0"

echo "Starting Next.js server on ${HOSTNAME}:${PORT}"

# Start the server
exec "$@"
EOF
RUN chmod +x /app/setup-credentials.sh

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Use the setup script as entrypoint
ENTRYPOINT ["/app/setup-credentials.sh"]
CMD ["node", "server.js"]

