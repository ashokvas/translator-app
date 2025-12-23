# Quick Deployment Reference

## 🚀 Fastest Path to Production: Vercel + Railway

### Step 1: Deploy LibreOffice Service (5 minutes)

1. **Create Railway account**: https://railway.app
2. **New Project** → "Empty Project"
3. **New** → "GitHub Repo"
4. Select your repository
5. **Change root directory** to `libreoffice-service`
6. Railway auto-detects Dockerfile and deploys
7. **Copy your service URL**: `https://your-service-xxxxx.railway.app`

### Step 2: Deploy Main App to Vercel (5 minutes)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd /Users/ashok/Documents/Translator-app
vercel
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? (select your account)
- Link to existing project? **N**
- What's your project's name? **translator-app**
- In which directory is your code located? **./**
- Want to override settings? **N**

### Step 3: Add Environment Variables in Vercel

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add these (copy from your `.env.local`):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
GOOGLE_CLOUD_API_KEY=your_google_api_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
LIBREOFFICE_SERVICE_URL=https://your-service-xxxxx.railway.app
```

**Important**: Set all variables for **Production**, **Preview**, and **Development** environments.

### Step 4: Redeploy

```bash
vercel --prod
```

### Step 5: Configure Production Services

#### Clerk
1. https://dashboard.clerk.com
2. Create **Production** instance (or switch existing)
3. Add your Vercel domain to **Allowed domains**
4. Update Clerk keys in Vercel if needed

#### Convex
1. https://dashboard.convex.dev
2. Create **Production** deployment
3. Update `NEXT_PUBLIC_CONVEX_URL` in Vercel with production URL
4. Redeploy: `vercel --prod`

#### PayPal
1. https://developer.paypal.com
2. Switch to **Live** credentials (not Sandbox)
3. Update `NEXT_PUBLIC_PAYPAL_CLIENT_ID` in Vercel
4. Redeploy: `vercel --prod`

### Step 6: Test Everything

Visit your Vercel URL (e.g., `https://translator-app.vercel.app`)

Test:
- [ ] Sign up / Sign in
- [ ] Create order with DOCX file
- [ ] Verify page count is correct
- [ ] Upload PDF, images
- [ ] PayPal payment
- [ ] Admin dashboard
- [ ] Translation workflow

---

## 📊 Cost Estimate

**Free Tier (for testing):**
- Vercel: Free (Hobby plan)
- Railway: $5/month (500 hours free, then pay-as-you-go)
- Convex: Free tier (good for development)
- Google Cloud: ~$1-10/month (pay per use)
- **Total: $0-15/month**

**Production (with traffic):**
- Vercel Pro: $20/month
- Railway: $5-20/month
- Convex: $25+/month
- Google Cloud: $10-100/month (depends on translation volume)
- **Total: $60-165/month**

---

## 🔧 Alternative: Test Locally First

Before deploying, test the LibreOffice service locally:

```bash
# Terminal 1: Start LibreOffice service
cd libreoffice-service
npm install
npm start

# Terminal 2: Update .env.local
echo "LIBREOFFICE_SERVICE_URL=http://localhost:3001" >> .env.local

# Terminal 3: Start main app
cd ..
npm run dev

# Terminal 4: Start Convex
npx convex dev
```

Test file upload with DOCX to verify it works.

---

## 🆘 Troubleshooting

### Railway deployment fails
```bash
# Check logs
railway logs

# Common fix: Ensure Dockerfile is in libreoffice-service/
```

### Vercel build fails
```bash
# Test build locally first
npm run build

# Check Vercel logs in dashboard
```

### LibreOffice service not responding
```bash
# Test health check
curl https://your-service-xxxxx.railway.app/health

# Should return: {"status":"ok",...}
```

### File upload fails in production
- Check `LIBREOFFICE_SERVICE_URL` is set in Vercel
- Verify Railway service is running
- Check Vercel function logs

### Translation fails
- Verify Google Cloud billing is enabled
- Check API keys are correct
- Confirm APIs are enabled in Google Cloud Console

---

## 📱 Custom Domain (Optional)

### Add to Vercel
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `translate.yourdomain.com`)
3. Follow DNS instructions

### Update Clerk
1. Add custom domain to Clerk allowed domains
2. Update redirect URLs if needed

---

## 🔐 Security Checklist

- [ ] All environment variables set in Vercel (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] Using production API keys (not test/sandbox)
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Clerk production instance configured
- [ ] PayPal live credentials (not sandbox)
- [ ] Google Cloud billing enabled
- [ ] File upload limits enforced (10MB)

---

## 📈 Post-Deployment

### Monitor
- Vercel Analytics: https://vercel.com/analytics
- Railway Metrics: Check CPU/Memory usage
- Convex Dashboard: Monitor database usage
- Google Cloud Console: Check API usage & costs

### Optimize
- Enable Next.js caching
- Monitor Core Web Vitals
- Set up error tracking (Sentry)
- Configure rate limiting

---

## 🎯 Next Steps After Deployment

1. **Test thoroughly** with real files
2. **Set up monitoring** (Sentry, LogRocket)
3. **Configure email service** (replace console.log)
4. **Add rate limiting** to prevent abuse
5. **Set up backups** for Convex data
6. **Create admin user** for yourself
7. **Test payment flow** end-to-end
8. **Mobile testing** on real devices

---

## 💡 Pro Tips

1. **Use Preview Deployments**: Every git push creates a preview URL in Vercel
2. **Environment Variables**: Use different values for Preview vs Production
3. **Rollback**: Vercel makes it easy to rollback to previous deployments
4. **Logs**: Check Vercel function logs for debugging
5. **Railway Logs**: `railway logs --follow` for real-time monitoring

---

## 📞 Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Convex Docs**: https://docs.convex.dev
- **Clerk Docs**: https://clerk.com/docs
- **Next.js Docs**: https://nextjs.org/docs

---

## ✅ Deployment Complete!

Once deployed, your app will be:
- ✅ Globally distributed (CDN)
- ✅ Auto-scaling
- ✅ HTTPS enabled
- ✅ Zero-downtime deployments
- ✅ Automatic backups (Convex)
- ✅ 99.9% uptime

**Your app is production-ready!** 🎉


