import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { cache } from '../../../lib/supabase-cache';

export const dynamic = 'force-dynamic';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

interface CurationResult {
  score: number;
  reason: string;
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'breaking';
  topics: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { articles } = await request.json();
    
    if (!articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: 'Articles array is required' },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const curatedArticles = await Promise.all(
      articles.map(async (article: any) => {
        try {
          // Check cache first using article title + description as key
          const cacheKey = `${article.title} ${article.description}`;
          const cachedCuration = await cache.getCuration(cacheKey);
          
          if (cachedCuration) {
            console.log('Using cached curation for:', article.title);
            return {
              ...article,
              importanceScore: cachedCuration.score,
              importanceReason: cachedCuration.reason,
              category: cachedCuration.category,
              urgency: cachedCuration.urgency,
              topics: cachedCuration.topics
            };
          }

          console.log('Calling OpenAI for curation:', article.title);
          const prompt = `한국 경제 뉴스 기사를 분석하여 시장 영향도를 0-10점으로 점수를 매기세요:

제목: "${article.title}"
설명: "${article.description}"

경제 영향도 점수 기준:
- 9-10: 시장을 움직이는 주요 사건 (금리 변화, 주요 정책 변화, 경제 위기, 기업 스캔들)
- 7-8: 중요한 경제 동향 (GDP 데이터, 인플레이션 보고서, 주요 M&A, 무역 협정)
- 5-6: 주목할 만한 경제 뉴스 (기업 실적, 섹터 업데이트, 작은 정책 변화)
- 3-4: 일상적인 경제 뉴스 (정기 경제 지표, 작은 기업 뉴스)
- 1-2: 영향도가 낮은 경제 뉴스 (작은 발표, 시장 영향이 미미한 사건)

경제 분석 요소:
- 시장 영향 잠재력 (주식, 채권, 환율)
- 경제 정책 영향
- 기업 및 산업 효과
- 국제 무역/경제 관계
- 통화 정책 관련성
- 금융 부문 영향

유효한 JSON 객체만 응답하세요 (마크다운, 코드 블록, 추가 텍스트 없이):
{
  "score": [0-10],
  "reason": "시장 영향에 대한 간단한 한국어 설명",
  "category": "monetary|markets|currency|realestate|trade|corporate|banking|policy|international|other",
  "urgency": "low|medium|high|breaking",
  "topics": ["경제주제1", "경제주제2", "경제주제3"]
}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: "json_object" }
          });

          const responseContent = completion.choices[0].message.content || 
            '{"score": 5, "reason": "분석 실패", "category": "other", "urgency": "medium", "topics": []}';
          
          console.log('OpenAI Curation Response:', responseContent);
          
          // Clean up response - remove markdown code blocks and extra whitespace
          const cleanedResponse = responseContent
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
          
          console.log('Cleaned Response:', cleanedResponse);
          
          let curation: CurationResult;
          try {
            curation = JSON.parse(cleanedResponse);
            
            // Validate the parsed result
            if (typeof curation.score !== 'number' || curation.score < 0 || curation.score > 10) {
              throw new Error('Invalid score');
            }
            
            // Ensure required fields exist
            curation.reason = curation.reason || '이유가 제공되지 않음';
            curation.category = curation.category || 'other';
            curation.urgency = curation.urgency || 'medium';
            curation.topics = curation.topics || [];
            
          } catch (parseError) {
            console.error('JSON parsing failed:', parseError, 'Raw response:', responseContent);
            // Fallback to default values
            curation = {
              score: 5,
              reason: '분석 처리 실패',
              category: 'other',
              urgency: 'medium',
              topics: []
            };
          }
          
          // Cache the curation result
          await cache.setCuration(cacheKey, curation);
          
          return {
            ...article,
            importanceScore: curation.score,
            importanceReason: curation.reason,
            category: curation.category,
            urgency: curation.urgency,
            topics: curation.topics
          };
        } catch (error) {
          console.error('Error curating article:', error);
          return {
            ...article,
            importanceScore: 5,
            importanceReason: "큐레이션 분석 실패",
            category: "other",
            urgency: "medium",
            topics: []
          };
        }
      })
    );

    // Sort by importance score (highest first)
    const sortedArticles = curatedArticles.sort((a, b) => b.importanceScore - a.importanceScore);

    return NextResponse.json({
      articles: sortedArticles,
      totalCurated: curatedArticles.length,
      averageScore: curatedArticles.reduce((sum, article) => sum + article.importanceScore, 0) / curatedArticles.length
    });

  } catch (error) {
    console.error('Error in curation API:', error);
    return NextResponse.json(
      { error: 'Failed to curate articles' },
      { status: 500 }
    );
  }
}