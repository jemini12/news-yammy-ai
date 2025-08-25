import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items: Array<{
    title: string;
    description: string;
    link: string;
    pubDate: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, display = 10 } = await request.json();
    
    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    const naverClientId = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!naverClientId || !naverClientSecret) {
      return NextResponse.json(
        { error: 'Naver API credentials not configured' },
        { status: 500 }
      );
    }

    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: {
        query: keyword,
        display: Math.min(display, 100),
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': naverClientId,
        'X-Naver-Client-Secret': naverClientSecret,
      }
    });

    const naverData: NaverNewsResponse = response.data;
    
    const articles: NewsItem[] = naverData.items.map(item => ({
      title: item.title.replace(/<[^>]*>/g, ''), // Remove HTML tags
      description: item.description.replace(/<[^>]*>/g, ''), // Remove HTML tags
      link: item.link,
      pubDate: item.pubDate
    }));

    // Auto-curate articles for importance scoring
    const curationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/curate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles })
    });

    if (curationResponse.ok) {
      const curationData = await curationResponse.json();
      return NextResponse.json({
        keyword,
        totalArticles: curationData.articles.length,
        articles: curationData.articles,
        averageImportance: curationData.averageScore
      });
    } else {
      // Fallback: return articles without curation
      return NextResponse.json({
        keyword,
        totalArticles: articles.length,
        articles: articles.map((article: NewsItem) => ({
          ...article,
          importanceScore: 5, // Default score
          importanceReason: "큐레이션 사용 불가",
          category: "other",
          urgency: "medium",
          topics: []
        }))
      });
    }

  } catch (error) {
    console.error('Error searching news:', error);
    return NextResponse.json(
      { error: 'Failed to search news' },
      { status: 500 }
    );
  }
}