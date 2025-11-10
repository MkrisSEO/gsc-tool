// @ts-nocheck
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractCitations, calculateVisibilityScore } from '@/lib/geoTracking';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface TestQueryRequest {
  query: string;
  userDomain: string;
}

interface EngineResult {
  engine: 'gemini';
  success: boolean;
  cited: boolean;
  citationCount: number;
  visibilityScore: number;
  competitors: string[];
  responseExcerpt: string;
  fullResponse?: string;
  searchQueries?: string[];
  error?: string;
}

/**
 * Test a query on Gemini with Google Search grounding
 */
async function testOnGemini(query: string, userDomain: string): Promise<EngineResult> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    
    console.log(`[GEO Test] Testing on Gemini with Google Search: "${query}"`);

    // Use gemini-2.0-flash with Google Search grounding (2000 RPM on Tier 1!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const tools = [{ googleSearch: {} }] as any;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: tools,
    } as any);
    const response = result.response;
    const responseText = response.text();
    
    // Extract grounding metadata (search queries used)
    const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
    const webSearchQueries = groundingMetadata?.webSearchQueries || [];
    
    // Extract citations from grounding chunks
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const webSources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        url: chunk.web.uri,
        title: chunk.web.title,
      }));
    
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

    const score = calculateVisibilityScore(citations);
    const totalSourcesFound = webSources.length;

    console.log(`[GEO Test] Gemini result: visibleCitation=${citations.cited}, usedAsSource=${userInGrounding}, score=${score}, sourcesFound=${totalSourcesFound}`);

    return {
      engine: 'gemini',
      success: true,
      cited: citations.cited, // Visible citation in response text
      usedAsSource: citations.usedAsSource, // Used in grounding (even if not visible)
      citationCount: citations.citationCount,
      visibilityScore: score,
      competitors: citations.competitors,
      responseExcerpt: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      fullResponse: responseText,
      searchQueries: webSearchQueries,
      sourcesFound: totalSourcesFound, // How many web sources Gemini found total
    };
  } catch (error: any) {
    console.error('[GEO Test] Gemini error:', error.message);
    return {
      engine: 'gemini',
      success: false,
      cited: false,
      citationCount: 0,
      visibilityScore: 0,
      competitors: [],
      responseExcerpt: '',
      error: error.message || 'Failed to test query',
    };
  }
}

/**
 * API endpoint to test a query on multiple engines
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TestQueryRequest = await request.json();
    const { query, userDomain } = body;

    if (!query || !userDomain) {
      return Response.json(
        { error: 'query and userDomain are required' },
        { status: 400 }
      );
    }

    console.log(`[GEO Test] Testing query: "${query}" on Gemini`);

    // Test on Gemini
    const geminiResult = await testOnGemini(query, userDomain);

    console.log(`[GEO Test] Completed test for "${query}"`);

    return Response.json({
      success: true,
      query,
      results: [geminiResult],
      testedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[GEO Test] Error:', error);
    return Response.json(
      { error: 'Failed to test query', details: error.message },
      { status: 500 }
    );
  }
}

