# GSC Tool - Komplet Funktionsguide

## Oversigt

GSC Tool er et avanceret dashboard til Google Search Console med integreret Google Analytics 4 og AI visibility tracking. Værktøjet giver dig dybdegående indsigt i din hjemmesides performance i både traditionel søgning og AI-genererede søgeresultater.

---

## 🏠 Tab 1: Dashboard

### Formål
Hovedoversigt over din hjemmesides search performance med nøglemetrics, trends og Analytics data.

### Funktioner

#### **Google Search Console Metrics**
- **Total Clicks:** Antal klik fra Google Search
- **Total Impressions:** Hvor mange gange din side vises i søgeresultater
- **Average CTR:** Click-through rate (klik/visninger)
- **Average Position:** Din gennemsnitlige placering i søgeresultater
- **Trend indicators:** Sammenlign med forrige periode (↑ forbedring, ↓ forværring)

#### **Time Series Chart**
- Visualisering af clicks og impressions over tid
- Vælg mellem daglig, ugentlig eller månedlig visning
- Zoom og pan funktionalitet
- Interaktiv chart med hover tooltips

#### **Query Counting Analysis**
- Identificer queries med **kun impressions (0 clicks)**
- Find queries med **kun 1 click** (optimization opportunities)
- Se hvilke queries der performer dårligt
- Klik for at dykke ned i specifik query data

#### **Content Group Filtering**
- Filtrer data baseret på URL-mønstre
- Se performance for specifikke sektioner af dit site
- Eksempel: `/blog/*`, `/produkter/*`, etc.

#### **Google Analytics 4 Integration (Hvis konfigureret)**
- **Organic Traffic Overview:**
  - Sessions fra alle organiske kilder
  - Aktive brugere
  - Bounce rate
  - Gennemsnitlig session duration
  
- **Source Breakdown Chart:**
  - Visualiser traffic fra Google, Bing, DuckDuckGo, etc.
  - Se hvilke søgemaskiner driver mest traffic
  - Sammenlign med kun-GSC data

**GA4 Auto-detection:**
- Systemet finder automatisk din GA4 property hvis:
  - Den er på samme Google konto
  - Website URL matcher Search Console property
  - Du har granted Analytics permissions ved login

---

## 📊 Tab 2: Indexing

### Formål
Overvåg Google's indexering af dine sider og identificer indexeringsproblemer.

### Funktioner

#### **Indexing Overview**
- **Total URLs:** Antal URLs fundet på dit site
- **Indexed:** Hvor mange sider Google har indexeret
- **Not Indexed:** Antal sider der ikke er indexeret
- **Issues:** Antal sider med problemer

#### **URL Discovery**
- Systemet finder URLs via:
  - Google Search Console (submitted URLs)
  - Sitemap URLs
  - Crawlede URLs
  - Manual submissions

#### **URL Inspection (Batch)**
- **Automatisk inspection:** Tjek indexeringsstatus for alle dine URLs
- **Rate limiting:** Smart batching for at undgå API errors
- **Streaming progress:** Real-time progress bar
- **Mini-batches:** Processerer 10 URLs ad gangen med delays

#### **Inspection Results**
- **Coverage Status:** Valid, Excluded, Error
- **Indexing State:** Indexed, Not indexed, Pending
- **Last Crawl Date:** Hvornår Google sidst besøgte siden
- **Crawl Errors:** Specifikke problemer fundet
- **Mobile Usability:** Mobile-friendly status

#### **Issue Categories**
- Soft 404 errors
- Duplicate content
- Noindex tags
- Robots.txt blocked
- Redirect chains
- Server errors (5xx)

#### **Actions**
- **Request Indexing:** Send re-indexing request til Google
- **View Details:** Se fuld inspection rapport
- **Export:** Download data som CSV

---

## 📝 Tab 3: Annotations

### Formål
Tilføj noter og markeringer til dit performance data for at tracke ændringer og events.

### Funktioner

