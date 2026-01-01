# How to Add Domain in Clerk Dashboard

## Step-by-Step Guide: Adding `translatoraxis.com` to Clerk

### Method 1: Through Paths/URLs Section (Most Common)

1. **Go to Clerk Dashboard:**
   - Visit: https://dashboard.clerk.com
   - Log in and select your application

2. **Navigate to Paths/URLs:**
   - Look for **"Paths"** or **"URLs"** in the left sidebar
   - Or go to: **Configure** → **Paths**
   - Alternative path: **Settings** → **Paths**

3. **Find Domain Settings:**
   - Look for a section called **"Allowed domains"** or **"Domains"**
   - You might see a list of current domains (like `translator.clickbric.com`)

4. **Add New Domain:**
   - Click **"Add Domain"** or **"Add allowed domain"** button
   - Enter: `translatoraxis.com` (without `https://`)
   - Click **"Save"** or **"Add"**

### Method 2: Through Settings → Domains

1. **Go to Clerk Dashboard:**
   - Visit: https://dashboard.clerk.com
   - Select your application

2. **Navigate to Settings:**
   - Click **"Settings"** in the left sidebar
   - Look for **"Domains"** subsection
   - Or go directly to: **Configure** → **Domains**

3. **Add Domain:**
   - You should see a list or input field for allowed domains
   - Click **"Add Domain"** or the **"+"** button
   - Enter: `translatoraxis.com`
   - Save

### Method 3: Through Paths → Redirect URLs

Sometimes domains are managed through redirect URLs:

1. **Go to:** **Configure** → **Paths** (or **Settings** → **Paths**)

2. **Update Redirect URLs:**
   - Find **"After Sign In URL"** or **"Redirect URLs"**
   - Update any URLs containing `translator.clickbric.com` to `translatoraxis.com`
   - Common fields to check:
     - After Sign In URL
     - After Sign Up URL
     - Sign In URL
     - Sign Up URL

3. **Add New Domain:**
   - Look for **"Allowed domains"** or **"Domain whitelist"** section
   - Add `translatoraxis.com`

### Method 4: Direct URL (If Available)

Try navigating directly to these URLs (replace `[your-app-id]` with your actual Clerk app ID):

- https://dashboard.clerk.com/apps/[your-app-id]/domains
- https://dashboard.clerk.com/apps/[your-app-id]/paths
- https://dashboard.clerk.com/apps/[your-app-id]/settings/domains

---

## What to Look For

### Visual Indicators:

- **Button text:** "Add Domain", "Add allowed domain", "+ Add", "New Domain"
- **Section headers:** "Allowed Domains", "Domain Whitelist", "Domains", "Authorized Domains"
- **Input field:** Text input with placeholder like "example.com" or "yourdomain.com"

### Where It Might Be Located:

1. **Left Sidebar Menu:**
   - Configure → Domains
   - Configure → Paths → Domains section
   - Settings → Domains

2. **Top Navigation:**
   - Sometimes under a "Security" or "Authentication" tab

3. **Main Content Area:**
   - Look for cards or sections labeled "Domains" or "Allowed Domains"

---

## Alternative: Update Redirect URLs Instead

If you can't find a specific "domains" section, Clerk might automatically allow domains based on your redirect URLs:

1. **Go to:** **Configure** → **Paths**

2. **Update these URLs:**
   ```
   After Sign In URL: https://translatoraxis.com/
   After Sign Up URL: https://translatoraxis.com/
   Sign In URL: https://translatoraxis.com/sign-in
   Sign Up URL: https://translatoraxis.com/sign-up
   ```

3. **Save changes**

Clerk may automatically add `translatoraxis.com` to allowed domains when you save these URLs.

---

## Verification Steps

After adding the domain:

1. **Check Domain List:**
   - Verify `translatoraxis.com` appears in your allowed domains list
   - Both `translator.clickbric.com` and `translatoraxis.com` should be listed (keep old one temporarily)

2. **Test Authentication:**
   - Visit: `https://translatoraxis.com/sign-in`
   - Try signing in
   - If it works, the domain is configured correctly

3. **Check for Errors:**
   - If you see "Domain not allowed" errors, the domain wasn't added correctly
   - Double-check the domain spelling (no `https://`, no trailing slash)

---

## Troubleshooting

### Issue: Can't Find "Domains" Section

**Solution 1:** Clerk might use a different term:
- Look for "Allowed Origins"
- Look for "Authorized Domains"
- Look for "Domain Whitelist"
- Check under "Security" settings

**Solution 2:** Your Clerk plan might not show this option:
- Free/Development plans might auto-allow domains based on redirect URLs
- Try updating redirect URLs first (see Method 4 above)

**Solution 3:** Contact Clerk Support:
- If you still can't find it, Clerk's UI might have changed
- Contact support: https://clerk.com/support
- Or check their docs: https://clerk.com/docs/authentication/domains

### Issue: Domain Already Exists

If `translatoraxis.com` is already listed:
- You're all set! No action needed
- Just verify it's active/enabled

### Issue: Changes Not Taking Effect

1. **Wait a few minutes** - DNS and domain changes can take time
2. **Clear browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. **Check environment variables** - Ensure Clerk keys are correct
4. **Redeploy your app** - If using Vercel/Coolify, trigger a redeploy

---

## Quick Checklist

- [ ] Logged into Clerk Dashboard
- [ ] Selected correct application
- [ ] Found "Domains" or "Paths" section
- [ ] Added `translatoraxis.com` (without https://)
- [ ] Saved changes
- [ ] Verified domain appears in list
- [ ] Tested sign-in on new domain

---

## Still Stuck?

If you're still unable to find where to add the domain:

1. **Take a screenshot** of your Clerk Dashboard sidebar/navigation
2. **Check Clerk Documentation:**
   - https://clerk.com/docs/authentication/domains
   - Search for "allowed domains" or "domain configuration"

3. **Contact Clerk Support:**
   - They can guide you to the exact location in your dashboard
   - Support: https://clerk.com/support

4. **Alternative Approach:**
   - Update redirect URLs first (Method 4 above)
   - Clerk may auto-allow the domain
   - Test authentication to verify

---

## Important Notes

- **Don't remove** `translator.clickbric.com` immediately - keep both domains active for a few weeks
- **No protocol needed** - Enter just `translatoraxis.com`, not `https://translatoraxis.com`
- **No trailing slash** - Don't add `/` at the end
- **Case doesn't matter** - Clerk handles this automatically

