# GEO Tracking Setup Guide

## Quick Start

GEO (Generative Engine Optimization) tracking er nu implementeret! 🎉

### Step 1: Install Dependencies

```bash
npm install @google/generative-ai
```

(Already done via package.json)

### Step 2: Add API Key to .env.local

Add this environment variable to your `.env.local` file:

```env
# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here
```

### Step 3: Get API Key

**Google Gemini:**
1. Go to: https://aistudio.google.com/apikey
2. Create new API key
3. Copy and paste into .env.local

**Why Gemini?**
- ✅ Built-in Google Search (real citations!)
- ✅ Cheaper than ChatGPT/Claude
- ✅ Better for Danish content
- ✅ Shows actual web sources used

### Step 4: Restart Server

```bash
# Stop the dev server (Ctrl+C)
# Start it again
npm run dev
```

### Step 5: Test it!

1. Go to the **GEO** tab in your dashboard
2. **First visit:** System automatically imports AND tests top 50 informational queries
3. Wait for auto-import to complete (takes ~1-2 minutes - testing all queries on Gemini with Google Search)
4. Your tracked queries appear with test results showing if omregne.dk is cited!
5. Click "Re-test" on any query to re-test it
6. Click "🔄 Test All Queries" button to re-test everything (recommended weekly)
7. Or manually test a new query in the "Test a Query" section

---

## Features

### ✅ What You Can Do:

1. **Test Individual Queries**
   - Enter any query
   - Test on Google Gemini with real-time Google Search
   - See actual web citations in 3-5 seconds

2. **Save Queries for Tracking**
   - Click "Save & Track" after testing
   - Query appears in tracked list
   - Re-test anytime

3. **Auto-Import & Auto-Test**
   - First visit: Top 50 informational queries auto-imported AND tested
   - All queries tested on Gemini with Google Search automatically
   - Click "+ Add More GSC Keywords" to import additional queries
   - System filters for question/tutorial/comparison queries

4. **Weekly Re-testing**
   - Click "🔄 Test All Queries" button to re-test everything
   - Recommended: Do this weekly to track changes over time
   - Shows citation rate trends (improving/declining)

5. **View Statistics**
   - Gemini citation rate (with real web search!)
   - Most cited competitors
   - Overall performance

---

## API Costs

**Gemini 1.5 Flash (with Google Search):**
- FREE tier: 15 requests per minute, 1500 per day
- After free tier: ~$0.0001 per request (essentially free)
- 100 tests = **FREE** or $0.01

**Monthly estimate (with weekly re-testing):** 
- 50 queries × 4 tests/month (weekly) = 200 tests
- **Cost: $0 (FREE!)** 🎉

**Important - Rate Limits:**
- Free tier: 15 requests/minute
- Initial testing of 50 queries takes ~3-4 minutes
- Weekly re-tests are faster (already imported)

**Why Gemini is Perfect:**
- ✅ Built-in Google Search = REAL citations with URLs!
- ✅ FREE tier works great
- ✅ Shows actual web sources used
- ✅ Better for Danish content

Much better results than ChatGPT/Claude APIs (which don't have web search)!

---

## Troubleshooting

### "Failed to test query" error

**Check:**
1. Is GEMINI_API_KEY set in .env.local?
2. Did you restart the server after adding key?
3. Is your Gemini API key valid? Test at: https://aistudio.google.com/

### "No citations found"

**This is normal!** Not every query will cite your website. This is valuable information - it shows you content gaps to fill.

### Import finds no queries

**Try:**
- Lower minimum impressions (default: 100)
- Extend date range (default: last 28 days)
- Make sure you have informational queries in GSC

---

## Next Steps (Optional Enhancements)

Want to make it even better? Consider adding:

1. **Automated Testing**
   - Cron job to re-test queries weekly
   - Email notifications when citation status changes

2. **More AI Engines**
   - Perplexity API
   - Google Gemini

3. **Advanced Analytics**
   - Trend charts over time
   - Competitor analysis dashboard

4. **Fan-Out Query Tracking**
   - See sub-queries AI engines generate
   - Track citations in fan-out results
   - (This is complex but extremely valuable!)

---

## Support

Questions or issues? The GEO tracking feature is self-contained:

**Files:**
- `app/dashboard/geo/page.tsx` - Main page
- `app/api/geo/*` - API endpoints
- `components/GEO*.tsx` - UI components
- `lib/geoTracking.ts` - Citation extraction
- `lib/geoStorage.ts` - Data storage
- `data/geo-tracking.json` - Stored data

Happy tracking! 🚀