#### **Annotation Management**
- **Tilføj annotations:** Marker specifikke datoer med noter
- **Use cases:**
  - "Launched new blog section"
  - "Updated meta descriptions"
  - "Algorithm update noticed"
  - "Seasonal campaign started"

#### **Annotation Display**
- Vis annotations direkte på time series charts
- Filter annotations by kategori
- Søg i annotations
- Edit/delete eksisterende annotations

#### **Data Correlation**
- Se om annotations korrelerer med performance ændringer
- Identificer hvilke ændringer der gav resultater
- Track before/after metrics

---

## 🎯 Tab 4: Optimize - Keyword Cannibalization

### Formål
Identificer keyword cannibalization issues hvor multiple URLs på dit site konkurrerer om samme query.

### Hvad er Keyword Cannibalization?
Når flere af dine egne sider ranker for samme keyword, kan de "kannibalisere" hinandens clicks. Google bliver forvirret over hvilken side der er mest relevant, og ingen af siderne ranker optimalt.

### Funktioner

#### **Cannibalization Detection**
Systemet finder automatisk queries hvor:
- 2+ URLs fra dit site ranker samtidigt
- URLs konkurrerer om samme impressions
- Samlet clicks kunne være højere hvis kun én URL rankede

#### **Impact Levels**
**High Impact (Rød):**
- 3+ URLs konkurrerer
- Høj position volatility
- Stor impressions volume

**Medium Impact (Orange):**
- 2 URLs konkurrerer
- Moderat volatility
- Medium impressions

**Low Impact (Blå):**
- Lav volatility
- Få impressions
- Mindre bekymring

#### **Detailed Analysis per Query**
For hver cannibalization issue:
- **Competing URLs:** Alle URLs der ranker for query
- **Position History:** Sparkline chart af position over tid
- **Stability Indicator:** ⚠️ hvis position er ustabil (std dev > 5)
- **Performance Metrics:** Clicks, impressions, CTR, position per URL

#### **How to Fix Cannibalization**
1. **Consolidate Content:** Merge multiple svage sider til én stærk side
2. **301 Redirects:** Redirect svagere URLs til main URL
3. **Internal Linking:** Link fra svagere til stærkere side
4. **Canonical Tags:** Set canonical til primary URL
5. **De-optimize:** Fjern keyword fra irrelevante sider

---

## 🤖 Tab 5: GEO (Generative Engine Optimization)

### Formål
Track hvor ofte din hjemmeside citeres i AI-genererede søgeresultater via Google Gemini med real-time Google Search grounding.

### Baggrund: Hvad er GEO?
**GEO (Generative Engine Optimization)** er optimering af content til at blive citeret i AI søgeresultater. Med stigende brug af AI search engines (Gemini, ChatGPT, Perplexity) er det kritisk at tracke din "AI visibility".

**Nuværende Implementation:**
- ✅ **Google Gemini 2.0 Flash** med Google Search grounding
- 🔜 ChatGPT, Claude, Perplexity (planlagt for fremtiden)

### Core Features

#### **1. Automatic Query Import**
- **Auto-import fra GSC:** Ved første besøg importeres automatisk top 200 informational queries
- **Intelligent filtering:** Kun informational queries importeres (spørgsmål, sammenligninger, guides)
- **Pattern detection:** Avanceret regex matcher Danish/English query patterns:
  - hvem, hvad, hvor, hvordan, kan, skal, må, bør
  - bedste, top, sammenlign, guide, test, anmeldelse
  - who, what, how, can, should, best, compare, review

#### **2. Gemini Testing med Google Search Grounding**
- **Model:** Gemini 2.0 Flash (stabil production model)
- **Grounding:** Real-time Google Search integration
- **Tier 1 API:** 2000 RPM rate limit (paid tier)
- **Free Tier:** 15 RPM også supporteret
- **Batch processing:** 30 queries ad gangen (Tier 1) med 2s delays
- **Completion time:** ~1-2 minutter for 99-200 queries
- **Cost:** ~$0.01-0.03 per 100 queries

