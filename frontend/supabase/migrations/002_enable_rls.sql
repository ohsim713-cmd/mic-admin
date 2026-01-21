-- =============================================
-- RLS (Row Level Security) 有効化
-- Security Advisor対応
-- =============================================

-- 1. schedules テーブル
ALTER TABLE IF EXISTS public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on schedules" ON public.schedules
  FOR ALL USING (true) WITH CHECK (true);

-- 2. success_patterns テーブル
ALTER TABLE IF EXISTS public.success_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on success_patterns" ON public.success_patterns
  FOR ALL USING (true) WITH CHECK (true);

-- 3. post_stock テーブル
ALTER TABLE IF EXISTS public.post_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on post_stock" ON public.post_stock
  FOR ALL USING (true) WITH CHECK (true);

-- 4. memory_vectors テーブル
ALTER TABLE IF EXISTS public.memory_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations on memory_vectors" ON public.memory_vectors
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 注意: 本番環境ではより厳密なポリシーを検討
-- 例: サービスロールのみアクセス可能にする
-- =============================================
-- CREATE POLICY "Service role only" ON public.memory_vectors
--   FOR ALL USING (auth.role() = 'service_role');
