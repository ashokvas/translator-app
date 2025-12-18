# Deployment Guide - Translator App

## Overview

This app requires LibreOffice for DOCX/XLSX processing, which makes deployment more complex than typical Next.js apps. We'll use a **hybrid approach**:

- **Vercel**: Main Next.js app (fast, free tier available)
- **Railway/Render**: Separate service for LibreOffice processing
- **Convex**: Already cloud-hosted (no deployment needed)
- **Clerk**: Already cloud-hosted (no deployment needed)

---

## 🚀 Option 1: Vercel + Railway (Recommended)

### Architecture
```
User → Vercel (Next.js) → Railway (LibreOffice Service) → Convex (Database)
                        → Google Cloud APIs
                        → PayPal APIs
```

### Step 1: Create LibreOffice Microservice

Create a separate Node.js service that handles office file processing.

#### 1.1 Create new directory for the service

```bash
mkdir libreoffice-service
cd libreoffice-service
npm init -y
npm install express multer pdf-parse
```

#### 1.2 Create `server.js`

```javascript
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const PDFParse = require('pdf-parse');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'libreoffice-service' });
});

// Count pages in office document
app.post('/count-pages', upload.single('file'), async (req, res) => {
  let tempPdfPath = null;
  
  try {
    const inputPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    if (!['.docx', '.xlsx', '.doc', '.xls'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Convert to PDF
    tempPdfPath = path.join(os.tmpdir(), `converted-${Date.now()}.pdf`);
    
    await new Promise((resolve, reject) => {
      const libreoffice = spawn('soffice', [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        os.tmpdir(),
        inputPath,
      ]);

      libreoffice.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`LibreOffice exited with code ${code}`));
      });

      libreoffice.on('error', reject);
    });

    // Read converted PDF
    const pdfBuffer = await fs.readFile(tempPdfPath);
    const pdfData = await PDFParse(pdfBuffer);
    let pageCount = pdfData.numpages;

    // Check if last page is blank
    const lastPageText = pdfData.text.split('\f').pop() || '';
    if (lastPageText.trim().length < 50 && pageCount > 1) {
      pageCount--;
    }

    // Cleanup
    await fs.unlink(inputPath);
    await fs.unlink(tempPdfPath);

    res.json({ pageCount });
  } catch (error) {
    console.error('Error processing file:', error);
    
    // Cleanup on error
    try {
      if (req.file?.path) await fs.unlink(req.file.path);
      if (tempPdfPath) await fs.unlink(tempPdfPath);
    } catch {}

    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LibreOffice service running on port ${PORT}`);
});
```

#### 1.3 Create `Dockerfile`

```dockerfile
FROM node:20-slim

# Install LibreOffice
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

#### 1.4 Create `.dockerignore`

```
node_modules
npm-debug.log
.env
.git
```

### Step 2: Deploy LibreOffice Service to Railway

1. **Sign up for Railway**: https://railway.app (free tier available)
2. **Create new project** → "Deploy from GitHub repo"
3. **Connect your GitHub** and select the `libreoffice-service` repo
4. Railway will auto-detect the Dockerfile and deploy
5. **Get the service URL**: e.g., `https://your-service.railway.app`
6. **Test it**:
   ```bash
   curl https://your-service.railway.app/health
   ```

### Step 3: Update Your Main App

Modify `app/api/upload/route.ts` to use the remote service:

```typescript
// At the top of the file
const LIBREOFFICE_SERVICE_URL = process.env.LIBREOFFICE_SERVICE_URL;

async function countOfficePages(buffer: Buffer, filename: string): Promise<number> {
  // If running locally with LibreOffice installed
  if (process.env.LIBREOFFICE_PATH && !LIBREOFFICE_SERVICE_URL) {
    // ... existing local LibreOffice code ...
  }
  
  // If using remote LibreOffice service
  if (LIBREOFFICE_SERVICE_URL) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([buffer]), filename);
      
      const response = await fetch(`${LIBREOFFICE_SERVICE_URL}/count-pages`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Service error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.pageCount;
    } catch (error) {
      console.error('LibreOffice service error:', error);
      throw new Error('Failed to process office document');
    }
  }
  
  throw new Error('LibreOffice not configured');
}
```

### Step 4: Deploy Main App to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd /Users/ashok/Documents/Translator-app
   vercel
   ```

4. **Set Environment Variables** in Vercel Dashboard:
   - Go to: https://vercel.com/dashboard
   - Select your project → Settings → Environment Variables
   - Add all variables from `.env.local`:
     ```
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
     CLERK_SECRET_KEY=...
     NEXT_PUBLIC_CONVEX_URL=...
     CONVEX_DEPLOYMENT=...
     NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
     GOOGLE_CLOUD_API_KEY=...
     GOOGLE_CLOUD_PROJECT_ID=...
     LIBREOFFICE_SERVICE_URL=https://your-service.railway.app
     ```

5. **Redeploy** after adding env vars:
   ```bash
   vercel --prod
   ```

### Step 5: Configure Production Services

#### Convex Production
1. Go to: https://dashboard.convex.dev
2. Create production deployment
3. Update `NEXT_PUBLIC_CONVEX_URL` in Vercel with production URL

#### Clerk Production
1. Go to: https://dashboard.clerk.com
2. Create production instance
3. Update Clerk keys in Vercel
4. Add production domain to allowed domains

#### PayPal Production
1. Go to: https://developer.paypal.com
2. Switch from Sandbox to Live credentials
3. Update `NEXT_PUBLIC_PAYPAL_CLIENT_ID` in Vercel

---

## 🐳 Option 2: Full Docker Deployment (VPS)

Deploy everything on a VPS (DigitalOcean, AWS EC2, Linode, etc.)

### Step 1: Create Production Dockerfile

```dockerfile
FROM node:20-slim

