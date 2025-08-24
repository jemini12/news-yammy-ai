import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export class SupabaseCache {
  private static instance: SupabaseCache;
  
  static getInstance(): SupabaseCache {
    if (!SupabaseCache.instance) {
      SupabaseCache.instance = new SupabaseCache();
    }
    return SupabaseCache.instance;
  }

  private getHash(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async setTranslation(originalText: string, translation: string): Promise<void> {
    if (!supabase) return;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { error } = await supabase
        .from('cache_entries')
        .upsert({
          cache_key: cacheKey,
          cache_type: 'translation',
          data: { original: originalText, translation },
          expires_at: null // Never expires
        });

      if (error) {
        console.error('Error caching translation:', error);
      }
    } catch (error) {
      console.error('Error in setTranslation:', error);
    }
  }

  async getTranslation(originalText: string): Promise<string | null> {
    if (!supabase) return null;
    
    try {
      const cacheKey = this.getHash(originalText);
      console.log('Checking cache for key:', cacheKey);
      const { data, error } = await supabase
        .from('cache_entries')
        .select('data')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'translation')
        .single();

      if (error || !data) {
        return null;
      }

      return data.data.translation;
    } catch (error) {
      console.error('Error in getTranslation:', error);
      return null;
    }
  }

  async setSummary(originalText: string, summary: string): Promise<void> {
    if (!supabase) return;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { error } = await supabase
        .from('cache_entries')
        .upsert({
          cache_key: cacheKey,
          cache_type: 'summary',
          data: { original: originalText, summary },
          expires_at: null // Never expires
        });

      if (error) {
        console.error('Error caching summary:', error);
      }
    } catch (error) {
      console.error('Error in setSummary:', error);
    }
  }

  async getSummary(originalText: string): Promise<string | null> {
    if (!supabase) return null;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { data, error } = await supabase
        .from('cache_entries')
        .select('data')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'summary')
        .single();

      if (error || !data) {
        return null;
      }

      return data.data.summary;
    } catch (error) {
      console.error('Error in getSummary:', error);
      return null;
    }
  }

  async setCuration(originalText: string, curation: any): Promise<void> {
    if (!supabase) return;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { error } = await supabase
        .from('cache_entries')
        .upsert({
          cache_key: cacheKey,
          cache_type: 'analysis',
          data: { original: originalText, curation },
          expires_at: null // Never expires
        });

      if (error) {
        console.error('Error caching curation:', error);
      }
    } catch (error) {
      console.error('Error in setCuration:', error);
    }
  }

  async getCuration(originalText: string): Promise<any | null> {
    if (!supabase) return null;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { data, error } = await supabase
        .from('cache_entries')
        .select('data')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'analysis')
        .single();

      if (error || !data) {
        return null;
      }

      return data.data.curation;
    } catch (error) {
      console.error('Error in getCuration:', error);
      return null;
    }
  }

  async setFormatting(originalText: string, formattedText: string): Promise<void> {
    if (!supabase) return;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { error } = await supabase
        .from('cache_entries')
        .upsert({
          cache_key: cacheKey,
          cache_type: 'analysis',
          data: { original: originalText, formatted: formattedText },
          expires_at: null // Never expires
        });

      if (error) {
        console.error('Error caching formatting:', error);
      }
    } catch (error) {
      console.error('Error in setFormatting:', error);
    }
  }

  async getFormatting(originalText: string): Promise<string | null> {
    if (!supabase) return null;
    
    try {
      const cacheKey = this.getHash(originalText);
      const { data, error } = await supabase
        .from('cache_entries')
        .select('data')
        .eq('cache_key', cacheKey)
        .eq('cache_type', 'analysis')
        .single();

      if (error || !data) {
        return null;
      }

      return data.data.formatted;
    } catch (error) {
      console.error('Error in getFormatting:', error);
      return null;
    }
  }
}

export const cache = SupabaseCache.getInstance();