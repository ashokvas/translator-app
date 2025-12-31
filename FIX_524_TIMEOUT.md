# Fix Cloudflare 524 Timeout Error

## Problem

When translating documents (especially using OpenRouter GPT-5.2 with vision/certificates), you get:

```
Error code 524: A timeout occurred
The origin web server timed out responding to this request.
```

## Root Cause

| Component | Timeout Setting |
|-----------|-----------------|
| **Cloudflare Proxy** | **100 seconds** (free/pro plans) |
| **Your App** | 300 seconds (5 minutes) |
| **OpenRouter** | 300 seconds (5 minutes) |

**Cloudflare terminates the connection after 100 seconds**, even though your server is still processing.

Vision-based translations (GPT-5.2 with certificate domain) can take 2-4 minutes because:
1. First pass: Extract text from image + translate
2. Second pass: Refinement for table alignment

## Solutions

### Solution 1: Use API Subdomain (Recommended - Quick Fix)

Create a subdomain like `api.translatoraxis.com` that **bypasses Cloudflare proxy** (gray-cloud/DNS-only).

#### Step 1: Add DNS Record in Cloudflare

1. Go to **Cloudflare Dashboard** → **translatoraxis.com** → **DNS**
2. Click **Add record**
3. Add:
   - **Type**: A
   - **Name**: `api`
   - **IPv4 address**: `213.199.50.227` (your VPS IP)
   - **Proxy status**: **DNS only** (gray cloud) ⚠️ Important!
4. Click **Save**

#### Step 2: Configure Coolify/Traefik

Add `api.translatoraxis.com` as an additional domain in your Coolify deployment:

1. Open **Coolify Dashboard**
2. Go to your **translator-app** project
3. Click **General** tab
4. In the **Domains** field, add:
   ```
   translatoraxis.com,api.translatoraxis.com
   ```
5. Click **Save**
6. Go to **Deployment** tab → **Redeploy**

#### Step 3: Update Environment Variable

Add this to your Coolify environment variables:

```bash
# Use direct API endpoint for long-running operations (bypasses Cloudflare proxy)
NEXT_PUBLIC_API_BASE_URL=https://api.translatoraxis.com
```

**In Coolify:**
1. Go to your **translator-app** project
2. Click **Environment Variables** tab
3. Add: `NEXT_PUBLIC_API_BASE_URL` = `https://api.translatoraxis.com`
4. Click **Save**
5. **Redeploy** the application

#### Step 4: Update Frontend Code to Use API Subdomain

The translation API is called from two files. You need to update them to use the environment variable.

**File 1: `components/admin/order-management.tsx`**

Find this code (around line 195):
```typescript
const response = await fetch('/api/translate', {
```

Change it to:
```typescript
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const response = await fetch(`${apiBase}/api/translate`, {
```

**File 2: `components/admin/translation-review.tsx`**

Find this code (around line 201):
```typescript
const response = await fetch('/api/translate', {
```

Change it to:
```typescript
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const response = await fetch(`${apiBase}/api/translate`, {
```

#### Step 5: SSL Certificate for API Subdomain

Without Cloudflare proxy, you need a valid SSL certificate. Coolify with Traefik handles this automatically via Let's Encrypt.

**Verify in Coolify:**
1. Go to your **translator-app** project
2. Check that **HTTPS** is enabled
3. Traefik will automatically get a Let's Encrypt certificate for `api.translatoraxis.com`

If you see SSL errors, check:
```bash
# SSH into your VPS
ssh root@213.199.50.227

# Check Traefik logs for certificate issues
docker logs coolify-proxy --tail 100 | grep -i "api.translatoraxis"
```

#### Step 6: Verify the Setup

After redeployment, test:

```bash
# Test that the API subdomain works (no Cloudflare proxy)
curl -I https://api.translatoraxis.com/api/health

# Expected: HTTP 200 OK
# The response should NOT have "server: cloudflare" header
```

**Check headers:**
- ✅ No `cf-ray` header = Cloudflare proxy bypassed
- ✅ `HTTP/2 200` = API is working

---

### Solution 2: Faster Translation (Immediate Fix)

Reduce translation time by using faster models or skipping refinement.

#### Option A: Use a Faster Model

Instead of `openai/gpt-5.2`, try:
- `openai/gpt-4o` (faster, good quality)
- `anthropic/claude-sonnet-4` (fast, excellent for documents)

#### Option B: Reduce Timeout and Skip Refinement

Set a lower timeout environment variable:

```bash
# In your .env or Coolify environment
OPENROUTER_TIMEOUT_MS=90000  # 90 seconds (under Cloudflare's limit)
```

This will cause the translation to abort and retry with a faster approach, but may affect quality.

---

### Solution 3: Background Job Processing (Best Long-term Solution)

Implement a job-based translation system:

1. `/api/translate` returns immediately with a `jobId`
2. Frontend polls `/api/translate/status?jobId=xxx` for progress
3. Translation runs in the background

This requires code changes but is the most robust solution.

---

### Solution 4: Cloudflare Enterprise (Expensive)

Cloudflare Enterprise customers can increase the timeout to up to 6000 seconds. This is typically $200+/month and overkill for this use case.

---

## Quick Verification

After implementing Solution 1, test with:

```bash
# Test direct API access (no Cloudflare proxy)
curl -I https://api.translatoraxis.com/api/health

# Should return 200 OK without going through Cloudflare
```

## Current App Timeouts

Your app has these timeout settings in `app/api/translate/route.ts`:

```typescript
export const maxDuration = 300; // 5 minutes for Next.js
```

And in the translation function:
```typescript
const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 300000); // 5 minutes
```

## Why GPT-5.2 + Certificates is Slow

The `translateImageViaVisionModel` function does:

1. **First pass** (~1-2 minutes): 
   - Sends image to vision model
   - Extracts text + translates
   - Returns JSON with originalText and translatedText

2. **Second pass** (~1-2 minutes):
   - Takes the draft translation
   - Asks model to fix table alignment
   - Returns refined JSON

Total: 2-4 minutes, which exceeds Cloudflare's 100-second limit.

## Summary

| Solution | Effort | Reliability | Notes |
|----------|--------|-------------|-------|
| **API Subdomain** | Low | High | Bypasses Cloudflare for API calls |
| **Faster Model** | Low | Medium | May reduce translation quality |
| **Background Jobs** | High | Highest | Best long-term solution |
| **Enterprise** | Low | High | Expensive ($200+/mo) |

**Recommended**: Start with **Solution 1** (API Subdomain) for immediate fix, then consider **Solution 3** (Background Jobs) for a production-grade solution.

