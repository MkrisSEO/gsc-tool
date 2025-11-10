/**
 * DataForSEO API Integration
 * Documentation: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
 */

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || '';
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || '';
const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com/v3';

interface DataForSEORequest {
  keyword: string;
  locationCode?: number; // 2208 = Denmark
  languageCode?: string; // 'da' for Danish
  device?: 'desktop' | 'mobile';
  depth?: number; // How many results to fetch (max 700)
}

interface DataForSEOOrganicResult {
  type: string;
  rank_group: number;
  rank_absolute: number;
  position: 'left' | 'right';
  xpath: string;
  domain: string;
  title: string;
  url: string;
  breadcrumb?: string;
  is_image: boolean;
  is_video: boolean;
  is_featured_snippet: boolean;
  is_malicious: boolean;
  is_web_story: boolean;
  description?: string;
  pre_snippet?: string;
  extended_snippet?: string;
  amp_version: boolean;
  rating?: {
    rating_type: string;
    value: number;
    votes_count: number;
    rating_max: number;
  };
  highlighted?: string[];
  links?: any[];
  faq?: any;
  extended_people_also_search?: any[];
}

interface DataForSEOResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: {
      api: string;
      function: string;
      se: string;
      se_type: string;
      keyword: string;
      location_code: number;
      language_code: string;
      device: string;
      depth: number;
    };
    result: Array<{
      keyword: string;
      type: string;
      se_domain: string;
      location_code: number;
      language_code: string;
      check_url: string;
      datetime: string;
      spell: any;
      refinement_chips: any;
      item_types: string[];
      se_results_count: number;
      items_count: number;
      items: DataForSEOOrganicResult[];
    }>;
  }>;
}

/**
 * Check keyword position using DataForSEO SERP API
 */
export async function checkKeywordPosition(
  keyword: string,
  targetDomain: string,
  options: {
    locationCode?: number;
    languageCode?: string;
    device?: 'desktop' | 'mobile';
    depth?: number;
  } = {}
): Promise<{
  position: number | null;
  url: string | null;
  title: string | null;
  serpFeatures: any;
  cost: number;
}> {
  const {
    locationCode = 2208, // Denmark
    languageCode = 'da',
    device = 'desktop',
    depth = 100,
  } = options;

  try {
    console.log(`[DataForSEO] Checking "${keyword}" for ${targetDomain}`);

    const response = await fetch(`${DATAFORSEO_BASE_URL}/serp/google/organic/live/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          keyword,
          location_code: locationCode,
          language_code: languageCode,
          device,
          depth,
          calculate_rectangles: false, // Reduce cost
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
    }

    const data: DataForSEOResponse = await response.json();

    if (data.tasks.length === 0 || !data.tasks[0].result || data.tasks[0].result.length === 0) {
      console.log(`[DataForSEO] No results for "${keyword}"`);
      return {
        position: null,
        url: null,
        title: null,
        serpFeatures: null,
        cost: data.cost || 0,
      };
    }

    const task = data.tasks[0];
    const result = task.result[0];
    const items = result.items || [];

    // Find target domain in results
    const normalizedDomain = targetDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
    
    let foundPosition: number | null = null;
    let foundUrl: string | null = null;
    let foundTitle: string | null = null;

    console.log(`[DataForSEO] Searching for domain "${normalizedDomain}" in ${items.length} results`);

    for (const item of items) {
      if (item.type === 'organic') {
        const itemDomain = item.domain.replace(/^www\./i, '');
        
        console.log(`  - Position #${item.rank_absolute}: ${itemDomain} (${item.url})`);
        
        if (itemDomain.includes(normalizedDomain) || normalizedDomain.includes(itemDomain)) {
          foundPosition = item.rank_absolute;
          foundUrl = item.url;
          foundTitle = item.title;
          console.log(`  ✓ FOUND at position #${foundPosition}`);
          break;
        }
      }
    }

    if (!foundPosition) {
      console.log(`[DataForSEO] ⚠️ "${normalizedDomain}" not found in top ${depth} results`);
    }

    // Extract SERP features
    const serpFeatures = {
      featuredSnippet: items.some((i) => i.is_featured_snippet),
      peopleAlsoAsk: items.some((i) => i.type === 'people_also_ask'),
      relatedSearches: items.some((i) => i.type === 'related_searches'),
      videos: items.some((i) => i.is_video),
      images: items.some((i) => i.is_image),
      topStories: items.some((i) => i.type === 'top_stories'),
    };

    console.log(`[DataForSEO] ✓ ${keyword}: Position ${foundPosition || 'not found'} (Cost: $${task.cost.toFixed(4)})`);

    return {
      position: foundPosition,
      url: foundUrl,
      title: foundTitle,
      serpFeatures,
      cost: task.cost,
    };
  } catch (error: any) {
    console.error(`[DataForSEO] Error checking "${keyword}":`, error.message);
    throw error;
  }
}

/**
 * Batch check multiple keywords
 */
export async function checkMultipleKeywords(
  keywords: string[],
  targetDomain: string,
  options: {
    locationCode?: number;
    languageCode?: string;
    device?: 'desktop' | 'mobile';
  } = {}
): Promise<Map<string, any>> {
  const results = new Map();

  // DataForSEO allows up to 100 tasks per request
  const BATCH_SIZE = 20; // Keep it conservative

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    
    console.log(`[DataForSEO] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} keywords`);

    const batchResults = await Promise.all(
      batch.map(async (keyword) => {
        try {
          const result = await checkKeywordPosition(keyword, targetDomain, options);
          return { keyword, result };
        } catch (error) {
          console.error(`[DataForSEO] Failed for "${keyword}":`, error);
          return { keyword, result: null };
        }
      })
    );

    batchResults.forEach(({ keyword, result }) => {
      results.set(keyword, result);
    });

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < keywords.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get cost estimate for checking keywords
 */
export function estimateCost(keywordCount: number, checksPerMonth: number = 4): number {
  const costPerCheck = 0.0005; // $0.0005 per SERP check
  return keywordCount * checksPerMonth * costPerCheck;
}