#### **3. Citation Tracking - 3 Levels**

**Level 1: Visible Citation (Grøn)**
- Dit link vises synligt til brugeren i AI responsen
- Ekstrakter URLs fra response text
- Highest value - direkte traffic potentiale

**Level 2: Used as Source (Blå)**
- Din side bruges i Gemini's grounding metadata
- Ikke synligt til bruger, men påvirker AI's svar
- Indikerer authority i dit emne

**Level 3: Not Cited (Rød)**
- Din side findes ikke i response eller grounding
- Content gap - skab bedre content for denne query

#### **4. Query Fan-out Tracking** 🔥
**Hvad er Fan-out?**
Når du spørger Gemini "bedste barnevogn", laver den IKKE kun én søgning. Den "fan-outer" til flere sub-queries:

```
User query: "bedste barnevogn"

Gemini Fan-out:
→ "barnevogn test 2025"
→ "populære barnevogne 2025"
→ "bedste barnevogn 2025"
```

**Hvorfor det betyder noget:**
- Dit content skal ranke for BÅDE original query OG alle fan-outs
- Konkurrenter kan dominere specifikke fan-out queries
- Du kan optimere for fan-out patterns

**UI Display:**
```
bedste barnevogn
✗ Not Visible
5 sources found

🔍 Fan-out queries (3):
• barnevogn test 2025
• populære barnevogne 2025
• bedste barnevogn 2025
```

#### **5. Sources Found Tracking**
- **Sources Found:** Procentdel af queries hvor Gemini fandt NOGEN kilder
- **Avg Sources:** Gennemsnit antal kilder per query
- **0 sources = ⚠️:** Gemini lavede ikke web search eller fandt intet

#### **6. Competitor Analysis** 🏆

**Share of Voice Chart:**
Visualiser din citation share vs. top konkurrenter:
```
YOU (bedstesovn.dk)         ████████ 35 citations (38%)
1. sengespecialist.dk       ████ 10 citations (11%)
2. babyogmor.dk            ██ 7 citations (8%)
```

**Top Competitor Details:**
For hver top 3 konkurrent:
- Total citations
- Share of voice %
- Average visibility score
- Sample queries de dominerer

**You vs #1 Analysis:**
- Direct comparison med din største konkurrent
- Gap analysis
- Hvor mange flere citations de har
- Actionable insights

#### **7. Stats Dashboard**

**5 Key Metrics:**
1. **Tracked Queries:** Antal queries du tracker
2. **Visible Citation Rate:** % queries hvor du er synligt citeret
3. **Used as Source:** % hvor du er i grounding metadata
4. **Sources Found:** % queries hvor Gemini fandt kilder
5. **Fan-out Queries:** Gennemsnitligt antal sub-searches per query

#### **8. Query Testing**

**Manual Test:**
- Test enhver query manuelt
- Se resultat inden du gemmer
- Hurtig validering af optimization efforts

**Bulk Re-test:**
- "Re-test All" button
- Opdater alle queries på én gang
- Track changes over time

**Auto-refresh:**
- Data opdateres automatisk efter test
- Stats, competitors og queries synkroniseres

### Tekniske Detaljer

#### **API Integration**
- **Gemini 2.0 Flash** med Google Search grounding
- **Rate limits:** 2000 RPM (Tier 1)
- **Cost:** ~$0.01-0.03 per 100 queries
- **Response time:** 5-10 sekunder per query

#### **Data Storage**
- JSON-based file storage (`data/geo-tracking.json`)
- Write-lock mechanism forhindrer race conditions
- Atomic saves for data integrity

#### **Citation Extraction**
Multi-layer approach:
1. URL regex i response text
2. Domain mentions uden URLs
3. Grounding metadata parsing (webSources)
4. Title field extraction (faktiske domains)

