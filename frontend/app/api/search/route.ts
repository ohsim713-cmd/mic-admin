import { NextRequest, NextResponse } from 'next/server';
import { braveSearch, searchTrends, searchNews, searchCompetitors } from '@/lib/brave-search';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'web'; // web, trends, news, competitors
  const count = parseInt(searchParams.get('count') || '10');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    let results;

    switch (type) {
      case 'trends':
        results = await searchTrends(query);
        break;
      case 'news':
        results = await searchNews(query);
        break;
      case 'competitors':
        results = await searchCompetitors(query);
        break;
      default:
        results = await braveSearch(query, { count });
    }

    return NextResponse.json({
      query,
      type,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
