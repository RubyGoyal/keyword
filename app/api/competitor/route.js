// Backend API for competitor gap analysis
// Uses DataForSEO Labs domain_intersection + ranked_keywords endpoints

export async function POST(request) {
  try {
    const { competitorDomain, locationCode = 2356, mode = 'gap' } = await request.json();
    
    const embeeDomain = 'embee.co.in';
    
    if (!competitorDomain || typeof competitorDomain !== 'string') {
      return Response.json({ error: 'Competitor domain is required' }, { status: 400 });
    }
    
    const cleanCompetitor = competitorDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return Response.json({ error: 'Server misconfigured: API credentials not set' }, { status: 500 });
    }

    const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

    // MODE: 'gap' â€” find keywords competitor ranks for that Embee doesn't
    // We use domain_intersection with intersections=false to get gap keywords
    if (mode === 'gap') {
      // First: get competitor's top keywords (where they rank well)
      const compRes = await fetch(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
        {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            target: cleanCompetitor,
            location_code: locationCode,
            language_code: 'en',
            limit: 200,
            order_by: ['keyword_data.keyword_info.search_volume,desc'],
            filters: [
              ['ranked_serp_element.serp_item.rank_group', '<=', 30],
            ],
          }]),
        }
      );

      if (!compRes.ok) {
        const text = await compRes.text();
        return Response.json({ error: `DataForSEO error ${compRes.status}: ${text.slice(0, 300)}` }, { status: compRes.status });
      }

      const compData = await compRes.json();
      if (compData.status_code !== 20000) {
        return Response.json({ error: compData.status_message || 'API request failed' }, { status: 500 });
      }

      const competitorItems = compData.tasks?.[0]?.result?.[0]?.items || [];

      // Second: get Embee's ranked keywords to figure out what to exclude
      const embeeRes = await fetch(
        'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
        {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            target: embeeDomain,
            location_code: locationCode,
            language_code: 'en',
            limit: 700,
            order_by: ['keyword_data.keyword_info.search_volume,desc'],
            filters: [
              ['ranked_serp_element.serp_item.rank_group', '<=', 50],
            ],
          }]),
        }
      );

      let embeeKeywords = new Set();
      let embeeRankings = {}; // map of keyword -> rank
      if (embeeRes.ok) {
        const embeeData = await embeeRes.json();
        if (embeeData.status_code === 20000) {
          const items = embeeData.tasks?.[0]?.result?.[0]?.items || [];
          items.forEach(item => {
            const kw = item.keyword_data?.keyword;
            const rank = item.ranked_serp_element?.serp_item?.rank_group;
            if (kw) {
              embeeKeywords.add(kw.toLowerCase());
              embeeRankings[kw.toLowerCase()] = rank;
            }
          });
        }
      }

      // Process: classify into Gap (competitor ranks, Embee doesn't) and Overlap (both rank)
      const gap = [];
      const overlap = [];
      
      competitorItems.forEach(item => {
        const kw = item.keyword_data?.keyword;
        if (!kw) return;
        
        const competitorRank = item.ranked_serp_element?.serp_item?.rank_group;
        const volume = item.keyword_data?.keyword_info?.search_volume || 0;
        const cpc = item.keyword_data?.keyword_info?.cpc || 0;
        const difficulty = item.keyword_data?.keyword_properties?.keyword_difficulty || null;
        const intent = item.keyword_data?.search_intent_info?.main_intent || 'unknown';
        const competition = item.keyword_data?.keyword_info?.competition_level || 'UNKNOWN';
        
        const entry = {
          keyword: kw,
          volume,
          cpc,
          difficulty,
          intent,
          competition,
          competitorRank,
          competitorUrl: item.ranked_serp_element?.serp_item?.url || '',
          embeeRank: embeeRankings[kw.toLowerCase()] || null,
        };
        
        if (embeeKeywords.has(kw.toLowerCase())) {
          overlap.push(entry);
        } else {
          gap.push(entry);
        }
      });

      // Sort gap by volume desc
      gap.sort((a, b) => b.volume - a.volume);
      overlap.sort((a, b) => b.volume - a.volume);

      // Domain stats
      const stats = {
        competitor: cleanCompetitor,
        competitorTopKeywords: competitorItems.length,
        embeeIndexedKeywords: embeeKeywords.size,
        gapCount: gap.length,
        overlapCount: overlap.length,
        gapTotalVolume: gap.reduce((s, k) => s + k.volume, 0),
      };

      return Response.json({ gap, overlap, stats });
    }

    return Response.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err) {
    console.error('Competitor API error:', err);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
