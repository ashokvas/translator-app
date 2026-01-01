# Cloudflare Configuration Checklist

## Current Status
- ✅ VPS (213.199.50.227) is accessible and responding
- ✅ DNS points to Cloudflare
- ❌ Getting 503 error (Cloudflare can't reach origin)

## Step-by-Step Fix

### 1. Check Cloudflare DNS A Record

**Go to Cloudflare Dashboard:**
1. Login at: https://dash.cloudflare.com
2. Click on **translatoraxis.com** domain
3. Go to **DNS** → **Records**

**What you should see:**
```
Type: A
Name: @ (or translatoraxis.com)
Content: 213.199.50.227
Proxy status: Proxied (orange cloud ☁️)
TTL: Auto
```

**If the IP is different:**
- Click **Edit** on the A record
- Change **Content** to: `213.199.50.227`
- Ensure **Proxy status** is **Proxied** (orange cloud)
- Click **Save**

### 2. Check Cloudflare SSL/TLS Settings

**In Cloudflare Dashboard:**
1. Go to **SSL/TLS** → **Overview**
2. Check the encryption mode

**Current setting should be:**
- ✅ **Full** (recommended for now)
- ❌ NOT "Off"
- ❌ NOT "Flexible"
- ❌ NOT "Full (strict)" (this will cause 503 if origin doesn't have valid SSL)

**If it's set to "Full (strict)":**
- Change it to **"Full"**
- Click **Save**

### 3. Check Cloudflare Firewall/Security

**In Cloudflare Dashboard:**
1. Go to **Security** → **WAF**
2. Check if any rules are blocking your origin IP

**Also check:**
1. Go to **Security** → **Events**
2. Look for any blocked requests to translatoraxis.com
3. If you see blocks, add an exception rule

### 4. Verify Origin Server is Reachable

Run this command on your local machine:

```bash
curl -v http://213.199.50.227:80 -H "Host: translatoraxis.com" 2>&1 | grep -E "(Connected|HTTP|404|200)"
```

**Expected output:**
```
* Connected to 213.199.50.227
< HTTP/1.1 404 Not Found  (or 200 OK if domain is configured)
```

If you get "Connection refused" or "Connection timeout":
- Your VPS firewall might be blocking Cloudflare IPs
- Traefik/Coolify might not be listening on port 80

### 5. Check VPS Firewall (UFW)

SSH into your VPS and run:

```bash
# Check UFW status
sudo ufw status

# If UFW is active, ensure ports 80 and 443 are allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 6. Check if Coolify/Traefik is Running

SSH into your VPS and run:

```bash
# Check if Coolify proxy (Traefik) is running
docker ps | grep coolify-proxy

# Check Traefik logs for errors
docker logs coolify-proxy --tail 50 | grep -i error

# Check if translator-app is running
docker ps | grep translator-app

# Check translator-app logs
docker logs translator-app --tail 50
```

### 7. Verify Traefik Routing Rule

SSH into your VPS and run:

```bash
# Check the Traefik routing rule
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"
```

**Expected output:**
```
"traefik.http.routers.xxx.rule": "Host(`translatoraxis.com`)"
```

**If you see:**
```
"traefik.http.routers.xxx.rule": "Host(``) && PathPrefix(`translatoraxis.com`)"
```

This is WRONG! You need to fix it in Coolify:
1. Go to Coolify Dashboard
2. Open translator-app → **General**
3. Delete the domain, save, wait 10 seconds
4. Re-enter `translatoraxis.com`, save
5. Redeploy

### 8. Test Direct Connection to Origin

From your local machine, test if Cloudflare can reach your origin:

```bash
# Test with Cloudflare's perspective (using their DNS)
curl -I https://translatoraxis.com --resolve translatoraxis.com:443:213.199.50.227 -k
```

This bypasses Cloudflare and connects directly to your VPS.

**Expected:** Should get a response (even if 404)
**If timeout:** Your VPS firewall is blocking connections

## Common Issues and Solutions

### Issue 1: A Record Points to Wrong IP

**Symptom:** 503 error
**Solution:** Update A record in Cloudflare DNS to 213.199.50.227

### Issue 2: SSL Mode is "Full (strict)"

**Symptom:** 503 error, SSL handshake failed in Cloudflare logs
**Solution:** Change to "Full" mode in Cloudflare SSL/TLS settings

### Issue 3: VPS Firewall Blocking Cloudflare

**Symptom:** 503 error, connection timeout
**Solution:** 
```bash
sudo ufw allow from 173.245.48.0/20
sudo ufw allow from 103.21.244.0/22
sudo ufw allow from 103.22.200.0/22
sudo ufw allow from 103.31.4.0/22
sudo ufw allow from 141.101.64.0/18
sudo ufw allow from 108.162.192.0/18
sudo ufw allow from 190.93.240.0/20
sudo ufw allow from 188.114.96.0/20
sudo ufw allow from 197.234.240.0/22
sudo ufw allow from 198.41.128.0/17
sudo ufw allow from 162.158.0.0/15
sudo ufw allow from 104.16.0.0/13
sudo ufw allow from 104.24.0.0/14
sudo ufw allow from 172.64.0.0/13
sudo ufw allow from 131.0.72.0/22
```

Or simply allow all on ports 80/443:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Issue 4: Traefik Not Listening on Port 80

**Symptom:** Connection refused on port 80
**Solution:**
```bash
# Check what's listening on port 80
sudo netstat -tlnp | grep :80

# If nothing, restart Coolify proxy
docker restart coolify-proxy
```

### Issue 5: Incorrect Traefik Routing Rule

**Symptom:** 404 error when accessing directly, 503 through Cloudflare
**Solution:** Reset domain in Coolify (see Step 7 above)

## Quick Diagnostic Commands

Run these on your **local machine**:

```bash
# 1. Check DNS resolution
dig translatoraxis.com +short

# 2. Test HTTPS through Cloudflare
curl -I https://translatoraxis.com

# 3. Test direct connection to VPS
curl -I http://213.199.50.227 -H "Host: translatoraxis.com"

# 4. Check if port 80 is open
nc -zv 213.199.50.227 80

# 5. Check if port 443 is open
nc -zv 213.199.50.227 443
```

Run these on your **VPS** (via SSH):

```bash
# 1. Check Coolify proxy status
docker ps | grep coolify-proxy

# 2. Check translator-app status
docker ps | grep translator-app

# 3. Check Traefik routing
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"

# 4. Check Traefik logs
docker logs coolify-proxy --tail 100 | grep -E "(error|translatoraxis)"

# 5. Check firewall
sudo ufw status

# 6. Check what's listening on port 80
sudo netstat -tlnp | grep :80
```

## Next Steps

1. **First**, verify the A record in Cloudflare points to 213.199.50.227
2. **Second**, ensure SSL mode is "Full" (not "Full (strict)")
3. **Third**, check if VPS firewall is allowing connections
4. **Fourth**, verify Traefik routing rule is correct
5. **Finally**, redeploy in Coolify if needed

After making any changes, wait 1-2 minutes and test again:
```bash
curl -I https://translatoraxis.com
```

You should see `HTTP/2 200 OK` instead of 503.

