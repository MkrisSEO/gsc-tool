import prisma from './prisma';

export interface RankKeywordData {
  keyword: string;
  targetUrl?: string;
  tags?: string[];
}

export interface RankHistoryData {
  date: string; // YYYY-MM-DD
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

/**
 * Add a new keyword to track
 */
export async function addKeyword(
  siteUrl: string,
  keywordData: RankKeywordData
): Promise<any> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  return await prisma.rankKeyword.create({
    data: {
      siteId: site.id,
      keyword: keywordData.keyword,
      targetUrl: keywordData.targetUrl,
      tags: keywordData.tags || [],
    },
  });
}

/**
 * Add multiple keywords at once
 */
export async function addKeywords(
  siteUrl: string,
  keywordsData: RankKeywordData[]
): Promise<any[]> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  const results = await Promise.all(
    keywordsData.map((keywordData) =>
      prisma.rankKeyword.upsert({
        where: {
          siteId_keyword: {
            siteId: site.id,
            keyword: keywordData.keyword,
          },
        },
        create: {
          siteId: site.id,
          keyword: keywordData.keyword,
          targetUrl: keywordData.targetUrl,
          tags: keywordData.tags || [],
        },
        update: {
          targetUrl: keywordData.targetUrl,
          tags: keywordData.tags || [],
          active: true,
        },
      })
    )
  );

  return results;
}

/**
 * Get all keywords for a site with history and change calculations
 */
export async function getKeywords(
  siteUrl: string,
  activeOnly: boolean = true,
  includeHistory: boolean = true,
  historyDays: number = 90
): Promise<any[]> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - historyDays);

  const keywords = await prisma.rankKeyword.findMany({
    where: {
      siteId: site.id,
      ...(activeOnly && { active: true }),
    },
    ...(includeHistory && {
      include: {
        history: {
          where: {
            date: {
              gte: startDate,
            },
          },
          orderBy: {
            date: 'desc',
          },
          take: historyDays,
        },
      },
    }),
    orderBy: [
      { updatedAt: 'desc' },
    ],
  });

  // Calculate changes for each keyword
  return keywords.map((kw) => {
    if (!kw.history || kw.history.length === 0) {
      return { ...kw, change7d: null, change30d: null };
    }

    // ✅ Use ONLY GSC data for change calculation (ignore DataForSEO)
    // Filter to only records with real GSC data (position < 900)
    const gscRecords = kw.history.filter(h => h.position < 900);
    
    if (gscRecords.length === 0) {
      return { ...kw, change7d: null, change30d: null };
    }
    
    // Find position from 2 days ago (account for GSC lag)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const latestGscRecord = gscRecords.find(
      (h) => new Date(h.date) <= twoDaysAgo
    );
    
    if (!latestGscRecord) {
      return { ...kw, change7d: null, change30d: null };
    }
    
    const latestPosition = latestGscRecord.position;
    
    // Find position 7 days before latest (so 9 days ago from today)
    const nineDaysAgo = new Date();
    nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);  // 2 + 7 = 9 days
    const history7d = gscRecords.find(
      (h) => new Date(h.date) <= nineDaysAgo
    );
    
    // Find position 30 days before latest (so 32 days ago from today)
    const thirtyTwoDaysAgo = new Date();
    thirtyTwoDaysAgo.setDate(thirtyTwoDaysAgo.getDate() - 32);  // 2 + 30 = 32 days
    const history30d = gscRecords.find(
      (h) => new Date(h.date) <= thirtyTwoDaysAgo
    );

    const position7d = history7d ? history7d.position : null;
    const position30d = history30d ? history30d.position : null;

    return {
      ...kw,
      change7d: position7d ? position7d - latestPosition : null,
      change30d: position30d ? position30d - latestPosition : null,
    };
  });
}

/**
 * Get a single keyword with its history
 */
export async function getKeywordWithHistory(
  siteUrl: string,
  keyword: string,
  days: number = 90
): Promise<any | null> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    return null;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await prisma.rankKeyword.findUnique({
    where: {
      siteId_keyword: {
        siteId: site.id,
        keyword,
      },
    },
    include: {
      history: {
        where: {
          date: {
            gte: startDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      },
    },
  });
}

/**
 * Update a keyword
 */
export async function updateKeyword(
  siteUrl: string,
  keyword: string,
  updates: Partial<RankKeywordData>
): Promise<any> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  return await prisma.rankKeyword.update({
    where: {
      siteId_keyword: {
        siteId: site.id,
        keyword,
      },
    },
    data: updates,
  });
}

