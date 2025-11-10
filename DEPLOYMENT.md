# 🚀 GSC Tool - Complete Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Initial Deployment to Vercel](#initial-deployment-to-vercel)
3. [Ongoing Development Workflow](#ongoing-development-workflow)
4. [Database Migrations](#database-migrations)
5. [Troubleshooting](#troubleshooting)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 📋 Pre-Deployment Checklist

### 1. **Verify `.gitignore` is Correct**

Ensure your `.gitignore` file contains:

```gitignore
# Dependencies
node_modules/

# Next.js build output
.next/
out/
dist/

# Environment variables (CRITICAL - Never commit these!)
.env
.env.local
.env*.local

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Prisma
/generated/prisma

# IDE
.vscode/
.idea/
*.swp
*.swo
```

**⚠️ CRITICAL:** Make sure `.env.local` is in `.gitignore`!

---

### 2. **Test Production Build Locally**

```bash
# Build the app
npm run build

# If successful, test production mode
npm start

# Open http://localhost:3000 and verify:
# ✓ Login works
# ✓ Dashboard loads
# ✓ All features functional
# ✓ No console errors

# Stop with Ctrl+C
```

If build fails, fix errors before deploying!

---

### 3. **Collect Environment Variables**

You'll need these values for Vercel. Copy them from your `.env.local`:

**Auth & OAuth:**
```env
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Database (Supabase):**
```env
DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
```

**APIs:**
```env
GEMINI_API_KEY=your-gemini-key
GA4_PROPERTY_ID=your-property-id
DATAFORSEO_LOGIN=ml@morningbound.dk
DATAFORSEO_PASSWORD=01c405a4e89f9028
```

**Security:**
```env
CRON_SECRET=rank-tracker-cron-secret-2025-abc123xyz789
```

---

## 🌐 Initial Deployment to Vercel

### Step 1: Initialize Git Repository

```bash
# Navigate to your project folder
cd C:\Users\Mkris\Desktop\GSC-tool

# Initialize Git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - GSC Tool ready for production"
```

---

### Step 2: Create GitHub Repository

1. **Go to** https://github.com/new
2. **Repository name:** `gsc-tool` (or whatever you prefer)
3. **Visibility:** Private (recommended - contains business logic)
4. **DO NOT** initialize with README (we already have files)
5. **Click** "Create repository"

---

### Step 3: Push to GitHub

```bash
# Add GitHub as remote (use YOUR username!)
git remote add origin https://github.com/YOUR-USERNAME/gsc-tool.git

# Verify remote was added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main

# Enter your GitHub credentials if prompted
```

**Verify:** Go to GitHub repo and see your files are uploaded ✅

---

### Step 4: Deploy to Vercel

#### A. Sign Up / Login to Vercel

1. **Go to** https://vercel.com
2. **Sign up** with GitHub account
3. **Authorize** Vercel to access your repositories

#### B. Import Project

1. **Click** "Add New" → "Project"
2. **Select** your `gsc-tool` repository
3. **Click** "Import"

#### C. Configure Project

**Framework Preset:** Next.js (auto-detected) ✅

**Build & Output Settings:** (Leave as default)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

**Root Directory:** `./` (leave as is)

#### D. Add Environment Variables

Click **"Environment Variables"** and add ALL of these:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-from-env-local
NEXTAUTH_URL=https://your-app.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Database (Supabase)
DATABASE_URL=postgresql://postgres.stsgyjokhumzchuyityj:y8z7_jiT9%29PR%40%2B%25@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:y8z7_jiT9%29PR%40%2B%25@db.stsgyjokhumzchuyityj.supabase.co:5432/postgres

# Gemini AI
GEMINI_API_KEY=your-gemini-key

# Google Analytics 4
GA4_PROPERTY_ID=your-property-id

# DataForSEO API
DATAFORSEO_LOGIN=ml@morningbound.dk
DATAFORSEO_PASSWORD=01c405a4e89f9028

# Cron Job Security
CRON_SECRET=rank-tracker-cron-secret-2025-abc123xyz789
```

**⚠️ IMPORTANT:**
- Use your ACTUAL values (not placeholders)
- `NEXTAUTH_URL` will be updated after you get your Vercel URL
- Password in DATABASE_URL must be URL-encoded (%, @, etc.)

#### E. Deploy!

1. **Click** "Deploy"
2. **Wait** 2-3 minutes
3. **You'll get a URL** like: `https://gsc-tool-abc123.vercel.app`

---

### Step 5: Update OAuth Redirect URI

⚠️ **CRITICAL STEP** - Without this, login won't work!

1. **Go to** https://console.cloud.google.com
2. **Select** your project
3. **APIs & Services** → **Credentials**
4. **Click** your OAuth 2.0 Client ID
5. **Under "Authorized redirect URIs"**, click **"+ ADD URI"**
6. **Add:**
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
   (Use your ACTUAL Vercel URL!)
7. **Click** "Save"

---

### Step 6: Update NEXTAUTH_URL in Vercel

1. **Go to** Vercel Dashboard → Your Project
2. **Settings** → **Environment Variables**
3. **Find** `NEXTAUTH_URL`
4. **Edit** and change to: `https://your-actual-vercel-url.vercel.app`
5. **Save**
6. **Redeploy:** Deployments → Click "..." → "Redeploy"

---

### Step 7: Verify Deployment ✅

Open your production URL and test:

- [ ] Login with Google works
- [ ] Dashboard loads
- [ ] Can select site
- [ ] Data displays correctly
- [ ] All tabs accessible (Dashboard, Rank Tracker, Indexing, etc.)
- [ ] No console errors

**🎉 If all checked: YOU'RE LIVE!**

---

## 🔄 Ongoing Development Workflow

### **Scenario: You Fixed a Bug Locally**

```bash
# 1. After making changes and testing locally
git status
# Shows which files changed

# 2. Review changes (optional but recommended)
git diff app/dashboard/page.tsx

# 3. Add changes
git add .

# 4. Commit with descriptive message
git commit -m "fix: Dashboard respects date range changes"

# 5. Push to GitHub
git push

# 6. ⚡ Vercel AUTO-DEPLOYS (no additional steps!)
# Check Vercel dashboard for deployment status
```

**Total time: 30 seconds!** ⚡

---

### **Scenario: You Added a New Feature**

```bash
# 1. Test locally first
npm run dev
# → Test feature thoroughly

# 2. Build and test production mode
npm run build
npm start
# → Verify no build errors

# 3. Commit and push
git add .
git commit -m "feat: Add Content Group batch filtering with dimensionFilterGroups"
git push

# 4. Monitor deployment in Vercel
# → Click deployment to see build logs
# → Verify it succeeds
```

---

### **Scenario: Database Schema Changed (Prisma)**

```bash
# 1. Update schema.prisma locally
# ... make changes ...

# 2. Push to database
npx prisma db push

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Test locally
npm run dev
# → Verify everything works with new schema

# 5. Commit and push
git add prisma/schema.prisma
git commit -m "schema: Add new RankKeyword fields"
git push

# 6. ⚡ Vercel will:
#    - Run `npm install` (installs @prisma/client)
#    - Run `prisma generate` (auto-generates client)
#    - Deploy new version
```

**Note:** Since you use the same Supabase database for dev and production, schema is already updated! No migration needed in production.

---

## 📦 Database Migrations

### **For Schema Changes:**

Your setup uses **Supabase (single database)** for both dev and production, so:

```bash
# Development (your local machine):
npx prisma db push  # Updates Supabase database

# Production (Vercel):
# ✅ Already updated! (same database)
# Vercel just regenerates Prisma Client
```

### **For Data Migrations (scripts):**

If you need to run a data migration script:

```bash
# 1. Run locally first (to test)
npm run migrate:data

# 2. Verify in Supabase (check tables)

# 3. Done! 
# (Production uses same DB, so migration already applied)
```

---

### **⚠️ Important: Separate Dev/Prod Databases (Future)**

For production apps, you should have:
- **Dev Database:** For testing (Supabase dev instance)
- **Prod Database:** For real users (Supabase prod instance)

**To implement this:**
```env
# .env.local (development)
DATABASE_URL=postgresql://...dev-database...

# Vercel Environment Variables (production)
DATABASE_URL=postgresql://...prod-database...
```

Then migrations look like:
1. Test in dev DB
2. Verify works
3. Push to GitHub
4. Vercel deploys + migrates prod DB automatically

---

## 🔧 Troubleshooting

### **Build Fails in Vercel**

**Check Vercel Build Logs:**
1. Go to Deployment in Vercel
2. Click "Building" tab
3. Look for error messages

**Common Issues:**

#### **TypeScript Errors:**
```bash
# Fix locally first
npm run build  # See exact error
# Fix the error
git commit -am "fix: TypeScript errors"
git push
```

#### **Missing Dependencies:**
```bash
# Ensure package.json is committed
git add package.json
git add package-lock.json
git commit -m "chore: Update dependencies"
git push
```

#### **Environment Variables Missing:**
```
Error: Environment variable not found: DATABASE_URL
```
→ Go to Vercel Settings → Environment Variables → Add missing variable → Redeploy

---

### **Login Doesn't Work (OAuth Error)**

**Symptom:** "Redirect URI mismatch" error

**Fix:**
1. Go to Google Cloud Console
2. OAuth 2.0 Client → Authorized redirect URIs
3. Add: `https://your-actual-vercel-url.vercel.app/api/auth/callback/google`
4. Save
5. Wait 5 minutes for Google to propagate
6. Try login again

---

### **Database Connection Fails**

**Symptom:** "Can't reach database server"

**Check:**
1. Vercel Environment Variables have correct `DATABASE_URL`
2. Password is URL-encoded (`@` = `%40`, `+` = `%2B`, `)` = `%29`)
3. Using **Session Pooler** port (`:6543`) not Transaction Pooler (`:6432`)

**Test Database Connection:**
```bash
# In Vercel deployment logs, look for:
[Database] Connected successfully ✓
```

If missing, database connection failed.

---

### **Cron Jobs Don't Run**

**Verify Cron Schedule:**
1. Go to Vercel → Project → Settings → Cron Jobs
2. Should see:
   - `sync-query-counting`: 3x daily
   - `sync-dashboard-data`: 3x daily
   - `sync-indexing`: Daily at 3 AM
   - `check-ranks-dataforseo`: Weekly (Monday 4 AM)

**Check Cron Logs:**
1. Vercel → Deployments → Click latest
2. Functions → Find cron function
3. View logs

**Common Issue:** Cron secret mismatch
```typescript
// Verify in Vercel env vars:
CRON_SECRET=rank-tracker-cron-secret-2025-abc123xyz789

// Must match code in app/api/cron/*/route.ts
```

---

### **"App is Slow" in Production**

**Diagnosis:**
1. Open browser DevTools → Network tab
2. Find slow requests
3. Check:
   - Database queries (should be <100ms)
   - API calls to Google (should be <2s)
   - Frontend rendering (should be <1s)

**Common Fixes:**
- Clear Supabase connection pool (Supabase Dashboard → Database → Connection Pooling → Restart)
- Check Vercel function timeout (default 10s, upgrade for more)
- Verify in-memory caches are working (check logs for "Cache HIT")

---

## 🔄 Rollback Procedures

### **Scenario 1: Bug in Latest Deployment**

#### **Quick Rollback (Vercel UI - 10 seconds):**

1. **Go to** Vercel → Deployments
2. **Find** previous working deployment
3. **Click** "..." menu → **"Promote to Production"**
4. **Confirm**

**Done!** Previous version is now live. ✅

#### **Git Rollback (Permanent Fix):**

```bash
# Find the bad commit
git log --oneline
# abc123d fix: Bug fix (broken) ← This one!
# def456e feat: Working feature ← Rollback to this

# Option A: Revert (creates new commit that undoes changes)
git revert abc123d
git push
# → Safer, keeps history

# Option B: Hard reset (rewrites history)
git reset --hard def456e
git push --force
# ⚠️ Dangerous! Only if you're sure
```

---

### **Scenario 2: Database Schema Issue**

If you pushed a bad schema change:

```bash
# 1. Rollback schema in code
git revert <commit-with-schema-change>
git push

# 2. Manually fix database (Supabase SQL Editor)
# Run SQL to undo schema changes, e.g.:
DROP TABLE IF EXISTS "BadTable";
ALTER TABLE "GoodTable" DROP COLUMN "badColumn";

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Test locally, then commit
git add prisma/schema.prisma
git commit -m "revert: Rollback bad schema change"
git push
```

---

### **Scenario 3: Emergency - Site is Down**

```bash
# Immediate fix: Redeploy last known good version in Vercel UI

# Then investigate logs:
# 1. Vercel → Latest Deployment → Runtime Logs
# 2. Look for errors
# 3. Check Supabase logs (Database → Logs)

# Common causes:
# - Environment variable missing/wrong
# - Database connection pool exhausted
# - API rate limit hit (Google/DataForSEO)
# - Prisma Client version mismatch
```

---

## 📊 Monitoring & Maintenance

### **Daily Checks (Automated via Cron):**

Your cron jobs run automatically:

| Cron Job | Schedule | What It Does |
|----------|----------|--------------|
| `sync-query-counting` | 8:00, 14:00, 20:00 UTC | Syncs Query Counting data |
| `sync-dashboard-data` | 6:00, 12:00, 18:00 UTC | Syncs Time Series, Queries, URLs |
| `sync-indexing` | 3:00 AM UTC daily | Syncs Indexing status |
| `check-ranks-dataforseo` | Monday 4:00 AM UTC | Weekly live rank checks |

**Monitor Cron Success:**
```bash
# Check Vercel Function Logs:
# Vercel → Deployments → Latest → Functions → Select cron function → View Logs

# Look for:
✓ [Sync] Completed: 1000 rows synced
✓ [Cron] Successfully synced 3 sites
```

---

### **Weekly Maintenance:**

**Check These Metrics:**

1. **Database Size** (Supabase Dashboard → Database → Disk Usage)
   - Should grow ~500 MB per month for large sites
   - If >10 GB, consider archiving old data

2. **API Usage** (Google Cloud Console → APIs & Services → Dashboard)
   - Search Console API calls
   - Should be <10,000 calls/day for 3-5 sites
   - If higher, optimize caching

3. **DataForSEO Costs** (DataForSEO Dashboard)
   - Weekly rank checks cost ~$0.01-0.05 per keyword
   - Monitor monthly spend

4. **Vercel Function Invocations** (Vercel → Analytics → Functions)
   - Should be <100,000/month on free tier
   - Upgrade if you hit limits

---

### **Performance Monitoring:**

**In Production, Monitor These Logs:**

```javascript
// Dashboard load time (good: <5s, bad: >15s)
⏱️ [Performance] Dashboard loaded in 3.95s ✅

// API call times (good: <2s, bad: >5s)
⏱️ [Performance] API calls completed in 2.13s ✅

// Memory cache hits (good: >50%, bad: <10%)
⚡ [Query Counting API] Memory cache HIT (instant!) ✅
```

**If Performance Degrades:**
- Check Supabase connection pool
- Verify indexes exist on database tables
- Check for N+1 query problems
- Consider upgrading Vercel plan (more memory/CPU)

---

## 🔐 Security Best Practices

### **1. Never Commit Secrets**

**Before EVERY commit:**
```bash
# Check what you're committing
git diff --staged

# If you see API keys, passwords, secrets:
git reset  # Unstage everything
# Add files individually (without .env.local)
```

### **2. Rotate Secrets Regularly**

Every 3-6 months, rotate:
- `NEXTAUTH_SECRET` (generate new: `openssl rand -base64 32`)
- `CRON_SECRET`
- `DATAFORSEO_PASSWORD` (if DataForSEO allows)

**Update in:**
- Vercel Environment Variables
- Your local `.env.local`

### **3. Use Environment-Specific Secrets**

```env
# Production (Vercel)
CRON_SECRET=prod-secret-xyz789

# Development (Local)
CRON_SECRET=dev-secret-abc123
```

This prevents dev cron calls from affecting production!

---

## 🎓 Git Best Practices

### **Commit Message Format:**

```bash
# Structure: <type>: <description>

# Types:
feat:     New feature (e.g., "feat: Add Rank Tracker tab")
fix:      Bug fix (e.g., "fix: Query Counting shows 0")
perf:     Performance improvement (e.g., "perf: Set-based filtering")
refactor: Code restructure (e.g., "refactor: Extract positionUtils")
docs:     Documentation (e.g., "docs: Add deployment guide")
chore:    Maintenance (e.g., "chore: Update dependencies")
schema:   Database schema change (e.g., "schema: Add RankKeyword model")
```

### **Examples:**

```bash
git commit -m "feat: Implement dimensionFilterGroups for URL detail page"
git commit -m "fix: Rank Tracker GSC rank shows 999 instead of real position"
git commit -m "perf: Optimize dashboard filtering from O(n*m) to O(n)"
git commit -m "schema: Add QueryCountingAggregate model for pre-aggregation"
```

---

### **Branching Strategy (Recommended):**

```bash
# Main branch = Production (always stable)
# Dev branch = Development (test here first)

# Create dev branch (first time only)
git checkout -b dev
git push -u origin dev

# Daily workflow:
git checkout dev           # Switch to dev
# ... make changes ...
git add .
git commit -m "feat: New feature"
git push origin dev        # Push to dev branch

# Vercel creates preview deployment at:
# https://gsc-tool-abc123-dev.vercel.app

# Test thoroughly in preview

# When ready for production:
git checkout main
git merge dev
git push origin main       # Deploy to production!
```

**Benefits:**
- ✅ Test in production-like environment before going live
- ✅ Rollback is easy (just don't merge to main)
- ✅ Multiple developers can work on different features

---

## 📱 Common Development Commands

### **Full Update (After Making Changes):**

```bash
# Quick version (auto-adds all changes)
git add . && git commit -m "Your message here" && git push

# Safe version (review first)
git status                          # See what changed
git diff                            # Review changes
git add app/dashboard/page.tsx      # Add specific files
git commit -m "fix: Dashboard bug"
git push
```

---

### **Check Deployment Status:**

```bash
# View recent commits
git log --oneline -5

# Check if local is ahead of remote
git status

# See what's in production (GitHub)
# → Go to your repo on GitHub
# → Check latest commit matches your local
```

---

### **Sync Local with Production:**

```bash
# If someone else made changes (or you work on multiple machines):
git pull origin main

# This downloads latest code from GitHub
# Then continue working locally
```

---

## 🚨 Emergency Procedures

### **Production is Down - Critical Bug:**

```bash
# Step 1: Immediate rollback in Vercel (10 seconds)
# → Vercel Dashboard → Deployments → Previous working → Promote to Production

# Step 2: Fix bug locally (take your time)
# ... fix code ...
npm run build  # Verify fix works
npm start

# Step 3: Deploy fix
git add .
git commit -m "hotfix: Critical bug that broke production"
git push

# Step 4: Monitor new deployment
# → Vercel Dashboard → Watch build logs
# → Verify deployment succeeds
# → Test production URL
```

---

### **Database is Corrupted:**

```bash
# 1. Check Supabase Dashboard → Database → Backups
# 2. Restore from backup (choose date/time)
# 3. Verify data restored correctly
# 4. Redeploy app if needed
```

---

## 📈 Scaling Considerations

### **When You Grow:**

**Free Tier Limits (Vercel):**
- 100 GB bandwidth/month
- 100,000 function invocations/month
- Cron jobs work on free tier ✅

**When to Upgrade to Pro ($20/mo):**
- ✅ Multiple team members need access
- ✅ >5 sites with heavy traffic
- ✅ Need longer function timeouts (>10s)
- ✅ Need analytics & monitoring

**Supabase Limits:**
- Free tier: 500 MB database, 2 GB bandwidth
- Pro tier ($25/mo): 8 GB database, 50 GB bandwidth

---

## 📚 Quick Reference Card

### **Everyday Commands:**

```bash
# After making changes:
git add .
git commit -m "Description of change"
git push

# That's it! Vercel auto-deploys.
```

### **Check Status:**

```bash
git status           # See what changed locally
git log --oneline    # See recent commits
git remote -v        # See GitHub connection
```

### **Emergency:**

```bash
# Rollback in Vercel UI (10 seconds)
# OR
git revert HEAD      # Undo last commit
git push
```

---

## ✅ Post-Deployment Checklist

After first deployment, verify:

- [ ] Production URL works: `https://your-app.vercel.app`
- [ ] Login with Google OAuth works
- [ ] Dashboard loads data for your sites
- [ ] All tabs accessible (Dashboard, Rank Tracker, Indexing, GEO, etc.)
- [ ] Cron jobs scheduled in Vercel (Settings → Cron Jobs)
- [ ] Environment variables all set (Settings → Environment Variables)
- [ ] No errors in Vercel Runtime Logs
- [ ] No errors in browser console (F12)
- [ ] Database queries work (check Supabase logs)
- [ ] Custom domain configured (optional - Settings → Domains)

---

## 🎯 Summary: Your Daily Workflow

```bash
# 1. Develop locally
npm run dev
# ... make changes ...
# ... test in browser ...

# 2. Commit and push
git add .
git commit -m "feat/fix: What you changed"
git push

# 3. ✅ Done!
# Vercel auto-deploys in 2-3 minutes
# Check https://your-app.vercel.app
```

**That's it!** 🎉

---

## 📞 Support Resources

**Vercel Documentation:**
- https://vercel.com/docs
- https://vercel.com/docs/cron-jobs

**Supabase Documentation:**
- https://supabase.com/docs
- https://supabase.com/docs/guides/database/connecting-to-postgres

**Next.js Documentation:**
- https://nextjs.org/docs
- https://nextjs.org/docs/deployment

**Prisma Documentation:**
- https://www.prisma.io/docs
- https://www.prisma.io/docs/guides/deployment

---

## 🎉 You're Ready to Deploy!

**Total time to go live: ~30 minutes**

1. ⏱️ 5 min: Setup GitHub repo
2. ⏱️ 10 min: Deploy to Vercel + configure env vars
3. ⏱️ 5 min: Update OAuth redirect URI
4. ⏱️ 5 min: Test production site
5. ⏱️ 5 min: Setup monitoring

**Ongoing deployments: 30 seconds** (git add, commit, push) 🚀

Good luck! 🍀

