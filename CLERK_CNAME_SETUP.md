# How to Configure CNAME for Clerk Satellite Domain

## Step 1: Find the CNAME Value in Clerk

After adding the satellite domain, Clerk should display the CNAME configuration. Here's where to find it:

### In Clerk Dashboard:

1. **Go to:** Configure → Developers → Domains
2. **Click on the "Satellites" tab** (or look at the satellite domains table)
3. **Find your domain** (`translatoraxis.com`) in the list
4. **Click on the domain** or look for a "Configure" or "DNS" button/icon
5. **You should see:**
   - A CNAME record value (something like `clerk-dns-xxxxx.clerk.com` or `clerk-xxxxx.clerk.com`)
   - Instructions on what to add to your DNS

### What to Look For:

The CNAME value will typically look like one of these formats:
- `clerk-dns-xxxxx.clerk.com`
- `clerk-xxxxx.clerk.com`
- `clerk-xxxxx.clerk-dns.com`
- Or a custom Clerk DNS value

**Example:**
```
Type: CNAME
Name: @ (or translatoraxis)
Value: clerk-dns-abc123.clerk.com
```

---

## Step 2: Add CNAME Record to Your DNS Provider

Once you have the CNAME value from Clerk, add it to your DNS provider:

### For Root Domain (`translatoraxis.com`):

**Option A: CNAME Record (if your DNS provider supports CNAME for root)**
- **Type:** CNAME
- **Name/Host:** `@` or `translatoraxis` or leave blank (depends on provider)
- **Value/Target:** The CNAME value from Clerk (e.g., `clerk-dns-xxxxx.clerk.com`)
- **TTL:** 3600 (or default)

**Option B: If CNAME not supported for root domain:**
Some DNS providers don't allow CNAME on root domains. In that case:
- Use an **A record** pointing to your hosting platform (Vercel/VPS)
- Clerk will work with the domain once DNS resolves correctly

### For Subdomain (if needed):

If Clerk requires a subdomain:
- **Type:** CNAME
- **Name/Host:** `clerk` (or whatever Clerk specifies)
- **Value/Target:** The CNAME value from Clerk
- **TTL:** 3600

---

## Step 3: DNS Provider-Specific Instructions

### Cloudflare:
1. Go to your domain → **DNS** → **Records**
2. Click **Add record**
3. Select **CNAME**
4. **Name:** `@` (for root) or `clerk` (for subdomain)
5. **Target:** Paste Clerk's CNAME value
6. **Proxy status:** Can be "DNS only" or "Proxied" (try DNS only first)
7. Click **Save**

### Namecheap:
1. Go to **Domain List** → Click **Manage** next to your domain
2. Go to **Advanced DNS** tab
3. Click **Add New Record**
4. Select **CNAME Record**
5. **Host:** `@` (for root) or `clerk` (for subdomain)
6. **Value:** Paste Clerk's CNAME value
7. **TTL:** Automatic (or 3600)
8. Click **Save**

### GoDaddy:
1. Go to **My Products** → **DNS**
2. Click **Add** → **CNAME**
3. **Name:** `@` (for root) or `clerk` (for subdomain)
4. **Value:** Paste Clerk's CNAME value
5. **TTL:** 1 Hour
6. Click **Save**

### Google Domains:
1. Go to **DNS** → **Custom records**
2. Click **Add custom record**
3. **Name:** `@` (for root) or `clerk` (for subdomain)
4. **Type:** CNAME
5. **Data:** Paste Clerk's CNAME value
6. **TTL:** 3600
7. Click **Save**

### Route 53 (AWS):
1. Go to **Hosted zones** → Select your domain
2. Click **Create record**
3. **Record name:** Leave blank (for root) or `clerk` (for subdomain)
4. **Record type:** CNAME
5. **Value:** Paste Clerk's CNAME value
6. Click **Create records**

---

## Step 4: Verify DNS Propagation

After adding the CNAME record:

1. **Wait 5-30 minutes** for DNS propagation

2. **Verify the CNAME record:**
   ```bash
   # Check CNAME record
   dig translatoraxis.com CNAME
   
   # Or
   nslookup -type=CNAME translatoraxis.com
   ```

3. **Check in Clerk Dashboard:**
   - Go back to Clerk → Domains → Satellite domains
   - The status should change from "Pending" to "Active" or "Verified"
   - Clerk will automatically verify the DNS configuration

---

## Important Notes

### ⚠️ Root Domain CNAME Limitation:

Some DNS providers **don't allow CNAME records on root domains** (like `translatoraxis.com`). If your provider doesn't support this:

1. **Option 1:** Use an A record pointing to your hosting platform instead
   - Clerk satellite domains can work with A records too
   - The domain just needs to resolve correctly

2. **Option 2:** Use a subdomain
   - If Clerk allows it, use `clerk.translatoraxis.com` instead
   - Then add CNAME for the subdomain

### 🔄 Multiple Records:

You might need **both**:
- An **A record** or **CNAME** pointing to your hosting platform (Vercel/VPS) - for your app
- A **CNAME** pointing to Clerk - for authentication

These can coexist in DNS.

---

## Troubleshooting

### Issue: CNAME Not Showing in Clerk

**Solution:**
- Refresh the Clerk dashboard
- Click on the domain in the satellite domains list
- Look for a "DNS Configuration" or "Configure DNS" button
- Check if there's an "i" (info) icon that shows DNS details

### Issue: DNS Provider Doesn't Support Root CNAME

**Solution:**
- Use an A record pointing to your hosting platform
- Clerk will still work - satellite domains don't strictly require CNAME
- The domain just needs to resolve and be accessible

### Issue: Clerk Status Still Shows "Pending"

**Solution:**
1. Wait longer (DNS can take up to 48 hours, usually 5-30 minutes)
2. Verify the CNAME record is correct:
   ```bash
   dig translatoraxis.com CNAME
   ```
3. Check for typos in the CNAME value
4. Ensure TTL is set correctly
5. Try clearing DNS cache:
   - macOS: `sudo dscacheutil -flushcache`
   - Windows: `ipconfig /flushdns`

### Issue: Can't Find CNAME Value in Clerk

**Solution:**
1. Click directly on `translatoraxis.com` in the satellite domains table
2. Look for a "DNS" or "Configuration" tab
3. Check for an expandable section or "Show DNS settings" button
4. Contact Clerk support if still not visible

---

## Quick Checklist

- [ ] Found CNAME value in Clerk dashboard
- [ ] Copied the CNAME value correctly
- [ ] Added CNAME record to DNS provider
- [ ] Set correct Name/Host (`@` or `clerk`)
- [ ] Set correct Value/Target (Clerk's CNAME)
- [ ] Saved DNS changes
- [ ] Waited 5-30 minutes for propagation
- [ ] Verified CNAME with `dig` or `nslookup`
- [ ] Checked Clerk dashboard - status should be "Active"
- [ ] Tested authentication on `translatoraxis.com`

---

## Next Steps

After the CNAME is configured and Clerk shows the domain as "Active":

1. **Update your app's environment variable:**
   - Set `NEXT_PUBLIC_APP_URL=https://translatoraxis.com`

2. **Test authentication:**
   - Visit `https://translatoraxis.com/sign-in`
   - Try signing in
   - Should work seamlessly!

3. **Keep old domain active:**
   - Don't remove `translator.clickbric.com` yet
   - Keep both domains working for a few weeks during migration

---

## Need Help?

If you can't find the CNAME value:
1. **Screenshot** the Clerk Domains page and share it
2. **Check Clerk Docs:** https://clerk.com/docs/authentication/satellite-domains
3. **Contact Clerk Support:** https://clerk.com/support

