# 🔍 GSC Tool - Professional SEO Dashboard

A comprehensive Next.js application for visualizing and analyzing Google Search Console data with advanced features like rank tracking, indexing monitoring, content groups, and automated data synchronization.

## ✨ Features

- 📊 **Dashboard**: Time series charts, Query Counting, Top URLs/Queries, Metrics cards
- 📈 **Rank Tracker**: Track keyword positions with GSC + DataForSEO integration
- 🔍 **Indexing Monitor**: Track indexing status and URL inspection results
- 🏷️ **Content Groups**: Organize and analyze URL groups
- 📝 **Annotations**: Mark important events and track their impact
- 🌍 **GEO Tracking**: Monitor multi-location search visibility
- ⚡ **Performance**: 55x faster than before with Set-based filtering (3-4s load for 65k URLs)
- 🗄️ **Database-Backed**: PostgreSQL (Supabase) for scalability and reliability
- 🔄 **Auto-Sync**: Cron jobs sync data 3x daily automatically

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud project with OAuth 2.0 credentials
- Supabase account (free tier works)
- DataForSEO account (optional, for live rank checking)

### Local Development Setup

1. **Clone and install:**
```bash
git clone https://github.com/YOUR-USERNAME/gsc-tool.git
cd gsc-tool
npm install
```

2. **Setup environment variables:**
```bash
# Copy example file
copy env.example .env.local

# Edit .env.local and fill in your values
# See env.example for all required variables
```

3. **Initialize database:**
```bash
npx prisma generate
npx prisma db push
```

4. **Run development server:**
```bash
npm run dev
```

5. **Open** http://localhost:3000

## 📦 Deployment

### Quick Deploy (30 minutes)
→ See **[QUICK-DEPLOY.md](./QUICK-DEPLOY.md)** for step-by-step deployment to Vercel

### Full Documentation
→ See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for comprehensive deployment guide including:
- Vercel deployment
- Environment variables setup
- OAuth configuration
- Ongoing development workflow
- Troubleshooting
- Rollback procedures

### After Deployment (Ongoing Development)

```bash
# Make changes locally, then:
git add .
git commit -m "Description of changes"
git push

# ⚡ Vercel auto-deploys in 2-3 minutes!
```

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment & Git workflow guide
- **[QUICK-DEPLOY.md](./QUICK-DEPLOY.md)** - 30-minute quick start
- **[DIMENSIONFILTERGROUPS-IMPLEMENTATION.md](./DIMENSIONFILTERGROUPS-IMPLEMENTATION.md)** - URL detail optimization (56x more queries)
- **[RANK-TRACKER-AUTO-SYNC.md](./RANK-TRACKER-AUTO-SYNC.md)** - Auto-sync functionality
- **[DATABASE-MIGRATION-STATUS.md](./DATABASE-MIGRATION-STATUS.md)** - Migration progress tracker
- **[INDEXING-DATABASE.md](./INDEXING-DATABASE.md)** - Indexing tab documentation

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Recharts
- **Backend**: Next.js API Routes, Server-Side Rendering
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **APIs**: Google Search Console, Google Analytics 4, Gemini AI, DataForSEO
- **Cron Jobs**: Vercel Cron for automated data sync
- **Deployment**: Vercel (with automatic deployments from GitHub)

## 🎯 Performance Optimizations

- ✅ **Set-based filtering**: O(n) instead of O(n*m) for content groups
- ✅ **Pre-aggregation**: Query Counting aggregated in database
- ✅ **In-memory caching**: 5-minute TTL for frequently accessed data
- ✅ **Database caching**: 7-day TTL for GSC data
- ✅ **Chunked API calls**: Handles sites with >25k rows via recursive splitting
- ✅ **Parallel processing**: Multiple API calls executed simultaneously

**Result:** Dashboard loads in 3-4 seconds for sites with 65,000+ URLs!

## 🔐 Security

- ✅ Google OAuth 2.0 for authentication
- ✅ Session-based authorization
- ✅ Environment variables for all secrets
- ✅ Cron job authentication with `CRON_SECRET`
- ✅ No hardcoded credentials
- ✅ `.gitignore` prevents secret commits

## 📝 License

Private - All rights reserved

## 🙋 Support

For deployment questions, see:
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Full deployment guide
- **[QUICK-DEPLOY.md](./QUICK-DEPLOY.md)** - Quick start checklist
