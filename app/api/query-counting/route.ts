import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface QueryCountingRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
}

// In-memory cache for Query Counting results
const memoryCache = new Map<string, { 
  data: any; 
  timestamp: number;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 [Query Counting Cache] Cleaned ${cleaned} expired entries`);
  }
}, 10 * 60 * 1000); // Every 10 minutes

/**
 * Get Query Counting data - ONLY reads from pre-aggregated table
 * Data is populated by Supabase cron job (runs 3x per day)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: QueryCountingRequest = await request.json();
    const { siteUrl, startDate, endDate } = body;

    if (!siteUrl || !startDate || !endDate) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Check in-memory cache first
    const cacheKey = `${siteUrl}:${startDate}:${endDate}`;
    const cached = memoryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`⚡ [Query Counting API] Memory cache HIT (instant!)`);
      return Response.json({ ...cached.data, fromMemoryCache: true });
    }
    
    console.log(`📊 [Query Counting API] Memory cache MISS, fetching from database...`);

    const site = await prisma.site.findUnique({ where: { siteUrl } });
    
    if (!site) {
      return Response.json({ 
        error: 'Site not found. Please wait for cron job to sync data.' 
      }, { status: 404 });
    }

    // Read pre-aggregated data (FAST!)
    const aggregates = await prisma.queryCountingAggregate.findMany({
      where: {
        siteId: site.id,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });

    if (aggregates.length === 0) {
      return Response.json({ 
        positionData: [],
        message: 'No data yet. Cron job will sync data 3x per day.',
        cached: false 
      });
    }

    const positionData = aggregates.map(agg => ({
      date: agg.date.toISOString().split('T')[0],
      position1to3: agg.position1to3,
      position4to10: agg.position4to10,
      position11to20: agg.position11to20,
      position21plus: agg.position21plus,
    }));

    console.log(`[Query Counting API] ✓ Returned ${aggregates.length} pre-aggregated days`);

    const responseData = { 
      positionData, 
      cached: true,
      lastUpdated: aggregates[aggregates.length - 1].updatedAt 
    };

    // Cache the result in memory
    memoryCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });

    return Response.json(responseData);
  } catch (error: any) {
    console.error('[Query Counting API] Error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch query counting data' },
      { status: 500 }
    );
  }
}

