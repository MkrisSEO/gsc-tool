import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addQuery, saveTestResult } from '@/lib/geoStorageDb';
import { extractCitations, calculateVisibilityScore } from '@/lib/geoTracking';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ Increase timeout for importing and testing multiple queries
export const maxDuration = 300; // 5 minutes for large imports
export const dynamic = 'force-dynamic';

/**
 * Import queries and immediately test them all
 * This is used for auto-import on first visit
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteUrl, queries } = await request.json();

    if (!siteUrl || !queries) {
      return Response.json(
        { error: 'siteUrl and queries are required' },
        { status: 400 }
      );
    }

    // Normalize user domain
    const userDomain = siteUrl
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/^sc-domain:/, '')
      .replace(/\/$/, '')
      .toLowerCase();
    
    console.log(`[GEO Import & Test] Processing ${queries.length} queries on Gemini`);
    console.log(`[GEO Import & Test] User domain (normalized):`, userDomain);

    // STEP 1: Add all queries to tracking FIRST (sequentially to avoid race conditions)
    console.log(`[GEO Import & Test] Step 1: Adding all ${queries.length} queries to tracking...`);
    const savedQueries = [];
    for (const queryData of queries) {
      try {
        const savedQuery = await addQuery(siteUrl, queryData.query, 1);
        savedQueries.push(savedQuery);
      } catch (error: any) {
        console.error(`Failed to add query "${queryData.query}":`, error.message);
      }
    }
    console.log(`[GEO Import & Test] Step 1 complete: ${savedQueries.length} queries added`);

    // STEP 2: Test all queries on Gemini in parallel batches
    console.log(`[GEO Import & Test] Step 2: Testing all queries on Gemini...`);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    let processed = 0;
    const BATCH_SIZE = 30; // Tier 1 with gemini-2.0-flash = 2000 RPM!

    for (let i = 0; i < savedQueries.length; i += BATCH_SIZE) {
      const batch = savedQueries.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (savedQuery) => {
          try {
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.0-flash',
            });

            const tools = [{ googleSearch: {} }] as any;

            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: savedQuery.query }] }],
              tools: tools,
            } as any);
            const response = result.response;
            const responseText = response.text();
            
            const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
            const groundingChunks = groundingMetadata?.groundingChunks || [];
            const webSources = groundingChunks
              .filter((chunk: any) => chunk.web)
              .map((chunk: any) => ({
                url: chunk.web.uri,
                title: chunk.web.title,
              }));
            
            const totalSourcesFound = webSources.length;

            const citations = extractCitations(responseText, userDomain, webSources);
            
            // Check if user domain is in grounding sources (used as source, but not necessarily visible)
            const userInGrounding = webSources.some((source: any) => {
              try {
                // Use title field as it contains the actual domain
                const domain = (source.title || '').replace(/^www\./, '').toLowerCase();
                return domain === userDomain || domain.endsWith('.' + userDomain);
              } catch {
                return false;
              }
            });

            citations.usedAsSource = userInGrounding;

            // Extract search queries from grounding metadata
            const webSearchQueries = groundingMetadata?.webSearchQueries || [];

            await saveTestResult({
              queryId: savedQuery.id,
              engine: 'gemini',
              responseText,
              cited: citations.cited, // Visible citation
              usedAsSource: citations.usedAsSource, // Used in grounding
              citationCount: citations.citationCount,
              visibilityScore: calculateVisibilityScore(citations),
              competitors: citations.competitors,
              sourcesFound: totalSourcesFound, // Total web sources found
              searchQueries: webSearchQueries, // Fan-out queries
            });

            processed++;
            console.log(`[GEO Import & Test] Progress: ${processed}/${savedQueries.length}`);
          } catch (error: any) {
            console.error(`Gemini test failed for "${savedQuery.query}":`, error.message);
          }
        })
      );

      // Minimal delay for Tier 1 (2000 RPM = 33 requests per second!)
      if (i + BATCH_SIZE < savedQueries.length) {
        const remainingBatches = Math.ceil((savedQueries.length - i - BATCH_SIZE) / BATCH_SIZE);
        console.log(`[GEO Import & Test] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. ${remainingBatches} batches remaining. Waiting 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[GEO Import & Test] Completed: ${processed}/${queries.length} queries processed`);

    return Response.json({
      success: true,
      processed,
      total: queries.length,
    });
  } catch (error: any) {
    console.error('[GEO Import & Test] Error:', error);
    return Response.json(
      { error: 'Failed to import and test queries', details: error.message },
      { status: 500 }
    );
  }
}

