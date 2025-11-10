# ✅ Deployment Checklist

Print this or keep it open during deployment!

---

## 🎯 Pre-Deployment

- [ ] Run `npm run build` locally (succeeds without errors)
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] All features tested locally and working
- [ ] Have all environment variable values ready

---

## 🌐 Initial Deployment

- [ ] `git init` (initialize repository)
- [ ] `git add .` (stage all files)
- [ ] `git commit -m "Initial commit"` (first commit)
- [ ] Created GitHub repository (private recommended)
- [ ] `git remote add origin https://github.com/USERNAME/gsc-tool.git`
- [ ] `git push -u origin main` (pushed to GitHub)
- [ ] Signed up/logged in to Vercel (https://vercel.com)
- [ ] Imported project from GitHub to Vercel
- [ ] Added ALL environment variables in Vercel settings:
  - [ ] `NEXTAUTH_SECRET`
  - [ ] `NEXTAUTH_URL` (use your Vercel URL)
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `DATABASE_URL`
  - [ ] `DIRECT_URL`
  - [ ] `GEMINI_API_KEY`
  - [ ] `GA4_PROPERTY_ID`
  - [ ] `DATAFORSEO_LOGIN`
  - [ ] `DATAFORSEO_PASSWORD`
  - [ ] `CRON_SECRET`
- [ ] Clicked "Deploy" in Vercel
- [ ] Received Vercel URL (e.g., `https://gsc-tool-abc123.vercel.app`)

---

## 🔐 OAuth Configuration

- [ ] Opened Google Cloud Console (https://console.cloud.google.com)
- [ ] Selected correct project
- [ ] APIs & Services → Credentials
- [ ] Clicked OAuth 2.0 Client ID
- [ ] Added Authorized redirect URI:
  ```
  https://your-vercel-url.vercel.app/api/auth/callback/google
  ```
- [ ] Saved changes
- [ ] Updated `NEXTAUTH_URL` in Vercel to match Vercel URL
- [ ] Redeployed in Vercel

---

## 🧪 Testing

- [ ] Opened production URL
- [ ] Login with Google works
- [ ] Dashboard loads without errors
- [ ] Can select site from dropdown
- [ ] Time series chart displays data
- [ ] Query Counting shows position distribution
- [ ] Top URLs and Top Queries tables populated
- [ ] Rank Tracker tab accessible
- [ ] Indexing tab accessible
- [ ] No console errors (F12)
- [ ] Tested on mobile device (responsive)

---

## 🔄 Post-Deployment

- [ ] Bookmarked production URL
- [ ] Saved Vercel dashboard link
- [ ] Set up status monitoring (optional - Vercel Analytics)
- [ ] Verified cron jobs scheduled (Vercel → Settings → Cron Jobs)
- [ ] First cron job ran successfully (check logs after scheduled time)

---

## 📋 Daily Development Workflow

When making changes:

```bash
- [ ] Make changes locally
- [ ] Test with `npm run dev`
- [ ] git add .
- [ ] git commit -m "Description"
- [ ] git push
- [ ] Verify deployment in Vercel (2-3 min)
- [ ] Test production URL
```

---

## 🚨 Emergency Contacts

**If Production Breaks:**

1. **Quick Rollback:** Vercel → Deployments → Previous working → "Promote to Production"
2. **Check Logs:** Vercel → Runtime Logs
3. **Database Issues:** Supabase → Logs

**Support Resources:**
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs

---

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ Production URL loads without errors
- ✅ Login works with Google OAuth
- ✅ Dashboard displays real GSC data
- ✅ All tabs functional
- ✅ Cron jobs running (verify in logs after first scheduled run)
- ✅ Performance acceptable (<5s load time)

**Congratulations! 🎊 You're live!**

---

**Last Updated:** November 10, 2025  
**Version:** 1.0  
**Deployment Platform:** Vercel + Supabase

