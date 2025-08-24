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
    const cachedFormatting = await cache.getFormatting(text);
    if (cachedFormatting) {
      console.log('Using cached formatting');
      return NextResponse.json({ formattedContent: cachedFormatting });
    }

    console.log('Calling OpenAI for formatting Korean content');
    const prompt = `Reformat the following Korean economic news article for better readability. Break it into clear, well-structured paragraphs with proper line breaks.

Requirements:
- Keep the original Korean text exactly as is (no translation)
- Add proper paragraph breaks for better readability
- Separate different topics/ideas into distinct paragraphs
- Remove any photo captions or irrelevant content
- Maintain professional tone and all original information
- Organize the flow logically

Korean Article: "${text}"

Provide only the reformatted Korean text with proper paragraph breaks:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const formattedContent = completion.choices[0].message.content || text;

    // Cache the formatted content
    await cache.setFormatting(text, formattedContent);

    return NextResponse.json({ formattedContent });

  } catch (error) {
    console.error('Error formatting content:', error);
    return NextResponse.json(
      { error: 'Failed to format content' },
      { status: 500 }
    );
  }
}