# Install LibreOffice
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy app files
COPY . .

# Build Next.js app
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Step 2: Create `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
      - CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
      - NEXT_PUBLIC_PAYPAL_CLIENT_ID=${NEXT_PUBLIC_PAYPAL_CLIENT_ID}
      - GOOGLE_CLOUD_API_KEY=${GOOGLE_CLOUD_API_KEY}
      - GOOGLE_CLOUD_PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID}
      - LIBREOFFICE_PATH=/usr/bin/soffice
    restart: unless-stopped
```

### Step 3: Deploy to VPS

1. **Provision a VPS** (e.g., DigitalOcean Droplet, 2GB RAM minimum)

2. **SSH into server**:
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

4. **Clone your repo**:
   ```bash
   git clone https://github.com/ashokvas/translator-app.git
   cd translator-app
   ```

5. **Create `.env.production`** with all your environment variables

6. **Build and run**:
   ```bash
   docker-compose --env-file .env.production up -d
   ```

7. **Set up Nginx reverse proxy** (optional, for HTTPS):
   ```bash
   apt-get install nginx certbot python3-certbot-nginx
   ```

   Create `/etc/nginx/sites-available/translator-app`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable and get SSL:
   ```bash
   ln -s /etc/nginx/sites-available/translator-app /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   certbot --nginx -d yourdomain.com
   ```

---

## 📊 Comparison

| Feature | Vercel + Railway | VPS Docker |
|---------|------------------|------------|
| **Ease of Setup** | ⭐⭐⭐⭐⭐ Easy | ⭐⭐⭐ Moderate |
| **Cost (monthly)** | $0-20 | $10-50 |
| **Scalability** | Auto-scaling | Manual |
| **Maintenance** | Low | Medium |
| **Performance** | Excellent | Good |
| **LibreOffice** | Separate service | Integrated |
| **Best For** | Production apps | Full control needed |

---

## ✅ Pre-Deployment Checklist

- [ ] Test all features locally
- [ ] Update all environment variables for production
- [ ] Switch PayPal to live credentials
- [ ] Enable Google Cloud API billing
- [ ] Set up production Convex deployment
- [ ] Create production Clerk instance
- [ ] Test file uploads with all formats
- [ ] Test translation workflow end-to-end
- [ ] Test payment processing
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Configure email service (Resend, SendGrid)
- [ ] Set up domain and SSL certificate
- [ ] Test on mobile devices
- [ ] Create backup strategy for Convex data

---

## 🔒 Security Considerations

1. **Never commit `.env.local` or `.env.production`**
2. **Use environment variables** for all secrets
3. **Enable HTTPS** (SSL certificate)
4. **Set up CORS** properly for API routes
5. **Rate limit** API endpoints (especially upload/translate)
6. **Validate file uploads** (size, type, malware scanning)
7. **Sanitize user inputs**
8. **Keep dependencies updated**: `npm audit fix`

---

## 📈 Post-Deployment

### Monitoring
- Set up Vercel Analytics
- Configure error tracking (Sentry)
- Monitor API usage (Google Cloud Console)
- Track Convex usage

### Performance
- Enable Next.js caching
- Optimize images
- Use CDN for static assets
- Monitor Core Web Vitals

### Backups
- Regular Convex data exports
- Database backup strategy
- Store uploaded files redundantly

---

## 🆘 Troubleshooting

### LibreOffice service fails
- Check Railway logs: `railway logs`
- Verify Dockerfile builds locally: `docker build -t test .`
- Test endpoint: `curl https://your-service.railway.app/health`

### Vercel deployment fails
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Test build locally: `npm run build`

### Translation API errors
- Verify Google Cloud billing is enabled
- Check API quotas in Google Cloud Console
- Confirm API keys are correct

### File upload fails
- Check Convex storage limits
- Verify file size limits (10MB)
- Check network connectivity

---

## 💰 Estimated Costs (Monthly)

### Vercel + Railway Approach
- **Vercel**: Free (Hobby) or $20 (Pro)
- **Railway**: Free tier (500 hours) or $5-10
- **Convex**: Free tier or $25+
- **Google Cloud**: Pay-per-use (~$1-50 depending on volume)
- **Total**: $0-100/month

### VPS Approach
- **DigitalOcean Droplet**: $12-24/month
- **Domain**: $10-15/year
- **Convex**: Free tier or $25+
- **Google Cloud**: Pay-per-use (~$1-50)
- **Total**: $15-100/month

---

## 🎯 Recommended: Start with Vercel + Railway

1. Easiest to set up
2. Free tier available
3. Auto-scaling
4. Easy rollbacks
5. Great developer experience

You can always migrate to VPS later if needed.

