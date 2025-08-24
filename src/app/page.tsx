'use client';

import { useState, useEffect } from 'react';

interface NewsItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  translation?: string;
  showFullContent?: boolean;
  fullContent?: string;
  formattedContent?: string;
  isContentLoaded?: boolean;
  isTranslated?: boolean;
  author?: string;
  wordCount?: number;
  importanceScore?: number;
  importanceReason?: string;
  category?: string;
  urgency?: 'low' | 'medium' | 'high' | 'breaking';
  topics?: string[];
}

interface CategoryData {
  keyword: string;
  title: string;
  icon: string;
  articles: NewsItem[];
  loading: boolean;
}

const PREDEFINED_CATEGORIES = [
  { keyword: '환율', title: 'Exchange Rates', icon: '💱' },
  { keyword: '국내 증시', title: 'Korean Stock Market', icon: '📈' },
  { keyword: '미국 증시', title: 'US Stock Market', icon: '🇺🇸' },
  { keyword: '부동산', title: 'Real Estate', icon: '🏢' },
  { keyword: '국내 경제', title: 'Economy', icon: '👀' },
  { keyword: '글로벌 경제', title: 'Global Economy', icon: '🌍' }
];

export default function Home() {
  const [categories, setCategories] = useState<CategoryData[]>(
    PREDEFINED_CATEGORIES.map(cat => ({
      ...cat,
      articles: [],
      loading: false
    }))
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterImportance, setFilterImportance] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Auto-load all categories when component mounts
  useEffect(() => {
    loadAllCategories();
  }, []);

  const loadCategoryNews = async (categoryIndex: number) => {
    const category = categories[categoryIndex];
    
    setCategories(prev => prev.map((cat, idx) => 
      idx === categoryIndex ? { ...cat, loading: true } : cat
    ));

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: category.keyword, display: 10 })
      });

      const data = await response.json();
      if (data.articles) {
        const processedArticles = data.articles.map((article: NewsItem) => ({
          ...article,
          showFullContent: false,
          isContentLoaded: false,
          isTranslated: false
        }));

        setCategories(prev => prev.map((cat, idx) => 
          idx === categoryIndex ? { ...cat, articles: processedArticles, loading: false } : cat
        ));
      }
    } catch (error) {
      console.error('Error loading category news:', error);
      setCategories(prev => prev.map((cat, idx) => 
        idx === categoryIndex ? { ...cat, loading: false } : cat
      ));
    }
  };

  // Auto-load all categories on page load
  const loadAllCategories = async () => {
    for (let i = 0; i < categories.length; i++) {
      await loadCategoryNews(i);
      // Small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const loadAndTranslate = async (categoryIndex: number, articleIndex: number) => {
    const article = categories[categoryIndex].articles[articleIndex];
    const articleId = `${categoryIndex}-${articleIndex}`;
    
    if (article.isContentLoaded && article.isTranslated) {
      // Just toggle visibility if already processed
      toggleFullContent(categoryIndex, articleIndex);
      return;
    }

    setProcessingId(articleId);
    
    try {
      let fullContent = article.fullContent;
      let author = article.author;
      let wordCount = article.wordCount;
      
      // Step 1: Load full content if not already loaded
      if (!article.isContentLoaded) {
        const scrapeResponse = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: article.link })
        });

        if (!scrapeResponse.ok) {
          throw new Error(`Scraping failed: ${scrapeResponse.status}`);
        }

        const scrapeData = await scrapeResponse.json();
        
        if (!scrapeData.content) {
          throw new Error('No content extracted');
        }
        
        fullContent = scrapeData.content;
        author = scrapeData.author;
        wordCount = scrapeData.wordCount;
      }

      // Step 2: Format Korean content for better readability
      const formatResponse = await fetch('/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullContent })
      });

      let formattedContent = fullContent;
      if (formatResponse.ok) {
        const formatData = await formatResponse.json();
        formattedContent = formatData.formattedContent;
      }

      // Step 3: Translate the content
      const textToTranslate = fullContent || `${article.title} ${article.description}`;
      const translateResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate })
      });

      if (!translateResponse.ok) {
        throw new Error(`Translation failed: ${translateResponse.status}`);
      }

      const translateData = await translateResponse.json();

      // Update article with scraped, formatted, and translated content
      setCategories(prev => prev.map((cat, catIdx) => 
        catIdx === categoryIndex ? {
          ...cat,
          articles: cat.articles.map((art, artIdx) => 
            artIdx === articleIndex ? {
              ...art,
              fullContent,
              formattedContent,
              translation: translateData.translation,
              isContentLoaded: true,
              isTranslated: true,
              showFullContent: true,
              author,
              wordCount
            } : art
          )
        } : cat
      ));

    } catch (error) {
      console.error('Error processing article:', error);
      // Mark as failed processing
      setCategories(prev => prev.map((cat, catIdx) => 
        catIdx === categoryIndex ? {
          ...cat,
          articles: cat.articles.map((art, artIdx) => 
            artIdx === articleIndex ? {
              ...art,
              isContentLoaded: false,
              fullContent: 'Processing failed - please try original article link'
            } : art
          )
        } : cat
      ));
    } finally {
      setProcessingId(null);
    }
  };

  const toggleFullContent = (categoryIndex: number, articleIndex: number) => {
    setCategories(prev => prev.map((cat, catIdx) => 
      catIdx === categoryIndex ? {
        ...cat,
        articles: cat.articles.map((art, artIdx) => 
          artIdx === articleIndex ? {
            ...art,
            showFullContent: !art.showFullContent
          } : art
        )
      } : cat
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getImportanceColor = (score: number) => {
    if (score >= 9) return 'bg-red-100 text-red-800 border-red-400';
    if (score >= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-400';
    if (score >= 5) return 'bg-green-100 text-green-800 border-green-400';
    return 'bg-gray-100 text-gray-600 border-gray-300';
  };

  const getImportanceLabel = (score: number) => {
    if (score >= 9) return 'Market Alert';
    if (score >= 7) return 'High Impact';
    if (score >= 5) return 'Notable';
    return 'Standard';
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'breaking': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filterArticle = (article: NewsItem) => {
    const importanceMatch = filterImportance === 'all' || 
      (filterImportance === 'breaking' && (article.importanceScore || 0) >= 9) ||
      (filterImportance === 'important' && (article.importanceScore || 0) >= 7 && (article.importanceScore || 0) < 9) ||
      (filterImportance === 'notable' && (article.importanceScore || 0) >= 5 && (article.importanceScore || 0) < 7) ||
      (filterImportance === 'regular' && (article.importanceScore || 0) < 5);
    
    // Map general categories to economic categories for backward compatibility
    const categoryMapping: { [key: string]: string[] } = {
      'monetary': ['monetary', 'economics', 'policy'],
      'markets': ['markets', 'economics'],
      'currency': ['currency', 'economics', 'international'],
      'realestate': ['realestate', 'economics'],
      'trade': ['trade', 'economics', 'international'],
      'corporate': ['corporate', 'economics'],
      'banking': ['banking', 'economics'],
      'policy': ['policy', 'politics', 'economics'],
      'international': ['international', 'economics'],
      'other': ['other', 'social', 'technology']
    };
    
    const categoryMatch = filterCategory === 'all' || 
      (categoryMapping[filterCategory] && categoryMapping[filterCategory].includes(article.category || 'other')) ||
      article.category === filterCategory;
    
    return importanceMatch && categoryMatch;
  };

  // Combine all articles from all categories into one unified list
  const allArticles = categories.flatMap((category, categoryIndex) => 
    category.articles.map((article, articleIndex) => ({
      ...article,
      categoryIndex,
      articleIndex,
      categoryTitle: category.title,
      categoryIcon: category.icon,
      categoryKeyword: category.keyword
    }))
  );

  // Deduplicate articles by URL, keeping the first occurrence
  const deduplicatedArticles = allArticles.reduce((acc, article) => {
    const existing = acc.find(existing => existing.link === article.link);
    if (!existing) {
      acc.push(article);
    }
    return acc;
  }, [] as typeof allArticles);

  // Filter and sort the unified list
  const filteredArticles = deduplicatedArticles
    .filter(filterArticle)
    .sort((a, b) => {
      // First sort by importance score (descending), then by date (descending)
      const scoreA = a.importanceScore || 0;
      const scoreB = b.importanceScore || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

  const totalArticles = deduplicatedArticles.length;
  const isLoading = categories.some(cat => cat.loading);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                🥟 News Yammy AI
              </h1>
              <p className="text-lg text-emerald-600 font-medium">Economic News Intelligence</p>
            </div>
          </div>
        </header>

        {/* Loading Status and Stats */}
        <div className="mb-6 text-center">
          {isLoading ? (
            <div className="inline-flex items-center gap-2 text-emerald-600 mb-4">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              Loading economic news...
            </div>
          ) : (
            <p className="text-gray-600 mb-4">
              Showing {filteredArticles.length} of {totalArticles} articles from 5 economic sectors
            </p>
          )}
        </div>

        {/* Filter Controls */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Importance</label>
              <select
                value={filterImportance}
                onChange={(e) => setFilterImportance(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Impact Levels</option>
                <option value="breaking">Market Alert (9-10)</option>
                <option value="important">High Impact (7-8)</option>
                <option value="notable">Notable (5-6)</option>
                <option value="regular">Standard (0-4)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Economic Sectors</option>
                <option value="monetary">Monetary Policy</option>
                <option value="markets">Stock Markets</option>
                <option value="currency">Currency & FX</option>
                <option value="realestate">Real Estate</option>
                <option value="trade">Trade & Export</option>
                <option value="corporate">Corporate News</option>
                <option value="banking">Banking & Finance</option>
                <option value="policy">Economic Policy</option>
                <option value="international">Global Economics</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Unified Article List */}
        <div className="space-y-6">
          {!isLoading && filteredArticles.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No articles match current filters</p>
            </div>
          )}

          {filteredArticles.map((article) => {
            const articleId = `${article.categoryIndex}-${article.articleIndex}`;
                    
            return (
              <div key={article.link} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <time className="text-gray-500">{formatDate(article.pubDate)}</time>
                    {article.author && <span className="text-gray-500">by {article.author}</span>}
                    {article.wordCount && <span className="text-gray-500">{article.wordCount} words</span>}
                    {article.isContentLoaded && article.isTranslated && (
                      <span className="text-green-600">✓ Processed</span>
                    )}
                  </div>
                  
                  {/* Importance and Category Badges */}
                  <div className="flex gap-2">
                    {/* Category Badge with Icon */}
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-medium">
                      {article.categoryIcon} {article.categoryKeyword}
                    </span>
                    {article.importanceScore !== undefined && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getImportanceColor(article.importanceScore)}`}>
                        {getImportanceLabel(article.importanceScore)} {article.importanceScore}/10
                      </span>
                    )}
                    {/* {article.urgency && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(article.urgency)}`}>
                        {article.urgency.toUpperCase()}
                      </span>
                    )}
                    {article.category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {article.category}
                      </span>
                    )} */}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold mb-3 leading-tight">
                  <a 
                    href={article.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {article.title.replace(/&amp;/g, '&')
                              .replace(/&quot;/g, '"')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&#39;/g, "'")
                              .replace(/&apos;/g, "'")}
                  </a>
                </h3>
                
                <p className="text-gray-700 mb-3 leading-relaxed">
                  {article.description}
                </p>

                {/* Market Impact Analysis */}
                {article.importanceReason && (
                  <div className="bg-emerald-50 border-l-4 border-emerald-400 p-3 mb-4">
                    <p className="text-emerald-800 text-sm">
                      <span className="font-medium">📊 Market Impact Analysis:</span> {article.importanceReason}
                    </p>
                  </div>
                )}

                {/* Topics */}
                {article.topics && article.topics.length > 0 && (
                  <div className="mb-4">
                    <div className="flex gap-2 flex-wrap">
                      {article.topics.map((topic, topicIndex) => (
                        <span key={topicIndex} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                          #{topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Article Content and Translation Side by Side */}
                {article.isContentLoaded && article.isTranslated && article.showFullContent && article.fullContent && !article.fullContent.includes('Scraping failed') && (
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Korean Content */}
                      <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
                        <h4 className="font-medium text-gray-900 mb-3">🇰🇷 한국어</h4>
                        <div className="text-gray-800 text-sm leading-relaxed max-h-96 overflow-y-auto">
                          {(article.formattedContent || article.fullContent).split('\n').map((paragraph, idx) => {
                            const cleanParagraph = paragraph.trim()
                              .replace(/&amp;/g, '&')
                              .replace(/&quot;/g, '"')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&#39;/g, "'")
                              .replace(/&apos;/g, "'");
                            return cleanParagraph && <p key={idx} className="mb-3 leading-relaxed">{cleanParagraph}</p>
                          })}
                        </div>
                      </div>
                      
                      {/* English Translation */}
                      <div className="bg-emerald-50 border-l-4 border-emerald-400 p-4">
                        <h4 className="font-medium text-emerald-900 mb-3">🌍 English</h4>
                        <div className="text-emerald-800 text-sm leading-relaxed max-h-96 overflow-y-auto">
                          {article.translation?.split('\n').map((paragraph, idx) => {
                            const cleanParagraph = paragraph.trim()
                              .replace(/&amp;/g, '&')
                              .replace(/&quot;/g, '"')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&#39;/g, "'")
                              .replace(/&apos;/g, "'");
                            return cleanParagraph && <p key={idx} className="mb-3 leading-relaxed">{cleanParagraph}</p>
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Processing Error Section */}
                {article.fullContent && article.fullContent.includes('Processing failed') && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <h4 className="font-medium text-red-900 mb-2">⚠️ Processing Failed:</h4>
                    <p className="text-red-800 text-sm">{article.fullContent}</p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                  {/* Main Action Button */}
                  <button
                    onClick={() => loadAndTranslate(article.categoryIndex, article.articleIndex)}
                    disabled={processingId === articleId}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-md"
                  >
                    {processingId === articleId ? 'Loading...' : 
                     (article.isContentLoaded && article.isTranslated) ? 
                     (article.showFullContent ? 'Show Less' : 'Show More') : 
                     'Show More'}
                  </button>

                  {/* Original Article Link */}
                  <a 
                    href={article.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                  >
                    Original Source →
                  </a>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}