#### **Domain Normalization**
Intelligent matching af variants:
- `https://bedstesovn.dk/` → `bedstesovn.dk`
- `http://www.bedstesovn.dk` → `bedstesovn.dk`
- `sc-domain:bedstesovn.dk` → `bedstesovn.dk`

### Use Cases

#### **Use Case 1: Discover AI Visibility**
Tjek om du overhovedet vises i AI-genererede svar for dine keywords.

#### **Use Case 2: Competitor Intelligence**
Se hvilke konkurrenter der dominerer AI citations i din niche.

#### **Use Case 3: Content Gap Analysis**
Find queries hvor konkurrenter citeres, men ikke dig. Skab bedre content for disse.

#### **Use Case 4: Fan-out Optimization**
Analyser hvilke sub-queries AI engines genererer og optimer for disse patterns.

#### **Use Case 5: Track Improvements**
Re-test over tid og se om dine content updates forbedrer AI visibility.

### Best Practices

1. **Start bredt:** Importer top 200 queries fra GSC
2. **Identificer patterns:** Se hvilke query-typer du performer bedst i
3. **Analyser fan-outs:** Forstå hvad AI engines faktisk søger efter
4. **Prioriter gaps:** Fokus på queries hvor konkurrenter dominerer
5. **Re-test månedligt:** Track forbedringer over tid

---

## ⚙️ Tab 6: Settings - Content Groups

### Formål
Opret og administrer Content Groups til at filtrere og analysere specifikke dele af dit website.

### Hvad er Content Groups?
Content Groups lader dig gruppere URLs baseret på patterns (f.eks. `/blog/*`, `/produkter/*`) så du kan se performance for specifikke sektioner af dit site.

### Funktioner

#### **Content Group Management**
- **Create Groups:** Definer nye content groups
- **Edit Groups:** Rediger eksisterende groups
- **Delete Groups:** Fjern groups du ikke bruger længere
- **Preview:** Se hvilke URLs der matcher før du gemmer

#### **Condition Builder**
**Inclusion Conditions (URLs der SKAL matches):**
- **Contains:** URL indeholder tekst (f.eks. `/blog/`)
- **Equals:** URL er nøjagtig lig med
- **Regex:** Avanceret pattern matching
- **Batch:** Match en liste af specifikke URLs

**Exclusion Conditions (URLs der IKKE skal matches):**
- **Doesn't Contain:** Ekskluder URLs med specifik tekst
- **Doesn't Equal:** Ekskluder specifik URL
- **Doesn't Match Regex:** Ekskluder baseret på regex
- **Doesn't Match Any:** Ekskluder liste af URLs

#### **Multiple Conditions**
- Kombiner flere inclusion/exclusion rules
- AND logic: Alle conditions skal matche
- Build komplekse filters

#### **Preview Functionality**
- **Live Preview:** Se antal matchende URLs
- **Sample URLs:** Se eksempler på matchende URLs
- **Total URL Count:** Hvor mange URLs i hele sitet
- **Match Percentage:** % af total URLs der matcher

#### **Use Cases**
1. **Blog Section:** `Contains: /blog/`
2. **Product Pages:** `Contains: /produkter/` + `Doesn't Contain: /kategori/`
3. **Landing Pages:** `Regex: ^/lp-`
4. **Specific Pages:** `Batch: list of URLs`

#### **Integration med Dashboard**
Content Groups vises som filter i:
- Dashboard tab (metrics per group)
- Time series charts
- Query counting analysis

---

## 🔑 Core Features Across All Tabs

### **1. OAuth Authentication**
- **Google OAuth 2.0** med OpenID Connect
- **Scopes:**
  - `webmasters.readonly` - Læse GSC data
  - `analytics.readonly` - Læse GA4 data
  - `email`, `profile` - Bruger info
- **Access tokens:** Automatisk refresh
- **Session management:** NextAuth.js

### **2. Multi-Property Support**
- Håndter multiple websites fra samme dashboard
- Property selector i top bar
- Persistent selection (query parameter)
- URL format support:
  - Domain properties: `https://example.com/`
  - Prefix properties: `sc-domain:example.com`

