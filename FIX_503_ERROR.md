# Fix 503 Error - Complete Guide

## Current Status
- ✅ Nameservers correctly pointing to Cloudflare
- ✅ DNS resolving to Cloudflare IPs
- ✅ VPS (213.199.50.227) is accessible
- ✅ Traefik is running with self-signed SSL
- ❌ Getting 503 error from Cloudflare

## Root Cause Analysis

The 503 error means Cloudflare **cannot connect to your origin server**. This can happen for two reasons:

### Reason 1: SSL/TLS Mode Issue (Most Likely)
Cloudflare is set to "Full (strict)" mode but your origin has a self-signed certificate.

### Reason 2: Traefik Routing Rule Issue
Traefik doesn't have the correct routing rule for `translatoraxis.com`.

## Solution Steps

### Step 1: Fix Cloudflare SSL/TLS Mode (CRITICAL!)

1. **Login to Cloudflare Dashboard**: https://dash.cloudflare.com
2. Click on **translatoraxis.com**
3. Click **SSL/TLS** in the left sidebar
4. Click **Overview** tab
5. Look for **SSL/TLS encryption mode**

**Current setting is probably:**
- ❌ **Full (strict)** - This requires a valid SSL certificate on origin

**Change it to:**
- ✅ **Full** - This accepts self-signed certificates

**How to identify which mode you're on:**
- **Off**: No encryption
- **Flexible**: Cloudflare to visitor encrypted, Cloudflare to origin unencrypted
- **Full**: Cloudflare to visitor encrypted, Cloudflare to origin encrypted (accepts self-signed) ✅
- **Full (strict)**: Cloudflare to visitor encrypted, Cloudflare to origin encrypted (requires valid cert) ❌

6. **Select "Full"**
7. Wait 1-2 minutes for changes to propagate

### Step 2: Verify Traefik Routing Rule

The incorrect Traefik routing rule we identified earlier might still be the issue.

**SSH into your VPS:**

```bash
ssh root@213.199.50.227
```

**Check the Traefik routing rule:**

```bash
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"
```

**Expected output:**
```json
"traefik.http.routers.xxx.rule": "Host(`translatoraxis.com`)"
```

**If you see this (WRONG):**
```json
"traefik.http.routers.xxx.rule": "Host(``) && PathPrefix(`translatoraxis.com`)"
```

**Then you need to fix it in Coolify:**

