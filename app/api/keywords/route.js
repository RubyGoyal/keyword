// This runs on Vercel's server, not in the user's browser.
// Your DataForSEO credentials stay in environment variables — never exposed to users.

export async function POST(request) {
  try {
    const { keyword, locationCode = 2356 } = await request.json();

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return Response.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
      return Response.json(
        { error: 'Server misconfigured: API credentials not set' },
        { status: 500 }
      );
    }

    const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

    // Fetch keyword ideas from DataForSEO Labs
    const ideasRes = await fetch(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            keywords: [keyword.trim()],
            location_code: locationCode,
            language_code: 'en',
            limit: 150,
            include_serp_info: true,
          },
        ]),
      }
    );

    if (!ideasRes.ok) {
      const text = await ideasRes.text();
      return Response.json(
        { error: `DataForSEO error ${ideasRes.status}: ${text.slice(0, 200)}` },
        { status: ideasRes.status }
      );
    }

    const data = await ideasRes.json();

    if (data.status_code !== 20000) {
      return Response.json(
        { error: data.status_message || 'API request failed' },
        { status: 500 }
      );
    }

    const items = data.tasks?.[0]?.result?.[0]?.items || [];

    return Response.json({ items });
  } catch (err) {
    console.error('API route error:', err);
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
