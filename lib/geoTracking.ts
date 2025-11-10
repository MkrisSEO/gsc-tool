/**
 * GEO Tracking - Citation Extraction and Scoring
 */

export interface CitationResult {
  cited: boolean; // Visible in response text
  citationCount: number;
  competitors: string[];
  totalCitations: number;
  urls: Array<{ url: string; domain: string }>;
  usedAsSource?: boolean; // Found in grounding metadata (Gemini used it internally)
}

const EXCLUDED_DOMAINS = [
  'wikipedia.org',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'quora.com',
  'github.com',
];

/**
 * Extracts citations from AI response text AND grounding metadata
 */
export function extractCitations(
  responseText: string, 
  userDomain: string,
  webSources?: Array<{ url: string; title?: string }>
): CitationResult {
  const allDomains: string[] = [];
  const urls: Array<{ url: string; domain: string }> = [];
  let userCitationCount = 0;
  
  // Normalize user domain (remove protocol, www, sc-domain:, trailing slash)
  const normalizedUserDomain = userDomain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/^sc-domain:/, '')
    .replace(/\/$/, '')
    .toLowerCase();
  
  // Extract all URLs from response TEXT
  const urlRegex = /https?:\/\/[^\s<>"'\)]+/g;
  const foundUrls = responseText.match(urlRegex) || [];
  
  foundUrls.forEach(url => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      allDomains.push(domain);
      urls.push({ url, domain });
      
      if (domain === normalizedUserDomain || domain.endsWith('.' + normalizedUserDomain)) {
        userCitationCount++;
      }
    } catch (e) {
      // Invalid URL, skip
    }
  });
  
  // ALSO extract from webSources (Gemini grounding metadata)
  // NOTE: Gemini stores the actual domain in 'title' field, not in the proxy URL
  if (webSources && webSources.length > 0) {
    webSources.forEach(source => {
      try {
        // Use title as domain (Gemini stores actual domain here, not in URL)
        const domain = (source.title || '').replace(/^www\./, '').toLowerCase();
        
        // Only add if domain is valid and not already found
        if (domain && !allDomains.includes(domain)) {
          allDomains.push(domain);
          urls.push({ url: source.url, domain }); // Keep proxy URL but use real domain
        }
        
        // Check if this is user's domain
        if (domain === normalizedUserDomain || domain.endsWith('.' + normalizedUserDomain)) {
          userCitationCount++;
        }
      } catch (e) {
        // Skip invalid
      }
    });
  }
  
  // Also check for domain mentions without full URL
  // e.g., "according to omregne.dk" or "source: omregne.dk"
  const domainPattern = normalizedUserDomain.replace(/\./g, '\\.');
  const domainRegex = new RegExp(`\\b${domainPattern}\\b`, 'gi');
  const domainMentions = (responseText.match(domainRegex) || []).length;
  
  // Add mentions that aren't already counted as URLs
  const additionalMentions = Math.max(0, domainMentions - userCitationCount);
  userCitationCount += additionalMentions;
  
  // Get unique competitor domains (exclude common sites and user domain)
  const uniqueDomains = [...new Set(allDomains)];
  const competitors = uniqueDomains
    .filter(d => {
      const isUser = d === normalizedUserDomain || d.endsWith('.' + normalizedUserDomain);
      const isExcluded = EXCLUDED_DOMAINS.some(excluded => d === excluded || d.endsWith('.' + excluded));
      return !isUser && !isExcluded;
    })
    .slice(0, 10); // Limit to top 10 competitors
  
  return {
    cited: userCitationCount > 0,
    citationCount: userCitationCount,
    competitors,
    totalCitations: allDomains.length,
    urls,
  };
}

/**
 * Calculate visibility score based on citations
 */
export function calculateVisibilityScore(citations: CitationResult): number {
  if (!citations.cited) return 0;
  
  // Base score for being cited
  let score = 50;
  
  // Add 25 points per citation (max 50 additional)
  score += Math.min(50, citations.citationCount * 25);
  
  // Cap at 100
  return Math.min(100, score);
}

/**
 * Extract query type from query text (Comprehensive multi-language patterns)
 * Uses extensive keyword matching to identify informational queries
 */
export function detectQueryType(query: string): string {
  const q = query.toLowerCase();
  
  // Comprehensive informational query pattern (Danish + some English)
  const informationalPattern = /\b(hv(?:em|ad|ordan|orfor|ornår|or|ilke[tn]?)|køb(?:e[r]?)?|bestil(?:le[r]?)?|pris(?:er)?|tilbud|kost(?:er|ning(?:er)?)|betaling|betale|beløb|gebyr|bedst(?:e)?|top|billigst(?:e)?|størst(?:e)?|sammenlign(?:ing)?|versus|vs|kontra|forskel(?:lig(?:e)?)?|anmeldelse[r]?|review[s]?|test|erfaring(?:er)?|guide|vejledning|råd|tips|tricks|kan|kunne|skal|skulle|må|burde|bør|vil|ville|mest|mindre|værst|dyreste?|alternativ(?:er)?|nær(?:meste?)?|københavn|aarhus|odense|aalborg|danmark|dansk(?:e)?|adresse|åbningstid(?:er)?|kontakt|gratis|rabat|udsalg|deal|spar(?:e)?|levering|fragt|retur|garanti|forsikring|download|hent|få|problem(?:er)?|fejl|hjælp|løsning|fix|reparer(?:e)?|anbefal(?:er|ing(?:er)?|et)?|god(?:e|t)?|bedre|dårlig(?:e)?|kvalitet|populær(?:e|t)?|favorit(?:ter)?|vælg(?:e[r]?)?|valg|udvælge|liste|oversigt|katalog|udvalg|sortiment|muligheder|typer|slags|varianter|fås|findes|skaffe|lager|tilgængelig|trin|skridt|fremgangsmåde|metode|tutorial|instruktion|manual|lokal(?:e|t)?|mærke[r]?|brand[s]?|producent|eksempel(?:er)?|case[s]?)\b/i;
  
  if (informationalPattern.test(q)) {
    // Categorize based on specific keywords
    if (/\b(hv(?:em|ad|ornår|or|ilke[tn]?))\b/i.test(q)) {
      return 'question';
    }
    if (/\b(bedst(?:e)?|top|sammenlign(?:ing)?|versus|vs|kontra|forskel(?:lig(?:e)?)?|alternativ(?:er)?)\b/i.test(q)) {
      return 'comparison';
    }
    if (/\b(guide|vejledning|tutorial|hvordan|trin|skridt|fremgangsmåde|metode|instruktion)\b/i.test(q)) {
      return 'tutorial';
    }
    if (/\b(anbefal(?:er|ing(?:er)?|et)?|god(?:e|t)?|bedre|populær(?:e|t)?|favorit(?:ter)?)\b/i.test(q)) {
      return 'recommendation';
    }
    if (/\b(hvad er|definer|betydning|forklar)\b/i.test(q)) {
      return 'definition';
    }
    
    // Default to question for other informational patterns
    return 'question';
  }
  
  return 'other';
}

/**
 * Check if query is informational (good for GEO tracking)
 */
export function isInformationalQuery(query: string): boolean {
  const type = detectQueryType(query);
  return type !== 'other';
}

