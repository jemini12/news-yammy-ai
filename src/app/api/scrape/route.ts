import { NextRequest, NextResponse } from 'next/server';
import { scraper } from '../../../lib/scraper';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await scraper.scrapeWithRetry(url);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to scrape article' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: result.title,
      content: result.content,
      publishedDate: result.publishedDate,
      author: result.author,
      wordCount: result.content.split(/\s+/).length
    });

  } catch (error) {
    console.error('Error in scrape API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}