# Domain Migration Guide: translator.clickbric.com → translatoraxis.com

This guide walks you through migrating your Translator App from `translator.clickbric.com` to `translatoraxis.com` step-by-step.

## 📋 Prerequisites

- Access to your DNS provider (where `translatoraxis.com` is registered)
- Access to your hosting platform (Vercel, VPS, or Coolify)
- Access to Clerk Dashboard
- Access to PayPal Developer Dashboard (if using PayPal)
- Access to Convex Dashboard (if domain-specific settings exist)

---

## 🚀 Step-by-Step Migration Process

### Step 1: DNS Configuration

#### 1.1 Add DNS Records for New Domain

**If using Vercel:**
1. Go to your DNS provider (e.g., Namecheap, GoDaddy, Cloudflare)
2. Add an **A record** or **CNAME record**:
   - **Type**: CNAME (recommended) or A
   - **Name**: `translatoraxis` (or `@` for root domain)
   - **Value**: 
     - For Vercel: `cname.vercel-dns.com` (CNAME) or Vercel's IP addresses (A record)
     - For VPS: Your VPS IP address (A record)
   - **TTL**: 3600 (or default)

**If using VPS/Coolify:**
1. Add an **A record**:
   - **Type**: A
   - **Name**: `translatoraxis` (or `@` for root domain)
   - **Value**: Your VPS IP address
   - **TTL**: 3600

#### 1.2 Verify DNS Propagation

Wait 5-30 minutes, then verify DNS is working:

```bash
# Check DNS resolution
dig translatoraxis.com
nslookup translatoraxis.com

# Should return your server's IP or Vercel's CNAME
```

---

### Step 2: Update Hosting Platform Configuration

#### 2.1 If Using Vercel

1. **Add Domain to Vercel:**
   - Go to: https://vercel.com/dashboard
   - Select your project → **Settings** → **Domains**
   - Click **Add Domain**
   - Enter: `translatoraxis.com`
   - Follow the DNS verification steps
   - Vercel will automatically provision SSL certificate

2. **Update Environment Variables:**
   - Go to: **Settings** → **Environment Variables**
   - Find `NEXT_PUBLIC_APP_URL`
   - Update to: `https://translatoraxis.com`
   - Ensure it's set for **Production**, **Preview**, and **Development**
   - Click **Save**

3. **Redeploy:**
   ```bash
   vercel --prod
   ```
   Or trigger a redeploy from Vercel Dashboard → **Deployments** → **Redeploy**

#### 2.2 If Using VPS/Coolify/Docker

1. **Update Nginx Configuration:**
   - SSH into your VPS
   - Edit `/etc/nginx/sites-available/translator-app`:
     ```bash
     sudo nano /etc/nginx/sites-available/translator-app
     ```
   - Replace `YOUR_SUBDOMAIN.YOUR_DOMAIN.COM` with `translatoraxis.com` (3 occurrences)
   - Save and exit

2. **Update SSL Certificate:**
   ```bash
   # Remove old certificate (if needed)
   sudo certbot delete --cert-name translator.clickbric.com
   
   # Get new certificate
   sudo certbot --nginx -d translatoraxis.com
   
   # Test nginx configuration
   sudo nginx -t
   
   # Reload nginx
   sudo systemctl reload nginx
   ```

3. **Update Environment Variables:**
   - If using Docker Compose:
     ```bash
     # Edit .env.production file
     nano .env.production
     ```
   - Update `NEXT_PUBLIC_APP_URL=https://translatoraxis.com`
   - Restart containers:
     ```bash
     docker-compose --env-file .env.production down
     docker-compose --env-file .env.production up -d
     ```
   
   - If using Coolify:
     - Go to your app in Coolify Dashboard
     - **Configuration** → **Environment Variables**
     - Update `NEXT_PUBLIC_APP_URL` to `https://translatoraxis.com`
     - Click **Save** and **Redeploy**

---

### Step 3: Update Clerk Authentication

1. **Go to Clerk Dashboard:**
   - Visit: https://dashboard.clerk.com
   - Select your application

