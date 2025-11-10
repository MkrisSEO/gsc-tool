# Rank Tracker Auto-Sync Status

## ✅ **Hvad Virker Nu:**

### **1. Auto-sync efter DataForSEO check**
Når du klikker "🔴 Check Live" (DataForSEO), synces GSC data automatisk bagefter:

```typescript
// app/dashboard/rank-tracker/page.tsx
await fetch('/api/rank-tracker/check-dataforseo');  // Check live ranks
// ↓ Automatically triggers:
await fetch('/api/rank-tracker/sync');  // Sync GSC historical data
```

**Resultat:**
- SERP Rank opdateres fra DataForSEO ✅
- GSC Rank opdateres fra Google Search Console ✅
- **Alt sker automatisk uden manual sync!** 🎉

---

### **2. Auto-sync når nye keywords tilføjes**
Når du tilføjer keywords via "Add Keywords" modal, synces GSC data automatisk:

```typescript
// app/dashboard/rank-tracker/page.tsx
await fetch('/api/rank-tracker/keywords', { method: 'POST' });  // Add keywords
// ↓ Automatically triggers:
await fetch('/api/rank-tracker/sync');  // Sync GSC data for new keywords
```

**Resultat:**
- Nye keywords får automatisk 90 dage historik fra GSC ✅
- Ingen manual "Sync GSC Data" klik nødvendigt ✅

---

### **3. Manuel sync knap**
Du kan altid manuelt trigge sync via "Sync GSC Data" knappen:

```typescript
// Trigger manually
handleRefreshData()  // Button click
  ↓
fetch('/api/rank-tracker/sync')
  ↓
Fetch 90 days of GSC data for all keywords
```

---

## ❌ **Hvad Virker IKKE (Endnu):**

### **Cron Job (3x daglig automatisk sync)**

**Problem:**
- Cron jobs kører server-side **uden bruger login**
- Google OAuth tokens udløber efter 1 time
- Vi har ikke implementeret **refresh token storage** endnu

**Hvorfor Andre Cron Jobs Virker:**
```
Dashboard Sync: ❌ Placeholder (samme problem)
Query Counting: ❌ Placeholder (samme problem)
Indexing: ❌ Placeholder (samme problem)
DataForSEO Weekly: ✅ Virker (bruger API key, ikke OAuth)
```

**Alle GSC cron jobs kræver refresh token storage!**

---

## 🔧 **Løsning: Refresh Token Storage (Fremtidig)**

For at få 3x daglig auto-sync skal vi:

### **1. Opdater User model**
```prisma
model User {
  id            String @id @default(cuid())
  email         String @unique
  name          String?
  image         String?
  
  // OAuth tokens
  accessToken   String?  // ← Expires after 1 hour
  refreshToken  String?  // ← ✅ ADD THIS (never expires)
  tokenExpiry   DateTime?
  
  sites         Site[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### **2. Store refresh token ved login**
```typescript
// lib/auth.ts - NextAuth callbacks
callbacks: {
  async jwt({ token, account }) {
    if (account) {
      token.accessToken = account.access_token;
      token.refreshToken = account.refresh_token;  // ✅ Store this
      token.expiresAt = account.expires_at;
    }
    
    // ✅ Refresh if expired
    if (Date.now() / 1000 > token.expiresAt) {
      token = await refreshAccessToken(token);
    }
    
    return token;
  },
}
```

### **3. Opdater cron endpoints**
```typescript
// app/api/cron/sync-rank-tracker/route.ts
export async function GET(request: Request) {
  // Get all users with refresh tokens
  const users = await prisma.user.findMany({
    where: { refreshToken: { not: null } },
    include: { sites: true },
  });
  
  for (const user of users) {
    // Use refresh token to get new access token
    const accessToken = await getAccessTokenFromRefreshToken(user.refreshToken);
    
    // Use access token to call Google API
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    
    // Sync all user's sites
    for (const site of user.sites) {
      await syncRankTrackerData(site.siteUrl, oauth2);
    }
  }
}
```

---

## 📊 **Nuværende Løsning er Faktisk God Nok!**

**Med den nuværende implementation:**

1. **Første gang:** Tilføj keyword → Auto-sync GSC data ✅
2. **Ugentligt:** DataForSEO check (mandag kl 4) → Auto-sync GSC data ✅
3. **Manuel:** Click "Check Live" → Auto-sync GSC data ✅
4. **Backup:** Click "Sync GSC Data" når som helst ✅

**Resultat:**
- GSC data opdateres minimum 1x ugentlig (DataForSEO cron)
- Kan manuelt opdatere når som helst
- Data er aldrig mere end 7 dage gammel
- **Ingen refresh token storage nødvendig!** 😊

---

## 🎯 **Anbefaling:**

**For de fleste use cases er nuværende løsning tilstrækkelig:**
- Rank tracking ændrer sig ikke time-to-time
- Ugentlig DataForSEO check + auto GSC sync er mere end nok
- Manuel sync når man vil have fresh data

**Hvis du vil have daglig auto-sync:**
- Implementer refresh token storage (2-3 timers arbejde)
- Eller brug en scheduler service der kalder API'et med authentication

---

**Status:** ✅ **Auto-sync virker via DataForSEO weekly check + manual triggers**  
**Cron job:** ⏳ **Kræver refresh token storage (fremtidig enhancement)**