### **3. Date Range Selection**
- **Preset ranges:**
  - Last 7 days
  - Last 28 days
  - Last 3 months
  - Last 12 months
  - Custom range
- **Comparison modes:**
  - Previous period
  - Same period last year

### **4. Real-time Data Fetching**
- **Smart caching:** Reducer API calls
- **Progressive loading:** Show data as det kommer
- **Error handling:** Graceful fallbacks
- **Retry logic:** Automatic retry med exponential backoff

### **5. Responsive Design**
- Desktop-first, men fungerer på tablets
- Adaptive charts og tables
- Mobile-friendly når nødvendigt
- Grid layouts med breakpoints

---

## 📈 Data Flow Architecture

### **Data Sources**

1. **Google Search Console API:**
   - `webmasters_v3` - Legacy queries
   - `searchconsole_v1` - URL inspection
   - Rate limits: 1200 requests/minute

2. **Google Analytics 4 API:**
   - `analyticsdata_v1beta` - Rapporter
   - `analyticsadmin_v1beta` - Property management
   - Dimension filters for organic traffic

3. **Google Gemini API:**
   - SDK: `@google/generative-ai`
   - Model: `gemini-2.0-flash`
   - Grounding: `googleSearch` tool enabled
   - Free tier: 15 RPM
   - Tier 1 (paid): 2000 RPM

### **Data Processing Pipeline**

```
User selects property
↓
Fetch GSC data (with chunking for large datasets)
↓
Cache results (file-based or memory)
↓
Process & aggregate metrics
↓
Render charts & tables
↓
Auto-refresh on data changes
```

### **Storage Strategy**

**GSC & GA4 Data:**
- In-memory caching
- Short TTL (5-15 minutes)
- No persistent storage (privacy)

**GEO Tracking Data:**
- Persistent JSON file storage
- Location: `data/geo-tracking.json`
- Write-lock mechanism
- Atomic saves

**Annotations:**
- JSON file per site
- Location: `data/annotations/`
- User-owned data

---

## 🚀 Advanced Features

### **1. Query Counting with Chunking**
**Problem:** GSC API har 25,000 row limit per request

**Solution:** 
- Automatisk opdeling i chunks
- Recursive chunking hvis chunk rammer limit
- Caching af chunks
- Smart merging af resultater

### **2. URL Inspection Rate Limiting**
**Problem:** For mange concurrent requests = socket hang up

**Solution:**
- Mini-batches af 10 URLs
- 50ms delay mellem batches
- Graceful error handling
- Client disconnect detection
- Safe stream closing

### **3. GA4 Property Auto-detection**
**Matching strategies:**
1. **Website URL match:** Sammenlign GA4 websiteUrl med GSC siteUrl
2. **Domain extraction:** Parse og match base domains
3. **Property name fuzzy match:** Match property display name

### **4. GEO Write-Lock System**
**Problem:** Concurrent writes til JSON filer = race conditions

**Solution:**
- Promise-based write lock
- Sequential writes garanteret
- Fresh data reload før hver write
- Two-step process: Add → Test

### **5. Streaming Responses (SSE)**
**Indexing tab:**
- Server-Sent Events for progress
- Real-time updates
- Client disconnect handling
- Safe controller closing

---

## 🔧 Setup & Configuration

### **Initial Setup**

1. **Google Cloud Project:**
   - Opret projekt på https://console.cloud.google.com/
   - Enable APIs:
     - Google Search Console API
     - Google Analytics Data API
     - Google Analytics Admin API
   - Configure OAuth 2.0:
     - OAuth consent screen
     - Add authorized domains
     - Create OAuth Client ID (Web application)

