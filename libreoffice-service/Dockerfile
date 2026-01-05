FROM node:20-slim

# Install LibreOffice and required dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# Create non-root user with proper home directory for LibreOffice
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nodejs nodejs

# Create necessary directories for LibreOffice to run as non-root user
RUN mkdir -p /home/nodejs/.cache/dconf \
    && mkdir -p /home/nodejs/.config/libreoffice \
    && chown -R nodejs:nodejs /home/nodejs \
    && chmod -R 755 /home/nodejs

# Set HOME environment variable
ENV HOME=/home/nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js ./

# Create temp directory for file processing and set permissions
RUN mkdir -p /tmp/uploads \
    && chown -R nodejs:nodejs /tmp/uploads \
    && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the service
CMD ["node", "server.js"]