/**
 * Delete a keyword (soft delete by setting active = false)
 */
export async function deleteKeyword(
  siteUrl: string,
  keyword: string
): Promise<any> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  return await prisma.rankKeyword.update({
    where: {
      siteId_keyword: {
        siteId: site.id,
        keyword,
      },
    },
    data: {
      active: false,
    },
  });
}

/**
 * Save rank history for a keyword
 */
export async function saveRankHistory(
  siteUrl: string,
  keyword: string,
  historyData: RankHistoryData[]
): Promise<void> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    throw new Error('Site not found');
  }

  const rankKeyword = await prisma.rankKeyword.findUnique({
    where: {
      siteId_keyword: {
        siteId: site.id,
        keyword,
      },
    },
  });

  if (!rankKeyword) {
    throw new Error('Keyword not found');
  }

  await Promise.all(
    historyData.map((data) =>
      prisma.rankHistory.upsert({
        where: {
          keywordId_date: {
            keywordId: rankKeyword.id,
            date: new Date(data.date),
          },
        },
        create: {
          siteId: site.id,
          keywordId: rankKeyword.id,
          date: new Date(data.date),
          position: data.position,
          clicks: data.clicks,
          impressions: data.impressions,
          ctr: data.ctr,
        },
        update: {
          position: data.position,
          clicks: data.clicks,
          impressions: data.impressions,
          ctr: data.ctr,
          fetchedAt: new Date(),
        },
      })
    )
  );
}

/**
 * Get rank history for all keywords
 */
export async function getRankHistory(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    return [];
  }

  return await prisma.rankHistory.findMany({
    where: {
      siteId: site.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: {
      keyword: true,
    },
    orderBy: [
      { date: 'asc' },
      { position: 'asc' },
    ],
  });
}

/**
 * Get overview statistics for rank tracking
 */
export async function getRankOverview(
  siteUrl: string,
  days: number = 30
): Promise<{
  totalKeywords: number;
  avgPosition: number;
  top3: number;
  top10: number;
  positionDistribution: {
    top3: number;
    top10: number;
    top20: number;
    top50: number;
    beyond50: number;
  };
}> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
  });

  if (!site) {
    return {
      totalKeywords: 0,
      avgPosition: 0,
      top3: 0,
      top10: 0,
      positionDistribution: {
        top3: 0,
        top10: 0,
        top20: 0,
        top50: 0,
        beyond50: 0,
      },
    };
  }

  // Get latest position for each keyword
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const keywords = await prisma.rankKeyword.findMany({
    where: {
      siteId: site.id,
      active: true,
    },
    include: {
      history: {
        orderBy: {
          date: 'desc',
        },
        take: 1,
      },
    },
  });

  const keywordsWithPosition = keywords.filter(k => k.history.length > 0);
  const totalKeywords = keywordsWithPosition.length;

  if (totalKeywords === 0) {
    return {
      totalKeywords: 0,
      avgPosition: 0,
      top3: 0,
      top10: 0,
      positionDistribution: {
        top3: 0,
        top10: 0,
        top20: 0,
        top50: 0,
        beyond50: 0,
      },
    };
  }

  // Use DataForSEO position if available and recent, otherwise use GSC position
  const positions = keywordsWithPosition.map(k => {
    const latest = k.history[0];
    
    // Prefer DataForSEO if available and checked recently (within 7 days)
    if (latest.dfPosition && latest.dfLastChecked) {
      const daysSinceCheck = (Date.now() - new Date(latest.dfLastChecked).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCheck <= 7) {
        return latest.dfPosition;
      }
    }
    
    // Fallback to GSC position (but ignore default 999 value)
    return latest.position < 900 ? latest.position : latest.dfPosition || latest.position;
  }).filter(pos => pos < 900); // ✅ Filter out 999 default values completely

  const avgPosition = positions.length > 0 
    ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length 
    : 0;

  const top3 = positions.filter(p => p <= 3).length;
  const top10 = positions.filter(p => p <= 10).length;

  const positionDistribution = {
    top3: positions.filter(p => p <= 3).length,
    top10: positions.filter(p => p > 3 && p <= 10).length,
    top20: positions.filter(p => p > 10 && p <= 20).length,
    top50: positions.filter(p => p > 20 && p <= 50).length,
    beyond50: positions.filter(p => p > 50).length,
  };

  return {
    totalKeywords,
    avgPosition: Math.round(avgPosition * 10) / 10,
    top3,
    top10,
    positionDistribution,
  };
}

