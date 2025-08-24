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
          const prompt = `Analyze this Korean economic news article and score its market impact from 0-10:

Title: "${article.title}"
Description: "${article.description}"

Economic Impact Scoring:
- 9-10: Market-moving events (interest rate changes, major policy shifts, economic crisis, corporate scandals)
- 7-8: Significant economic developments (GDP data, inflation reports, major M&A, trade agreements)
- 5-6: Notable economic news (corporate earnings, sector updates, minor policy changes)
- 3-4: Routine economic news (regular economic indicators, minor corporate news)
- 1-2: Low-impact economic news (minor announcements, non-market moving events)

Economic Analysis Factors:
- Market impact potential (stocks, bonds, currency)
- Economic policy implications
- Corporate and industry effects
- International trade/economic relations
- Monetary policy relevance
- Financial sector impact

Respond with ONLY a valid JSON object (no markdown, no code blocks, no additional text):
{
  "score": [0-10],
  "reason": "Brief explanation of market impact",
  "category": "monetary|markets|currency|realestate|trade|corporate|banking|policy|international|other",
  "urgency": "low|medium|high|breaking",
  "topics": ["economic_topic1", "economic_topic2", "economic_topic3"]
}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: "json_object" }
          });

          const responseContent = completion.choices[0].message.content || 
            '{"score": 5, "reason": "Analysis failed", "category": "other", "urgency": "medium", "topics": []}';
          
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
            curation.reason = curation.reason || 'No reason provided';
            curation.category = curation.category || 'other';
            curation.urgency = curation.urgency || 'medium';
            curation.topics = curation.topics || [];
            
          } catch (parseError) {
            console.error('JSON parsing failed:', parseError, 'Raw response:', responseContent);
            // Fallback to default values
            curation = {
              score: 5,
              reason: 'Analysis parsing failed',
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
            importanceReason: "Curation analysis failed",
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