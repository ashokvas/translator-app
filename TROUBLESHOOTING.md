# Troubleshooting Deployment Issues

## Issue: "no available server" / HTTP 503 Service Unavailable

If you're seeing a 503 error after deployment, follow these steps:

### Step 1: Check Container Logs in Coolify

1. Go to your deployment in Coolify
2. Click on **"Logs"** tab
3. Look for:
   - Error messages
   - "Starting Next.js server" message
   - Any crash/exit messages
   - Missing environment variable warnings

**Common errors to look for:**
- `Error: Cannot find module` - Missing dependencies
- `EADDRINUSE` - Port conflict
- `Missing environment variable` - Configuration issue
- `Google Cloud credentials` errors

### Step 2: Verify Environment Variables

In Coolify, go to your deployment → **Configuration** → **Environment Variables**

**Required variables:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL
- `CONVEX_DEPLOYMENT` - Your Convex deployment name
- `GOOGLE_APPLICATION_CREDENTIALS_BASE64` - Base64 encoded Google Cloud service account JSON
- `GOOGLE_CLOUD_PROJECT_ID` - Your Google Cloud project ID
- `PORT` - Should be set automatically by Coolify (don't override unless needed)
- `HOSTNAME` - Should be `0.0.0.0` (set automatically)

**Optional but recommended:**
- `GOOGLE_CLOUD_API_KEY` - Alternative to service account
- `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `https://translatoraxis.com`)

### Step 3: Check Port Configuration

1. In Coolify, go to **Configuration** → **Ports**
2. Ensure the port mapping is correct (usually Coolify handles this automatically)
3. The app should listen on the port Coolify assigns (check `PORT` env var)

### Step 4: Test Health Check Endpoint

1. In Coolify, go to **Terminal** tab
2. Run:
   ```bash
   curl http://localhost:${PORT}/api/health
   ```
   (Replace `${PORT}` with the actual port number from environment variables)

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-23T...",
  "service": "translator-app"
}
```

### Step 5: Check Container Status

1. In Coolify, check the deployment status
2. If status is **"Exited"**, check logs for exit reason
3. If status is **"Running"** but still getting 503, check:
   - DNS configuration
   - Traefik routing rules
   - SSL certificate status

### Step 6: Verify DNS Configuration

1. Ensure your domain (`translatoraxis.com`) has an **A record** pointing to your VPS IP
2. Check DNS propagation:
   ```bash
   dig translatoraxis.com
   # or
   nslookup translatoraxis.com
   ```

### Step 7: Check Traefik Configuration (Coolify)

Coolify uses Traefik as a reverse proxy. Verify:
1. Domain is correctly configured in Coolify
2. SSL certificate is issued (check in Coolify dashboard)
3. Traefik is routing to your container correctly

### Step 8: Common Fixes

#### Fix 1: Missing Environment Variables
If logs show missing env vars:
1. Add all required variables in Coolify
2. Redeploy the application

#### Fix 2: Google Cloud Credentials Issue
If you see Google Cloud errors:
1. Verify `GOOGLE_APPLICATION_CREDENTIALS_BASE64` is set correctly
2. Test base64 encoding:
   ```bash
   # On your local machine
   base64 -i translation-app-480807-4b54abde49b5.json | tr -d '\n'
   ```
3. Copy the entire output (no newlines) to Coolify

#### Fix 3: Port Binding Issue
If you see port errors:
1. Don't manually set `PORT` in Coolify (let it auto-assign)
2. Ensure `HOSTNAME=0.0.0.0` is set
3. Check that no other service is using the port

#### Fix 4: Application Crash on Startup
If the container exits immediately:
1. Check logs for the exact error
2. Verify all dependencies are installed
3. Check if Convex/Clerk URLs are accessible from the container
4. Verify Google Cloud credentials are valid

### Step 9: Manual Container Debugging

If needed, you can debug the container manually:

1. In Coolify, go to **Terminal** tab
2. Run:
   ```bash
   # Check if server.js exists
   ls -la server.js
   
   # Check environment variables
   env | grep -E "(PORT|HOSTNAME|CLERK|CONVEX|GOOGLE)"
   
   # Try starting the server manually
   node server.js
   ```

### Step 10: Rebuild and Redeploy

If nothing else works:
1. In Coolify, go to **Deployments** tab
2. Click **"Redeploy"** or **"Deploy"**
3. Watch the build logs for any errors
4. Check deployment logs after container starts

## Getting Help

If the issue persists, collect this information:

1. **Container logs** (from Coolify Logs tab)
2. **Environment variables** (mask sensitive values)
3. **Deployment configuration** (screenshot of Coolify config)
4. **DNS configuration** (A record details)
5. **Error messages** (exact text from browser/console)

Then share these details for further assistance.
