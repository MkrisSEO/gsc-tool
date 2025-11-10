# ⚡ Quick Deploy Guide - 30 Minutes to Live!

## 🎯 Step-by-Step: Go Live Now

### ✅ **Step 1: Test Local Build (5 min)**

```bash
# In PowerShell:
npm run build
```

**If build succeeds:** Continue ✅  
**If build fails:** Fix errors first, then retry

---

### ✅ **Step 2: Create GitHub Repo (5 min)**

```bash
# Initialize Git
git init

# Add all files
git add .

# First commit
git commit -m "Initial commit - GSC Tool ready for production"
```

**Then:**
1. Go to https://github.com/new
2. Name: `gsc-tool`
3. Private ✅
4. Click "Create repository"

```bash
# Connect to GitHub (use YOUR username!)
git remote add origin https://github.com/YOUR-USERNAME/gsc-tool.git
git branch -M main
git push -u origin main
```

---

### ✅ **Step 3: Deploy to Vercel (10 min)**

1. **Go to** https://vercel.com
2. **Sign in** with GitHub
3. **Click** "Add New" → "Project"
4. **Import** `gsc-tool` repository
5. **Click** "Deploy" (use default settings)

**Wait 2-3 minutes...**

You'll get a URL like: `https://gsc-tool-abc123.vercel.app`

---

### ✅ **Step 4: Add Environment Variables (5 min)**

In Vercel:

1. **Go to** Project → Settings → Environment Variables
2. **Add these ONE BY ONE:**

```env
NEXTAUTH_SECRET=your-secret-from-env-local
NEXTAUTH_URL=https://gsc-tool-abc123.vercel.app
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
DATABASE_URL=your-supabase-pooling-url
DIRECT_URL=your-supabase-direct-url
GEMINI_API_KEY=your-gemini-key
GA4_PROPERTY_ID=your-ga4-id
DATAFORSEO_LOGIN=ml@morningbound.dk
DATAFORSEO_PASSWORD=01c405a4e89f9028
CRON_SECRET=rank-tracker-cron-secret-2025-abc123xyz789
```

3. **Click** "Save"

---

### ✅ **Step 5: Update OAuth Redirect (3 min)**

⚠️ **CRITICAL** - Login won't work without this!

1. **Go to** https://console.cloud.google.com
2. **Select** your Google Cloud project
3. **APIs & Services** → **Credentials**
4. **Click** your OAuth 2.0 Client ID
5. **Scroll to** "Authorized redirect URIs"
6. **Click** "+ ADD URI"
7. **Add:**
   ```
   https://your-actual-vercel-url.vercel.app/api/auth/callback/google
   ```
   (Use your REAL Vercel URL!)
8. **Click** "Save"

---

### ✅ **Step 6: Redeploy with Updated NEXTAUTH_URL (2 min)**

1. **Go to** Vercel → Deployments
2. **Click** "..." on latest deployment
3. **Click** "Redeploy"
4. **Wait** 2 minutes

---

### ✅ **Step 7: Test Production Site (5 min)**

**Open** `https://your-vercel-url.vercel.app`

**Test:**
- [ ] Login with Google works
- [ ] Can select site (Omregne.dk or Rajapack.dk)
- [ ] Dashboard loads data
- [ ] Rank Tracker tab works
- [ ] No errors in browser console (F12)

**🎉 If all work: YOU'RE LIVE!**

---

## 🔄 After Initial Deployment: Daily Workflow

When you make changes locally:

```bash
# 1. Make changes, test locally
npm run dev

# 2. Commit changes
git add .
git commit -m "fix: Whatever you fixed"

# 3. Push to GitHub
git push

# 4. ✅ Done! Vercel auto-deploys
```

**That's it!** Every `git push` triggers automatic deployment! 🚀

---

## ⚠️ **If Something Goes Wrong:**

### **Build Fails in Vercel:**

1. Check build logs in Vercel
2. Fix error locally
3. Test with `npm run build`
4. Commit and push again

### **Login Doesn't Work:**

→ Double-check OAuth redirect URI in Google Cloud Console

### **Database Connection Error:**

→ Verify `DATABASE_URL` in Vercel Environment Variables

### **App Works But Looks Broken:**

→ Hard refresh browser: `Ctrl + Shift + R` (clears cache)

---

## 📞 **Need Help?**

See full guide: `DEPLOYMENT.md`

---

**Total Time: ~30 minutes**  
**Result: Production-ready app! 🎉**

