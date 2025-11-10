import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQueries, saveTestResult } from '@/lib/geoStorageDb';
import { extractCitations, calculateVisibilityScore } from '@/lib/geoTracking';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ Increase timeout for testing multiple queries
export const maxDuration = 300; // 5 minutes for large test batches
export const dynamic = 'force-dynamic';

/**
 * Test all tracked queries for a site
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteUrl } = await request.json();

    if (!siteUrl) {
      return Response.json(
        { error: 'siteUrl is required' },
        { status: 400 }
      );
    }

    // Normalize user domain
    const userDomain = siteUrl
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/^sc-domain:/, '')
      .replace(/\/$/, '')
      .toLowerCase();
    
    const queries = await getQueries(siteUrl);
    
    console.log(`[GEO Test All] Testing ${queries.length} queries on Gemini`);
    console.log(`[GEO Test All] User domain (normalized):`, userDomain);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    let processed = 0;
    const BATCH_SIZE = 30; // Tier 1 with gemini-2.0-flash = 2000 RPM!

    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (query) => {
          try {
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.0-flash',
            });

            const tools = [{ googleSearch: {} }] as any;

            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: query.query }] }],
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
              queryId: query.id,
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
            console.log(`[GEO Test All] Progress: ${processed}/${queries.length}`);
          } catch (error: any) {
            console.error(`Gemini test failed for "${query.query}":`, error.message);
          }
        })
      );

      // Minimal delay for Tier 1
      if (i + BATCH_SIZE < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[GEO Test All] Completed: ${processed}/${queries.length} queries tested`);

    return Response.json({
      success: true,
      processed,
      total: queries.length,
    });
  } catch (error: any) {
    console.error('[GEO Test All] Error:', error);
    return Response.json(
      { error: 'Failed to test all queries', details: error.message },
      { status: 500 }
    );
  }
}