1. Open **Coolify Dashboard**
2. Go to your **translator-app** project
3. Click **General** tab
4. Find the **Domains** field
5. **Delete the domain completely** (clear the field)
6. Click **Save**
7. **Wait 10 seconds**
8. **Re-enter**: `translatoraxis.com` (no spaces, no http://, no https://)
9. Click **Save**
10. Go to **Deployment** tab
11. Click **Redeploy**

### Step 3: Check Coolify Proxy Logs

While SSH'd into your VPS, check Traefik logs for errors:

```bash
docker logs coolify-proxy --tail 100 | grep -E "(error|translatoraxis|503)"
```

Look for errors like:
- "dial tcp: connect: connection refused"
- "TLS handshake error"
- "no such host"
- "certificate verification failed"

### Step 4: Verify App is Running

Check if the translator-app container is running:

```bash
docker ps | grep translator-app
```

**Expected output:**
```
CONTAINER ID   IMAGE              STATUS          PORTS
xxxxx          translator-app     Up X minutes    3000/tcp
```

If it's not running or restarting:

```bash
# Check why it failed
docker logs translator-app --tail 100

# Restart it
docker restart translator-app
```

### Step 5: Test Direct Connection

From your local machine, test direct connection to origin:

```bash
# Test HTTP
curl -I http://213.199.50.227 -H "Host: translatoraxis.com"

# Test HTTPS with self-signed cert
curl -I https://213.199.50.227 -H "Host: translatoraxis.com" -k
```

**Expected:** Should get 200 OK or 404 Not Found (both are fine)
**If timeout or refused:** Firewall or Traefik issue

### Step 6: Check Cloudflare Origin Server Settings

In Cloudflare Dashboard:

1. Go to **SSL/TLS** → **Origin Server**
2. Check if there are any **Origin Certificates** configured
3. If you see any, they might be interfering

Also check:

1. Go to **Security** → **WAF**
2. Check if any rules are blocking requests
3. Go to **Security** → **Events**
4. Look for blocked requests to translatoraxis.com

### Step 7: Temporarily Bypass Cloudflare (Testing)

To confirm if Cloudflare is the issue, temporarily set DNS to "DNS only":

1. In Cloudflare Dashboard → **DNS** → **Records**
2. Click on the **A record** for translatoraxis.com
3. Click the **orange cloud** to turn it **gray** (DNS only)
4. Wait 1-2 minutes
5. Test: `curl -I http://translatoraxis.com`

**If it works with gray cloud:**
- Issue is with Cloudflare SSL/TLS settings
- Change SSL mode to "Full" (not "Full (strict)")

**If it still doesn't work:**
- Issue is with Traefik routing rule
- Fix the domain configuration in Coolify

**Important:** Turn the cloud back to **orange (Proxied)** after testing!

## Quick Diagnostic Commands

### On Your Local Machine:

```bash
# 1. Check DNS
dig translatoraxis.com +short

# 2. Check nameservers
dig NS translatoraxis.com +short

# 3. Test HTTPS through Cloudflare
curl -I https://translatoraxis.com

# 4. Test direct to origin
curl -I http://213.199.50.227 -H "Host: translatoraxis.com"

# 5. Check SSL certificate
openssl s_client -connect translatoraxis.com:443 -servername translatoraxis.com </dev/null 2>&1 | grep -E "(subject|issuer|Verify)"
```

### On Your VPS (SSH):

```bash
# 1. Check Coolify proxy status
docker ps | grep coolify-proxy

# 2. Check translator-app status
docker ps | grep translator-app

# 3. Check Traefik routing rule
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"

# 4. Check Traefik logs
docker logs coolify-proxy --tail 100 | grep -E "(error|translatoraxis)"

# 5. Check app logs
docker logs translator-app --tail 50

# 6. Check what's listening on port 80
sudo netstat -tlnp | grep :80

# 7. Check what's listening on port 443
sudo netstat -tlnp | grep :443
```

## Expected Results After Fix

After fixing the SSL mode and routing rule:

```bash
curl -I https://translatoraxis.com
```

**Should return:**
```
HTTP/2 200 OK
date: [current date]
content-type: text/html
server: cloudflare
```

Or at minimum:
```
HTTP/2 404 Not Found
```

**Should NOT return:**
```
HTTP/2 503 Service Temporarily Unavailable
```

## Troubleshooting Specific Errors

### Error: "SSL handshake failed"
**Solution:** Change Cloudflare SSL mode to "Full" (not "Full (strict)")

### Error: "dial tcp: connection refused"
**Solution:** 
- Check if translator-app is running: `docker ps | grep translator-app`
- Check Traefik routing rule
- Restart Coolify proxy: `docker restart coolify-proxy`

### Error: "no such host"
**Solution:** Fix Traefik routing rule in Coolify (see Step 2)

### Error: "upstream connect error"
**Solution:** 
- App container is not running or not accessible
- Check app logs: `docker logs translator-app --tail 100`

## Next Steps

1. **First**: Change Cloudflare SSL mode to "Full"
2. **Second**: Verify Traefik routing rule is correct
3. **Third**: If still not working, check Traefik logs for specific errors
4. **Fourth**: Test with Cloudflare proxy disabled (gray cloud) to isolate issue

## Contact Information

If you need to share diagnostic output, run this comprehensive check:

```bash
echo "=== DNS Check ==="
dig translatoraxis.com +short
echo ""
echo "=== Nameservers ==="
dig NS translatoraxis.com +short
echo ""
echo "=== HTTPS Test ==="
curl -I https://translatoraxis.com 2>&1 | head -10
echo ""
echo "=== Direct Origin Test ==="
curl -I http://213.199.50.227 -H "Host: translatoraxis.com" 2>&1 | head -10
```

Then SSH into VPS and run:

```bash
echo "=== Traefik Routing Rule ==="
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"
echo ""
echo "=== Container Status ==="
docker ps | grep -E "(translator-app|coolify-proxy)"
echo ""
echo "=== Recent Traefik Errors ==="
docker logs coolify-proxy --tail 50 | grep -i error
```

Share the output for further diagnosis.