2. **Environment Variables (.env.local):**
   ```env
   GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_secret
   NEXTAUTH_SECRET=generate_with_openssl_rand
   NEXTAUTH_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. **First Login:**
   - Klik "Sign in with Google"
   - Grant Search Console permission
   - Grant Analytics permission
   - Select your property fra liste
   - Dashboard loader automatisk data

### **GEO Tracking Setup**

1. **Get Gemini API Key:**
   - Visit https://aistudio.google.com/
   - Get API key
   - Add to `.env.local`

2. **Choose Tier:**
   - Free tier: 15 RPM
   - Tier 1 (paid): 2000 RPM ← Recommended
   - Adjust batch sizes accordingly

3. **First Import:**
   - Visit GEO tab
   - System auto-imports top 200 queries
   - Wait ~1 minute for initial test
   - Review results

---

## 📊 Key Metrics Explained

### **GSC Metrics**

**Clicks:**
- Antal gange brugere klikkede på dit site i search results
- Højere = bedre traffic

**Impressions:**
- Antal gange dit site vistes i search results (top 100)
- Højere = bedre visibility, men CTR også vigtig

**CTR (Click-Through Rate):**
- Clicks / Impressions × 100%
- Industry avg: 2-5%
- Higher is better - betyder attractive titles/descriptions

**Position:**
- Gennemsnitlig ranking position
- Lower number = better (1 = #1 position)
- Position 1-3 får ~60% af alle clicks

### **GA4 Metrics**

**Sessions:**
- Antal separate besøg på dit site
- Organiske sessions = fra søgemaskiner

**Active Users:**
- Unikke brugere der besøgte
- Deduplicated på tværs af sessions

**Bounce Rate:**
- % der forlader efter kun én side
- Lower is better (under 40% er godt)

**Avg Session Duration:**
- Hvor længe brugere bliver på sitet
- Higher = better engagement
- Industry avg: 2-4 minutter

### **GEO Metrics**

**Visible Citation Rate:**
- % af queries hvor dit link vises til brugeren
- Direct value metric
- Target: >10% er godt, >30% er excellent

**Used as Source:**
- % hvor du er i Gemini's grounding (selv hvis ikke synlig)
- Indikerer authority
- Target: Higher than visible citation

**Sources Found:**
- % hvor Gemini fandt NOGEN kilder
- Hvis lav = queries er ikke search-worthy
- Target: >80%

**Fan-out Queries:**
- Gennemsnit antal sub-searches Gemini laver
- Higher = mere komplekse queries
- Typical: 2-4 fan-outs per query

**Share of Voice:**
- Din % af total citations vs. konkurrenter
- Industry benchmark metric
- Target: Top 3 i din niche

---

## 🎯 Workflow Examples

### **Workflow 1: Weekly Performance Check**
1. Åbn **Dashboard** tab
2. Set date range til "Last 7 days" 
3. Compare med "Previous period"
4. Check for store ændringer (↑↓)
5. Hvis fald: Gå til **Indexing** tab og tjek for issues
6. Hvis stigning: Tilføj **annotation** om hvad du gjorde

### **Workflow 2: Fix Keyword Cannibalization**
1. Åbn **Optimize** tab
2. Set date range til minimum 28 dage
3. Se queries sorteret efter impact level
4. For HIGH impact issues:
   - Klik for at expand competing URLs
   - Analyser position history (se sparkline)
   - Identificer hvilken URL der er stærkest
   - Consolidate content til den stærkeste URL
   - 301 redirect de andre URLs
5. Re-check efter 2 uger

### **Workflow 3: Fix Indexing Issues**
1. Åbn **Indexing** tab
2. Klik "Inspect All URLs"
3. Vent på inspection at complete
4. Filter for "Errors" eller "Not Indexed"
5. For hver issue:
   - Læs error message
   - Fix problem (remove noindex, fix redirect, etc.)
   - Request indexing
6. Re-check efter 1 uge

### **Workflow 4: Boost AI Visibility**
1. Åbn **GEO** tab
2. Se **Competitor Analysis**
3. Identificer top konkurrent
4. Se "Sample queries they appear in"
5. For queries de dominerer:
   - Klik på query
   - Se fan-out patterns
   - Skriv comprehensive content der dækker ALL fan-outs
6. Re-test månedligt og track forbedringer

### **Workflow 5: Content Gap Discovery**
1. Åbn **GEO** tab
2. Scroll ned til **Tracked Queries**
3. Find queries med "✗ Not Visible" men HØJE sources found (8-12)
4. For disse queries:
   - Se hvilke **competitors** der citeres
   - Analyser DERES content
   - Skriv bedre, mere comprehensive content
   - Inkluder data, examples, visuals
5. Re-test efter content publish

---

## 💡 Pro Tips

### **Dashboard Tab:**
- Brug content groups til at isolere blog vs. product pages
- Track query counting for low-effort wins
- Set up GA4 for complete traffic picture

### **Indexing Tab:**
- Run inspection ugentligt for aktive sites
- Request re-indexing efter major updates
- Monitor "last crawl date" for vigtige sider

### **GEO Tab:**
- Start med top 200 queries - får bred coverage
- Fokus på queries med 3+ fan-outs (mest komplekse)
- Re-test månedligt, ikke dagligt (spild af API budget)
- Hvis "Used as Source" men ikke "Visible" = du er nær ved breakthrough
- Track competitor patterns og skriv content de mangler

### **Performance Optimization:**
- Brug date range filters til at reducere data load
- Clear cache hvis data ser forældet ud
- Refresh page efter major property changes

---

## 🐛 Troubleshooting

### **"No GA4 property detected"**
**Fix:**
1. Log ud og log ind igen
2. Sørg for du checker Analytics permission boksen
3. Verificer at GA4 property har website URL sat
4. Website URL skal matche GSC property

### **"Socket hang up" i Indexing tab**
**Fix:**
- Allerede håndteret med mini-batches
- Hvis det sker: Refresh og prøv igen
- Reducer batch size hvis persistent

### **GEO "0% citations" selv med sources**
**Forklaring:**
- Gemini fandt kilder, men ikke DIN side
- Dette er normalt - AI har preferences
- **Action:** Forbedre content quality, add data, visuals, examples

### **Fan-out = 0.0 selv efter import**
**Forklaring:**
- Gammel data har ikke searchQueries gemt
- **Fix:** Klik "Re-test All" for at opdatere

### **Competitor viser "YOU" twice**
**Fix:**
- Domain normalization er nu implementeret
- Refresh efter re-test
- Hvis persistent: Tjek console logs

---

## 📚 Technical Stack

### **Frontend:**
- **Framework:** Next.js 14 (App Router)
- **Auth:** NextAuth.js med Google Provider
- **State:** React hooks (useState, useEffect, useMemo)
- **Styling:** Inline styles (no CSS framework)
- **Charts:** Custom D3.js / Chart.js wrappers

### **Backend:**
- **Runtime:** Node.js
- **API:** Next.js API Routes (App Router)
- **Storage:** File-based JSON
- **APIs:**
  - googleapis (Search Console, Analytics)
  - @google/generative-ai (Gemini)

### **Data:**
- **Cache:** In-memory + file-based
- **Persistence:** JSON files in `data/` directory
- **Concurrency:** Promise-based locks
- **Streaming:** Server-Sent Events for long operations

---

## 🎓 Glossary

**GEO (Generative Engine Optimization):** Optimering til at blive citeret i AI-genererede svar

**Fan-out Queries:** Sub-queries AI engines genererer automatisk bag kulissen

**Grounding:** Når AI bruger web search til at hente real-time data

**Share of Voice:** Din procentdel af total citations i din niche

**Visibility Score:** 0-100 rating af hvor prominent du er i AI svar

**Citation:** Når din hjemmeside nævnes eller linkes til i AI response

**Source:** En hjemmeside som AI brugte til at generere svar

**Informational Query:** Spørgsmål-baseret query (hvad, hvordan, bedste, osv.)

**Content Group:** Gruppe af URLs med fælles mønster (f.eks. `/blog/*`)

**URL Inspection:** Google's detaljerede rapport om en specifik URL's indexing status

**CTR (Click-Through Rate):** Procentdel af impressions der resulterer i clicks

**Organic Traffic:** Besøgende fra søgemaskiner (ikke ads)

---

## 🚀 Future Roadmap

### **Planlagte Features:**

**Phase 1 (✅ Completed):**
- ✅ GSC integration (metrics, charts, queries)
- ✅ GA4 auto-detection og integration
- ✅ Gemini 2.0 Flash GEO tracking
- ✅ Competitor analysis med share of voice
- ✅ Fan-out query tracking
- ✅ URL Indexing inspection med streaming
- ✅ Keyword cannibalization detection
- ✅ Annotations med impact analysis
- ✅ Content Groups filtering

**Phase 2 (Planlagt - Q1 2026):**
- 📅 ChatGPT integration (with SearchGPT)
- 📅 Claude integration (with web search)
- 📅 Perplexity API integration
- 📅 Multi-engine comparison dashboard
- 📅 Historical GEO trend charts

**Phase 3 (Q2-Q3 2026):**
- 📅 Automated scheduled GEO testing (daily/weekly)
- 📅 Email notifications for major changes
- 📅 Automated weekly/monthly reports
- 📅 Content recommendations AI
- 📅 PostgreSQL migration for larger datasets

**Phase 4 (Q4 2026+):**
- 📅 Multi-user/team support
- 📅 White-label options
- 📅 API for third-party integrations
- 📅 Advanced predictive analytics

---

## 💰 Cost Breakdown

### **Google APIs (Free Tier):**
- **GSC API:** Gratis, ingen limits
- **GA4 API:** Gratis, ingen limits
- **OAuth:** Gratis

### **Gemini API:**

**Free Tier:**
- 15 RPM
- ~1000 requests/day
- **Cost:** $0/måned
- **Best for:** Testing, small sites

**Tier 1 (Paid):**
- 2000 RPM
- Unlimited requests
- **Cost:** ~$0.01 per 100 queries
- **Monthly:** $10-50 afhængig af brug
- **Best for:** Production, multiple sites

**Usage Examples:**
- 200 queries, test 1x/måned: ~$0.20/måned
- 200 queries, test 1x/uge: ~$1/måned
- 200 queries, test dagligt: ~$6/måned

### **Total Operating Cost:**
- Small site (1 property, monthly GEO tests): **$5-10/måned**
- Medium site (3 properties, weekly GEO tests): **$20-40/måned**
- Large operation (10+ properties, daily tests): **$100-200/måned**

**ROI:** Hvis GEO tracking hjælper dig vinde bare 1 extra client = 10-100x ROI 🚀

---

## 📞 Support & Resources

### **Google Documentation:**
- [Search Console API](https://developers.google.com/webmaster-tools/search-console-api-original)
- [Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Gemini API](https://ai.google.dev/gemini-api/docs)

### **Internal Docs:**
- `app/dashboard/Google-analytics.txt` - GA4 integration guide
- `app/dashboard/GEO-tracking.txt` - Full GEO requirements
- `app/dashboard/GEO-tracking-REALISTIC.txt` - MVP implementation plan
- `app/dashboard/geo/README.md` - GEO setup guide

### **Common Issues:**
- Check terminal logs for API errors
- Check browser console for frontend errors
- Verify OAuth scopes if API access denied
- Re-authenticate if 401 errors

---

## 🎉 Summary

GSC Tool er et **all-in-one SEO dashboard** der kombinerer:
- ✅ Traditional SEO (GSC + GA4)
- ✅ Modern AI visibility tracking (GEO)
- ✅ Competitor intelligence
- ✅ Actionable insights

**Perfect for:**
- SEO agencies tracking multiple clients
- Websites der vil optimere til AI search
- Content creators tracking performance
- Businesses monitoring organic growth

**Key Differentiator:**
Eneste tool der tracker **AI citation fan-out patterns** med real-time Google Search grounding! 🚀

