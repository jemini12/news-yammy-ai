import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { cache } from '../../../lib/supabase-cache';

export const dynamic = 'force-dynamic';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Check cache first
    const cachedTranslation = await cache.getTranslation(text);
    if (cachedTranslation) {
      console.log('Using cached translation');
      return NextResponse.json({ translation: cachedTranslation });
    }

    console.log('Calling OpenAI for translation');
    
    // Determine if this is a full article (longer text) or short snippet
    const isFullArticle = text.length > 500;
    
    const prompt = isFullArticle ? 
      `Translate and reformat the following Korean economic news article to English. Make it well-structured, natural, and easy to read for English speakers. 

Requirements:
- Clean and natural English translation
- Organize into clear paragraphs 
- Maintain professional tone for economic/financial content
- Preserve important numbers, company names, and technical terms
- Remove any photo captions or irrelevant content
- Format for better readability with proper paragraph breaks

Article: "${text}"

Provide only the clean, well-formatted English translation:` :
      `Translate the following Korean news text to English. Keep the translation natural and readable while maintaining the original meaning. If the text is already in English, return it as is.

Text: "${text}"

Respond with only the English translation, no additional text or explanations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: isFullArticle ? 4000 : 1000
    });

    const translation = completion.choices[0].message.content || text;
    
    // Cache the translation
    await cache.setTranslation(text, translation);

    return NextResponse.json({ translation });

  } catch (error) {
    console.error('Error translating text:', error);
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    );
  }
}