2. **Update Allowed Domains:**
   - Go to: **Configure** → **Domains**
   - Click **Add Domain**
   - Enter: `translatoraxis.com`
   - Click **Save**

3. **Update Redirect URLs (if configured):**
   - Go to: **Configure** → **Paths**
   - Update any hardcoded URLs from `translator.clickbric.com` to `translatoraxis.com`
   - Check:
     - After Sign In URL
     - After Sign Up URL
     - Sign In URL
     - Sign Up URL

4. **Verify Environment Variables:**
   - Ensure Clerk keys are still valid (they should be, as they're domain-agnostic)
   - If you have webhooks configured, update webhook URLs (see Step 5)

---

### Step 4: Update PayPal Configuration (If Using PayPal)

1. **Go to PayPal Developer Dashboard:**
   - Visit: https://developer.paypal.com
   - Log in and select your app

2. **Update Return URLs:**
   - Go to: **My Apps & Credentials** → Select your app
   - Under **Return URL**, update:
     - Old: `https://translator.clickbric.com/api/paypal/capture-order`
     - New: `https://translatoraxis.com/api/paypal/capture-order`

3. **Update Webhook URLs (if configured):**
   - Go to: **Webhooks** section
   - Update webhook URL from `translator.clickbric.com` to `translatoraxis.com`

---

### Step 5: Update Convex (If Needed)

Convex URLs are typically domain-agnostic, but check:

1. **Go to Convex Dashboard:**
   - Visit: https://dashboard.convex.dev
   - Select your deployment

2. **Check HTTP Actions:**
   - If you have HTTP actions with hardcoded domains, update them
   - Most Convex configurations don't require domain changes

3. **Verify Environment Variables:**
   - Ensure `NEXT_PUBLIC_CONVEX_URL` is still correct (shouldn't change)

---

### Step 6: Update Google Cloud (If Using Webhooks/Callbacks)

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com
   - Select your project

2. **Update OAuth Redirect URIs (if using OAuth):**
   - Go to: **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID
   - Update authorized redirect URIs:
     - Remove: `https://translator.clickbric.com/*`
     - Add: `https://translatoraxis.com/*`

---

### Step 7: Test Everything

#### 7.1 Basic Functionality Tests

1. **Access the App:**
   ```bash
   curl -I https://translatoraxis.com
   ```
   Should return `200 OK`

2. **Test Health Endpoint:**
   ```bash
   curl https://translatoraxis.com/api/health
   ```
   Should return: `{"status":"ok",...}`

3. **Test Authentication:**
   - Visit: `https://translatoraxis.com/sign-in`
   - Sign in with test account
   - Verify redirect works correctly

4. **Test File Upload:**
   - Create a new order
   - Upload a test file (PDF, DOCX, etc.)
   - Verify it processes correctly

5. **Test Payment Flow (if applicable):**
   - Go through PayPal checkout
   - Verify return URL works
   - Check order completion

#### 7.2 SSL Certificate Verification

```bash
# Check SSL certificate
openssl s_client -connect translatoraxis.com:443 -servername translatoraxis.com

# Or use online tool
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=translatoraxis.com
```

---

### Step 8: Update Old Domain (Optional - Keep for Redirect)

#### 8.1 Set Up Redirect from Old Domain

**If using Vercel:**
1. Keep `translator.clickbric.com` added to Vercel
2. Add redirect rule in `next.config.ts` (see below)

**If using VPS/Nginx:**
Add redirect server block in `/etc/nginx/sites-available/translator-app`:

```nginx
# Redirect old domain to new domain
server {
    listen 80;
    listen 443 ssl;
    server_name translator.clickbric.com;
    
    ssl_certificate /etc/letsencrypt/live/translator.clickbric.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/translator.clickbric.com/privkey.pem;
    
    return 301 https://translatoraxis.com$request_uri;
}
```

#### 8.2 Add Next.js Redirect (If Using Vercel)

Update `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'pdfjs-dist', 'docx'],
  
  // Redirect old domain to new domain
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'translator.clickbric.com',
          },
        ],
        destination: 'https://translatoraxis.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

---

### Step 9: Monitor and Verify

#### 9.1 Check Logs

**Vercel:**
- Go to: **Deployments** → Select deployment → **Functions** tab
- Check for any errors related to domain/URL

**VPS/Coolify:**
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Check app logs
docker-compose logs -f translator-app
```

#### 9.2 Monitor for 24-48 Hours

- Check Google Analytics (if configured)
- Monitor error tracking (Sentry, etc.)
- Verify all email notifications use new domain
- Check PayPal webhook deliveries

---

### Step 10: Clean Up Old Domain (After Verification)

**After 1-2 weeks of successful operation:**

1. **Remove Old Domain from Services:**
   - Clerk: Remove `translator.clickbric.com` from allowed domains
   - PayPal: Remove old return URLs
   - Google Cloud: Remove old redirect URIs

2. **Remove DNS Records:**
   - Remove A/CNAME record for `translator.clickbric.com` (or keep redirect)

3. **Remove SSL Certificate (VPS only):**
   ```bash
   sudo certbot delete --cert-name translator.clickbric.com
   ```

---

## ✅ Migration Checklist

- [ ] DNS records added for `translatoraxis.com`
- [ ] DNS propagation verified
- [ ] Domain added to Vercel/Coolify/VPS
- [ ] SSL certificate obtained for new domain
- [ ] `NEXT_PUBLIC_APP_URL` updated in environment variables
- [ ] App redeployed with new domain
- [ ] Clerk allowed domains updated
- [ ] Clerk redirect URLs updated
- [ ] PayPal return URLs updated (if applicable)
- [ ] PayPal webhook URLs updated (if applicable)
- [ ] Google Cloud OAuth redirects updated (if applicable)
- [ ] Health endpoint tested
- [ ] Authentication flow tested
- [ ] File upload tested
- [ ] Payment flow tested (if applicable)
- [ ] Old domain redirect configured (optional)
- [ ] Monitoring set up for new domain
- [ ] Documentation updated

---

## 🆘 Troubleshooting

### Issue: DNS Not Resolving

**Solution:**
- Wait longer (DNS can take up to 48 hours, usually 5-30 minutes)
- Check DNS records are correct
- Clear DNS cache: `sudo dscacheutil -flushcache` (macOS) or `ipconfig /flushdns` (Windows)

### Issue: SSL Certificate Not Working

**Solution:**
- Ensure DNS is fully propagated before requesting SSL
- Check nginx configuration is correct
- Verify certbot ran successfully: `sudo certbot certificates`
- Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Issue: Clerk Authentication Failing

**Solution:**
- Verify domain is added to Clerk allowed domains
- Check Clerk environment variables are correct
- Clear browser cache and cookies
- Check Clerk dashboard for error messages

### Issue: PayPal Redirects Not Working

**Solution:**
- Verify return URL is updated in PayPal dashboard
- Check PayPal webhook URLs are updated
- Test with PayPal sandbox first
- Check PayPal developer logs

### Issue: Old Domain Still Showing Content

**Solution:**
- Clear browser cache
- Check DNS propagation: `dig translator.clickbric.com`
- Verify redirect is configured correctly
- Check nginx/Vercel configuration

---

## 📞 Support Resources

- **Vercel Docs**: https://vercel.com/docs/domains
- **Clerk Docs**: https://clerk.com/docs/authentication/domains
- **PayPal Docs**: https://developer.paypal.com/docs
- **Certbot Docs**: https://certbot.eff.org/docs

---

## 🎯 Quick Reference: Environment Variables to Update

```bash
# Update this in your hosting platform
NEXT_PUBLIC_APP_URL=https://translatoraxis.com
```

**Where to update:**
- Vercel: Settings → Environment Variables
- Coolify: App → Configuration → Environment Variables
- Docker: `.env.production` file
- VPS: `.env.production` or system environment variables

---

**Migration Complete!** 🎉

Your app should now be accessible at `https://translatoraxis.com`. Keep the old domain redirect active for at least 2-4 weeks to ensure all users and search engines update their links.

