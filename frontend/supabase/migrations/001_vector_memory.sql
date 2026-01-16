-- =============================================
-- Vector Memory テーブル
-- Supabase Free Tier対応
-- =============================================

-- pgvector拡張を有効化（Supabaseでは既に利用可能）
create extension if not exists vector;

-- メモリテーブル作成
create table if not exists memory_vectors (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  metadata jsonb default '{}',
  embedding vector(768),  -- Gemini text-embedding-004は768次元
  created_at timestamptz default now()
);

-- ベクター検索用インデックス（Free tierでも使用可能）
create index if not exists memory_vectors_embedding_idx
  on memory_vectors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- メタデータ検索用インデックス
create index if not exists memory_vectors_metadata_idx
  on memory_vectors using gin (metadata);

-- 作成日時インデックス（クリーンアップ用）
create index if not exists memory_vectors_created_at_idx
  on memory_vectors (created_at);

-- =============================================
-- 検索用RPC関数
-- =============================================

create or replace function match_memories(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 10,
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

-- =============================================
-- 重複チェック用関数
-- =============================================

create or replace function find_similar_memories(
  query_embedding vector(768),
  similarity_threshold float default 0.95
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    1 - (m.embedding <=> query_embedding) as similarity
  from memory_vectors m
  where 1 - (m.embedding <=> query_embedding) > similarity_threshold
  order by m.embedding <=> query_embedding
  limit 5;
end;
$$;

-- =============================================
-- 統計情報取得用ビュー
-- =============================================

create or replace view memory_stats as
select
  metadata->>'source' as source,
  count(*) as count,
  min(created_at) as oldest,
  max(created_at) as newest
from memory_vectors
group by metadata->>'source';

-- =============================================
-- 古いデータ削除用関数
-- =============================================

create or replace function cleanup_old_memories(days_old int default 90)
returns int
language plpgsql
as $$
declare
  deleted_count int;
begin
  delete from memory_vectors
  where created_at < now() - (days_old || ' days')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- =============================================
-- RLS (Row Level Security) - オプション
-- =============================================

-- alter table memory_vectors enable row level security;

-- create policy "Allow all operations" on memory_vectors
--   for all using (true);
