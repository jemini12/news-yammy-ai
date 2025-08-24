import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { cache } from '../../../lib/supabase-cache';

export const dynamic = 'force-dynamic';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(request: NextRequest) {
  try {
    const { title, description, content } = await request.json();
    
    if (!title && !description) {
      return NextResponse.json(
        { error: 'Title or description is required' },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const textToSummarize = content || `${title} ${description}`;
    
    // Check cache first
    const cachedSummary = await cache.getSummary(textToSummarize);
    if (cachedSummary) {
      console.log('Using cached summary');
      return NextResponse.json({ summary: cachedSummary });
    }

    console.log('Calling OpenAI for summary');
    
    // Check if we have full article content (longer than just title + description)
    const isFullArticle = textToSummarize.length > 500;
    
    const prompt = isFullArticle ? 
      `Summarize the following Korean news article in 3-5 clear sentences in Korean. Include the main points, key facts, and any important conclusions. Make it comprehensive yet concise.

Article: "${textToSummarize}"

Provide only the Korean summary:` :
      `Summarize the following Korean news article in exactly 2-3 sentences in Korean. Focus on the key facts and main points. Keep it concise and informative.

Title: "${title}"
Description: "${description}"

Respond with only the summary, no additional text or explanations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: isFullArticle ? 500 : 200
    });

    const summary = completion.choices[0].message.content || '요약을 생성할 수 없습니다.';
    
    // Cache the summary
    await cache.setSummary(textToSummarize, summary);

    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error summarizing article:', error);
    return NextResponse.json(
      { error: 'Failed to summarize article' },
      { status: 500 }
    );
  }
}