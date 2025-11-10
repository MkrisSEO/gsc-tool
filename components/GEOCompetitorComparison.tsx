'use client';

import { useMemo } from 'react';

interface CompetitorData {
  domain: string;
  citationCount: number;
  shareOfVoice: number;
  avgScore: number;
  queries: Array<{
    query: string;
    cited: boolean;
    position?: number;
  }>;
}

interface GEOCompetitorComparisonProps {
  userDomain: string;
  queries: Array<{
    id: string;
    query: string;
    latestResults?: {
      gemini?: {
        cited: boolean;
        usedAsSource?: boolean;
        visibilityScore: number;
        sourcesFound?: number;
        testedAt: string;
      };
    };
  }>;
  allResults: Array<{
    queryId: string;
    competitors: string[];
    cited: boolean;
    visibilityScore: number;
  }>;
}

export default function GEOCompetitorComparison({
  userDomain,
  queries,
  allResults,
}: GEOCompetitorComparisonProps) {
  const competitorAnalysis = useMemo(() => {
    // Normalize user domain for comparison
    const normalizedUserDomain = userDomain.toLowerCase();

    // Count competitor appearances
    const competitorMap = new Map<string, {
      count: number;
      scores: number[];
      queries: Set<string>;
      positions: number[];
    }>();

    // Also track user's own performance
    let userCitations = 0;
    const userScores: number[] = [];
    const userQueries = new Set<string>();

    allResults.forEach((result) => {
      const query = queries.find(q => q.id === result.queryId);
      if (!query) return;

      // Track user citations
      if (result.cited) {
        userCitations++;
        userScores.push(result.visibilityScore);
        userQueries.add(query.query);
      }

      // Also check if user is in "usedAsSource"
      if (result.usedAsSource && !result.cited) {
        // User was used in grounding, count it
        userCitations++;
        userScores.push(result.visibilityScore);
        userQueries.add(query.query);
      }

      // Track competitors (EXCLUDE user's own domain!)
      result.competitors.forEach((competitor, index) => {
        const competitorLower = competitor.toLowerCase();
        
        // Skip if this is the user's own domain
        if (competitorLower === normalizedUserDomain || 
            competitorLower.endsWith('.' + normalizedUserDomain) ||
            normalizedUserDomain.endsWith('.' + competitorLower)) {
          return; // Skip user's own domain
        }

        if (!competitorMap.has(competitor)) {
          competitorMap.set(competitor, {
            count: 0,
            scores: [],
            queries: new Set(),
            positions: [],
          });
        }

        const data = competitorMap.get(competitor)!;
        data.count++;
        data.scores.push(result.visibilityScore);
        data.queries.add(query.query);
        data.positions.push(index + 1);
      });
    });

    // Convert to array and calculate metrics
    const competitors: CompetitorData[] = Array.from(competitorMap.entries())
      .map(([domain, data]) => ({
        domain,
        citationCount: data.count,
        shareOfVoice: allResults.length > 0 ? (data.count / allResults.length) * 100 : 0,
        avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
        queries: Array.from(data.queries).map(q => ({
          query: q,
          cited: true,
          position: data.positions[0], // Simplified
        })),
      }))
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 10); // Top 10 competitors

    // Calculate total citations for share calculation
    const totalCitations = userCitations + competitors.reduce((sum, c) => sum + c.citationCount, 0);

    // Add user to comparison
    const userData: CompetitorData = {
      domain: userDomain,
      citationCount: userCitations,
      shareOfVoice: totalCitations > 0 ? (userCitations / totalCitations) * 100 : 0,
      avgScore: userScores.length > 0 ? userScores.reduce((a, b) => a + b, 0) / userScores.length : 0,
      queries: Array.from(userQueries).map(q => ({
        query: q,
        cited: true,
      })),
    };

    return {
      user: userData,
      competitors,
      totalCitations,
    };
  }, [queries, allResults, userDomain]);

  const topCompetitors = competitorAnalysis.competitors.slice(0, 5);
  const maxCitations = Math.max(
    competitorAnalysis.user.citationCount,
    ...topCompetitors.map(c => c.citationCount)
  );

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>
          Competitor Comparison
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
          See how you stack up against the most cited domains
        </p>
      </div>

      {/* Overall Share of Voice */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h4 style={{ margin: '0 0 16px 0', fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>
          Share of Voice
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* User Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', color: 'rgba(255, 255, 255, 0.9)' }}>
                {competitorAnalysis.user.domain} <span style={{ color: '#10b981' }}>← YOU</span>
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                {competitorAnalysis.user.citationCount} citations ({competitorAnalysis.user.shareOfVoice.toFixed(1)}%)
              </span>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', height: 32, borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  background: 'linear-gradient(to right, #10b981, #059669)',
                  height: '100%',
                  width: `${(competitorAnalysis.user.citationCount / maxCitations) * 100}%`,
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                }}
              >
                {competitorAnalysis.user.citationCount > 0 && (
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>
                    {competitorAnalysis.user.citationCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Competitor Bars */}
          {topCompetitors.map((competitor, index) => (
            <div key={competitor.domain}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                  {index + 1}. {competitor.domain}
                </span>
                <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {competitor.citationCount} citations ({competitor.shareOfVoice.toFixed(1)}%)
                </span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.1)', height: 32, borderRadius: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    background: index === 0 ? 'linear-gradient(to right, #ef4444, #dc2626)' : '#9ca3af',
                    height: '100%',
                    width: `${(competitor.citationCount / maxCitations) * 100}%`,
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 8,
                  }}
                >
                  {competitor.citationCount > 0 && (
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>
                      {competitor.citationCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Competitor Analysis */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>
          Top Competitor Details
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {topCompetitors.slice(0, 3).map((competitor, index) => (
            <div
              key={competitor.domain}
              style={{
                padding: 16,
                background: 'rgba(0, 113, 227, 0.06)',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>
                    #{index + 1} {competitor.domain}
                  </span>
                  {index === 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#ef4444', fontWeight: 600, color: '#FFFFFF' }}>
                      🏆 TOP COMPETITOR
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                    Cited in {competitor.queries.length} unique queries
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>Citations</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{competitor.citationCount}</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>Share</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{competitor.shareOfVoice.toFixed(1)}%</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>Avg Score</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{competitor.avgScore.toFixed(0)}</div>
                </div>
              </div>

              {/* Show sample queries they dominate */}
              {competitor.queries.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                    Sample queries they appear in:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {competitor.queries.slice(0, 3).map((q, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 12,
                          color: 'rgba(255, 255, 255, 0.9)',
                          padding: '6px 10px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: 4,
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                        }}
                      >
                        "{q.query}"
                      </div>
                    ))}
                    {competitor.queries.length > 3 && (
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 }}>
                        +{competitor.queries.length - 3} more queries
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Your Performance vs Top Competitor */}
      {topCompetitors.length > 0 && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            padding: 20,
            marginTop: 20,
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#FFFFFF' }}>
            You vs #{1} Competitor ({topCompetitors[0].domain})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 }}>Your Performance</div>
              <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #10b981' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                  {competitorAnalysis.user.citationCount} citations
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {competitorAnalysis.user.shareOfVoice.toFixed(1)}% share of voice
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                  Avg score: {competitorAnalysis.user.avgScore.toFixed(0)}
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 }}>{topCompetitors[0].domain}</div>
              <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #ef4444' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                  {topCompetitors[0].citationCount} citations
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {topCompetitors[0].shareOfVoice.toFixed(1)}% share of voice
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                  Avg score: {topCompetitors[0].avgScore.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* Gap Analysis */}
          <div style={{ marginTop: 16, padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #f59e0b' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', color: '#92400e', marginBottom: 8 }}>
              📊 Gap Analysis
            </div>
            {topCompetitors[0].citationCount > competitorAnalysis.user.citationCount ? (
              <div style={{ fontSize: 13, color: '#78350f' }}>
                They're cited <strong>{topCompetitors[0].citationCount - competitorAnalysis.user.citationCount} more times</strong> than you.
                {topCompetitors[0].shareOfVoice - competitorAnalysis.user.shareOfVoice > 10 && (
                  <> Focus on creating content for queries they dominate.</>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#78350f' }}>
                🎉 <strong>You're ahead!</strong> Keep up the good work and maintain your lead.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

