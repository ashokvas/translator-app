# Cloudflare Setup Guide for translatoraxis.com

## Current Status
- ✅ Domain added to Cloudflare
- ✅ Nameservers updated
- ✅ DNS propagated
- ⏳ Waiting for Coolify configuration fix

## VPS Details
- **IP Address**: 213.199.50.227
- **Domain**: translatoraxis.com
- **Hosting**: Coolify on VPS

## Step-by-Step Configuration

### 1. Cloudflare DNS Settings

1. Login to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select **translatoraxis.com**
3. Go to **DNS** → **Records**
4. Configure A record:
   ```
   Type: A
   Name: @ (or translatoraxis.com)
   IPv4 address: 213.199.50.227
   Proxy status: Proxied (orange cloud ☁️)
   TTL: Auto
   ```

### 2. Cloudflare SSL/TLS Settings

#### SSL/TLS Overview
1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to: **"Full"**
   - This allows Cloudflare to connect to your origin server
   - Don't use "Full (strict)" yet since origin doesn't have valid SSL

#### Edge Certificates
1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable these settings:
   - ✅ **Always Use HTTPS**
   - ✅ **Automatic HTTPS Rewrites**
   - ✅ **Minimum TLS Version**: TLS 1.2
   - ✅ **Opportunistic Encryption**
   - ✅ **TLS 1.3**: Enabled

### 3. Cloudflare Security Settings (Optional but Recommended)

#### Firewall Rules
1. Go to **Security** → **WAF**
2. Set to **Medium** sensitivity

#### DDoS Protection
- Already enabled by default with Cloudflare

### 4. Fix Coolify Configuration

**Problem**: Coolify is generating incorrect Traefik routing rule:
```
Host(``) && PathPrefix(`translatoraxis.com`)  ❌ WRONG
```

**Should be**:
```
Host(`translatoraxis.com`)  ✅ CORRECT
```

**Fix Steps**:

1. Login to **Coolify Dashboard**
2. Navigate to your **translator-app** project
3. Click on **General** tab
4. Find the **Domains** field
5. **Delete the domain completely** (clear the field)
6. Click **Save**
7. **Wait 10 seconds**
8. **Re-enter**: `translatoraxis.com` (no spaces, no http://, no https://)
9. Click **Save** again
10. Go to **Deployment** tab
11. Click **Redeploy**

### 5. Update Environment Variables in Coolify

1. In Coolify, go to **Environment Variables** tab
2. Find or add: `NEXT_PUBLIC_APP_URL`
3. Set value to: `https://translatoraxis.com`
4. Click **Save**
5. **Redeploy** the application

### 6. Verification Commands

After redeployment (wait 2-3 minutes), verify the setup:

```bash
# Test HTTPS connection
curl -I https://translatoraxis.com

# Check DNS resolution
dig translatoraxis.com +short

# Verify Traefik routing (SSH into VPS)
docker inspect translator-app | grep -A 5 "traefik.http.routers" | grep "rule"
```

**Expected Results**:
- HTTPS should return `HTTP/2 200 OK` (not 503 or 404)
- DNS should show Cloudflare IPs: 172.67.175.211, 104.21.83.121
- Traefik rule should show: `Host(\`translatoraxis.com\`)`

### 7. Update Third-Party Services

Once the domain is working:

#### Clerk Authentication
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Domains** (or **Satellite Domains**)
3. Ensure `translatoraxis.com` is added
4. Update redirect URLs if needed

#### PayPal Configuration
1. Login to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Go to your app settings
3. Update:
   - Return URL: `https://translatoraxis.com/api/paypal/capture-order`
   - Webhook URL: `https://translatoraxis.com/api/paypal/webhook`

#### Convex
- No changes needed (uses API keys, not domain-specific)

#### Google Cloud (if using OAuth)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Update OAuth redirect URIs to include `https://translatoraxis.com`

## Troubleshooting

### Issue: Still getting 503 error

**Cause**: Cloudflare can't reach your origin server

**Solutions**:
1. Verify A record points to correct IP: 213.199.50.227
2. Check SSL mode is set to "Full" (not "Full (strict)")
3. Ensure Coolify app is running: `docker ps | grep translator-app`
4. Check Traefik logs: `docker logs coolify-proxy --tail 50`

### Issue: Getting 404 error

**Cause**: Traefik routing rule is incorrect

**Solution**: Follow Step 4 above to reset domain in Coolify

### Issue: Certificate errors

**Cause**: SSL mode mismatch

**Solution**: 
- In Cloudflare, use "Full" mode (not "Full (strict)")
- Cloudflare will handle SSL between client and Cloudflare
- Connection between Cloudflare and origin can be unencrypted or with self-signed cert

### Issue: Redirect loops

**Cause**: Conflicting SSL settings

**Solution**:
1. In Cloudflare: Disable "Always Use HTTPS" temporarily
2. In Coolify: Check if app is forcing HTTPS redirects
3. Re-enable "Always Use HTTPS" in Cloudflare after fixing

## Testing Checklist

- [ ] DNS resolves to Cloudflare IPs
- [ ] HTTPS connection works (no 503/404 errors)
- [ ] Homepage loads correctly
- [ ] Clerk authentication works
- [ ] File uploads work
- [ ] PayPal integration works (if updated)
- [ ] Admin dashboard accessible
- [ ] User dashboard accessible

## Performance Optimization (Optional)

### Cloudflare Caching
1. Go to **Caching** → **Configuration**
2. Set caching level to **Standard**
3. Enable **Browser Cache TTL**: 4 hours

### Cloudflare Speed
1. Go to **Speed** → **Optimization**
2. Enable:
   - ✅ Auto Minify (JavaScript, CSS, HTML)
   - ✅ Brotli compression
   - ✅ Early Hints

### Cloudflare Page Rules (Optional)
Create a page rule for static assets:
```
URL: translatoraxis.com/*.{jpg,jpeg,png,gif,css,js,woff,woff2}
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

## Notes

- Cloudflare provides free SSL certificates automatically
- DNS changes can take up to 24 hours to fully propagate (usually 5-15 minutes)
- Cloudflare's "Proxied" mode provides DDoS protection and CDN benefits
- Keep Cloudflare SSL mode on "Full" until you set up proper SSL on origin
- The incorrect Traefik routing rule is the main blocker - must be fixed in Coolify

## Support Resources

- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [Coolify Documentation](https://coolify.io/docs)
- [Traefik Documentation](https://doc.traefik.io/traefik/)

