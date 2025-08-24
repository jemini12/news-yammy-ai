import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedArticle {
  title: string;
  content: string;
  publishedDate?: string;
  author?: string;
  success: boolean;
  error?: string;
}

export class ArticleScraper {
  private static instance: ArticleScraper;
  
  static getInstance(): ArticleScraper {
    if (!ArticleScraper.instance) {
      ArticleScraper.instance = new ArticleScraper();
    }
    return ArticleScraper.instance;
  }

  private getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  private cleanText(text: string): string {
    return text
      // Clean HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Clean multiple spaces and normalize whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  private extractContent($: cheerio.CheerioAPI, url: string): string {
    // Common Korean news site selectors
    const selectors = [
      // Naver news - prioritize media_end_summary subtitle
      '.media_end_summary.subtitle, #dic_area, .go_trans._article_content, ._article_content',
      // Daum news  
      '.news_view .article_view, .news_article .article_view',
      // General selectors
      'article, .article, .news-article, .post-content, .entry-content',
      '.content, .main-content, .article-content, .news-content',
      // Fallback
      'main, #main, .main, #content, .post, .story'
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        // Remove ads, scripts, unwanted elements, and specifically end_photo_org class
        elements.find('script, style, .ad, .advertisement, .related, .comment, .end_photo_org').remove();
        
        let content = '';
        elements.each((_, el) => {
          const text = $(el).text();
          if (text.length > content.length) {
            content = text;
          }
        });

        if (content.length > 100) { // Must have substantial content
          return this.cleanText(content);
        }
      }
    }

    // Fallback: get all paragraphs but exclude end_photo_org
    $('p .end_photo_org').remove();
    const paragraphs = $('p').map((_, el) => $(el).text()).get();
    const content = paragraphs.join('\n');
    
    return content.length > 100 ? this.cleanText(content) : '';
  }

  async scrapeArticle(url: string): Promise<ScrapedArticle> {
    try {
      console.log('Scraping article:', url);

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 30000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('h1, .headline, .title, .news-headline, .article-headline').first().text().trim() ||
                   $('title').text().replace(' - ', ' | ').split(' | ')[0] ||
                   'No title found';

      // Extract content
      const content = this.extractContent($, url);
      
      if (!content) {
        return {
          title,
          content: '',
          success: false,
          error: 'Could not extract article content'
        };
      }

      // Extract metadata
      const publishedDate = $('time, .date, .publish-date, .article-date').first().text().trim() || undefined;
      const author = $('.author, .byline, .writer').first().text().trim() || undefined;

      return {
        title: this.cleanText(title),
        content,
        publishedDate,
        author,
        success: true
      };

    } catch (error: any) {
      console.error('Scraping error:', error.message);
      return {
        title: 'Scraping failed',
        content: '',
        success: false,
        error: error.message || 'Unknown scraping error'
      };
    }
  }

  async scrapeWithRetry(url: string, retries: number = 2): Promise<ScrapedArticle> {
    for (let i = 0; i <= retries; i++) {
      const result = await this.scrapeArticle(url);
      
      if (result.success || i === retries) {
        return result;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }

    return {
      title: 'Scraping failed',
      content: '',
      success: false,
      error: 'Max retries exceeded'
    };
  }
}

export const scraper = ArticleScraper.getInstance();