/**
 * Vector Memory - Supabase pgvector + Gemini Embeddings
 * 無料で使えるセマンティック検索
 */

import { getSupabase } from './supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini Embedding モデル
let _genai: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    _genai = new GoogleGenerativeAI(apiKey);
  }
  return _genai;
}

// ========================================
// Embedding生成
// ========================================

export async function generateEmbedding(text: string): Promise<number[]> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const genai = getGenAI();
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' });

  const results = await Promise.all(
    texts.map(text => model.embedContent(text))
  );

  return results.map(r => r.embedding.values);
}

// ========================================
// Vector Memory Interface
// ========================================

export interface MemoryDocument {
  id?: string;
  content: string;
  metadata: {
    source: string;        // 'note', 'competitor', 'success_pattern', 'article'
    url?: string;
    title?: string;
    author?: string;
    category?: string;
    score?: number;
    scraped_at?: string;
    [key: string]: unknown;
  };
  embedding?: number[];
  created_at?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: MemoryDocument['metadata'];
  similarity: number;
}

// ========================================
// Vector Memory Class
// ========================================

export class VectorMemory {
  private tableName = 'memory_vectors';

  /**
   * ドキュメントを保存（embedding自動生成）
   */
  async store(doc: MemoryDocument): Promise<string> {
    const supabase = getSupabase();

    // Embedding生成
    const embedding = doc.embedding || await generateEmbedding(doc.content);

    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        content: doc.content,
        metadata: doc.metadata,
        embedding: embedding,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to store document: ${error.message}`);
    return data.id;
  }

  /**
   * 複数ドキュメントを一括保存
   */
  async storeBatch(docs: MemoryDocument[]): Promise<string[]> {
    const supabase = getSupabase();

    // Embeddingを一括生成
    const embeddings = await generateEmbeddings(docs.map(d => d.content));

    const records = docs.map((doc, i) => ({
      content: doc.content,
      metadata: doc.metadata,
      embedding: embeddings[i],
    }));

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(records)
      .select('id');

    if (error) throw new Error(`Failed to store batch: ${error.message}`);
    return data.map(d => d.id);
  }

  /**
   * セマンティック検索
   */
  async search(query: string, options: {
    limit?: number;
    threshold?: number;
    filter?: {
      source?: string;
      category?: string;
    };
  } = {}): Promise<SearchResult[]> {
    const { limit = 10, threshold = 0.7, filter } = options;
    const supabase = getSupabase();

    // クエリのEmbedding生成
    const queryEmbedding = await generateEmbedding(query);

    // RPC呼び出しでベクター検索
    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_source: filter?.source || null,
      filter_category: filter?.category || null,
    });

    if (error) throw new Error(`Search failed: ${error.message}`);

    return (data || []).map((row: { id: string; content: string; metadata: MemoryDocument['metadata']; similarity: number }) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
    }));
  }

  /**
   * 類似ドキュメントを取得（重複チェック用）
   */
  async findSimilar(content: string, threshold = 0.95): Promise<SearchResult[]> {
    return this.search(content, { limit: 3, threshold });
  }

  /**
   * ソース別にドキュメント数を取得
   */
  async getStats(): Promise<Record<string, number>> {
    const supabase = getSupabase();

    const res = await supabase
      .from(this.tableName)
      .select('metadata->source');

    if (res.error) throw new Error(`Failed to get stats: ${res.error.message}`);

    const counts: Record<string, number> = {};
    for (const row of res.data || []) {
      const source = (row as { source?: string }).source || 'unknown';
      counts[source] = (counts[source] || 0) + 1;
    }
    return counts;
  }

  /**
   * 古いドキュメントを削除
   */
  async cleanup(daysOld = 90): Promise<number> {
    const supabase = getSupabase();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const { data, error } = await supabase
      .from(this.tableName)
      .delete()
      .lt('created_at', cutoff.toISOString())
      .select('id');

    if (error) throw new Error(`Cleanup failed: ${error.message}`);
    return data?.length || 0;
  }
}

// シングルトンインスタンス
let _memory: VectorMemory | null = null;

export function getVectorMemory(): VectorMemory {
  if (!_memory) {
    _memory = new VectorMemory();
  }
  return _memory;
}

// ========================================
// SQL: Supabaseで実行が必要
// ========================================
/*
-- pgvector拡張を有効化
create extension if not exists vector;

-- メモリテーブル作成
create table memory_vectors (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  metadata jsonb default '{}',
  embedding vector(768),  -- Gemini text-embedding-004は768次元
  created_at timestamptz default now()
);

-- ベクター検索用インデックス
create index on memory_vectors using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- メタデータ検索用インデックス
create index on memory_vectors using gin (metadata);

-- 検索用RPC関数
create or replace function match_memories(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_source text default null,
  filter_category text default null
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) as similarity
  from memory_vectors m
  where 1 - (m.embedding <=> query_embedding) > match_threshold
    and (filter_source is null or m.metadata->>'source' = filter_source)
    and (filter_category is null or m.metadata->>'category' = filter_category)
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;
*/
