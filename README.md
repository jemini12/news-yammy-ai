# News Yammy AI 🥟

Your personal Korean economic news curator with AI-powered translations and market impact analysis.

## Features

- **Keyword Search**: Search Korean news articles by any keyword using Naver News API
- **AI News Curation**: Automatically scores articles by importance (0-10) and sorts them for better discovery
- **Smart Filtering**: Filter articles by importance level (Breaking, Important, Notable, Regular) and category
- **Full Article Scraping**: Automatically extract complete article content from news websites
- **English Translation**: Get AI-powered English translations of full articles with one click
- **Intelligent Analysis**: AI explains why each article is important with reasoning and topic tags
- **Smart Caching**: Intelligent caching system using Supabase to avoid redundant API calls
- **Modern UI**: Clean and responsive interface with importance badges and filtering controls

## Setup

1. **Clone and Install**
   ```bash
   cd news-yammy-ai
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and fill in your API credentials:
   ```bash
   cp .env.example .env.local
   ```

   Required APIs:
   - **Naver Developers**: Get CLIENT_ID and CLIENT_SECRET from https://developers.naver.com/
   - **OpenAI**: Get API key from https://platform.openai.com/
   - **Supabase**: Get URL and service role key from https://supabase.com/

3. **Supabase Setup**
   Use the same Supabase project as news-kr-ai. The `cache_entries` table is already set up and will store both projects' data with different `cache_type` values:
   - news-kr-ai: `analysis`, `news_briefing`, `summary`  
   - news-yammy-ai: `translation`, `summary`

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## Usage

1. **Search**: Enter a keyword in the search box
2. **AI Curation**: Articles are automatically scored for importance and sorted (Breaking → Important → Notable → Regular)
3. **Filter**: Use the filter controls to focus on specific importance levels or categories
4. **Read Analysis**: See AI reasoning for why each article is important and browse topic tags
5. **Load & Translate**: Click "Load & Translate 🚀" to scrape the full article and get English translation
6. **Compare**: View Korean original and English translation side-by-side
7. **Source**: Click "Original Source" to open the original news website

## Architecture

Based on the news-kr-ai reference architecture with modifications for:
- Generic keyword-based news search (vs specific topics)
- English translation feature
- Article summarization
- Improved caching for translations and summaries

## API Endpoints

- `POST /api/search` - Search news articles by keyword (auto-triggers curation)
- `POST /api/curate` - Score articles by importance and categorize them
- `POST /api/scrape` - Extract full article content from news URLs  
- `POST /api/translate` - Translate Korean text to English (supports full articles)
- `POST /api/summary` - Generate intelligent summaries from complete articles