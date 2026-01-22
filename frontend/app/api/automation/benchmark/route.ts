/**
 * ベンチマークアカウント管理API
 *
 * 競合・参考アカウントの追加・一覧取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveToBlob, loadFromBlob, BLOB_FILES } from '@/lib/storage/blob';

export const runtime = 'nodejs';

interface BenchmarkAccount {
  username: string;
  addedAt: string;
  note: string;
}

interface ExternalSource {
  url: string;
  name: string;
  category: string;
  addedAt: string;
}

interface BenchmarkData {
  lastUpdated: string;
  categories: {
    chatre: { name: string; description: string; accounts: BenchmarkAccount[] };
    liver: { name: string; description: string; accounts: BenchmarkAccount[] };
    sidejob: { name: string; description: string; accounts: BenchmarkAccount[] };
    influencer: { name: string; description: string; accounts: BenchmarkAccount[] };
  };
  externalSources: {
    blogs: ExternalSource[];
    note: ExternalSource[];
  };
}

// Blobファイル名
const BENCHMARK_FILE = 'knowledge/benchmark_accounts.json';

/**
 * ベンチマークデータを読み込み
 */
async function loadBenchmarkData(): Promise<BenchmarkData> {
  try {
    const data = await loadFromBlob<BenchmarkData>(BENCHMARK_FILE);
    if (data) return data;
  } catch {
    // ignore
  }

  // デフォルトデータ
  return {
    lastUpdated: new Date().toISOString(),
    categories: {
      chatre: { name: 'チャトレ系', description: 'チャットレディ・海外チャトレ事務所', accounts: [] },
      liver: { name: 'ライバー系', description: 'ライバー事務所・配信者', accounts: [] },
      sidejob: { name: '副業・在宅系', description: '副業・在宅ワーク・女性向け求人', accounts: [] },
      influencer: { name: 'インフルエンサー系', description: '女性向けインフルエンサー・自己啓発', accounts: [] },
    },
    externalSources: {
      blogs: [],
      note: [],
    },
  };
}

/**
 * GET: ベンチマークアカウント一覧を取得
 */
export async function GET() {
  try {
    const data = await loadBenchmarkData();

    // 各カテゴリのアカウント数を集計
    const summary = {
      chatre: data.categories.chatre.accounts.length,
      liver: data.categories.liver.accounts.length,
      sidejob: data.categories.sidejob.accounts.length,
      influencer: data.categories.influencer.accounts.length,
      blogs: data.externalSources.blogs.length,
      note: data.externalSources.note.length,
    };

    return NextResponse.json({
      success: true,
      data,
      summary,
      total: summary.chatre + summary.liver + summary.sidejob + summary.influencer,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load benchmark data' },
      { status: 500 }
    );
  }
}

/**
 * POST: アカウントを追加
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, category, username, note, url, name, sourceType } = body;

    const data = await loadBenchmarkData();

    if (action === 'add_account') {
      // アカウント追加
      if (!category || !username) {
        return NextResponse.json({ error: 'category and username required' }, { status: 400 });
      }

      const validCategories = ['chatre', 'liver', 'sidejob', 'influencer'];
      if (!validCategories.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }

      // 重複チェック
      const categoryData = data.categories[category as keyof typeof data.categories];
      if (categoryData.accounts.find(a => a.username.toLowerCase() === username.toLowerCase())) {
        return NextResponse.json({ error: 'Account already exists' }, { status: 400 });
      }

      categoryData.accounts.push({
        username: username.replace('@', ''),
        addedAt: new Date().toISOString().split('T')[0],
        note: note || '',
      });

      data.lastUpdated = new Date().toISOString();
      await saveToBlob(BENCHMARK_FILE, data);

      return NextResponse.json({
        success: true,
        message: `Added @${username} to ${category}`,
        total: categoryData.accounts.length,
      });
    }

    if (action === 'add_source') {
      // 外部ソース追加
      if (!sourceType || !url || !name) {
        return NextResponse.json({ error: 'sourceType, url, and name required' }, { status: 400 });
      }

      const validTypes = ['blogs', 'note'];
      if (!validTypes.includes(sourceType)) {
        return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 });
      }

      const sources = data.externalSources[sourceType as keyof typeof data.externalSources];
      if (sources.find(s => s.url === url)) {
        return NextResponse.json({ error: 'Source already exists' }, { status: 400 });
      }

      sources.push({
        url,
        name,
        category: category || 'general',
        addedAt: new Date().toISOString().split('T')[0],
      });

      data.lastUpdated = new Date().toISOString();
      await saveToBlob(BENCHMARK_FILE, data);

      return NextResponse.json({
        success: true,
        message: `Added source: ${name}`,
        total: sources.length,
      });
    }

    if (action === 'bulk_add') {
      // 一括追加
      const { accounts } = body;
      if (!accounts || !Array.isArray(accounts)) {
        return NextResponse.json({ error: 'accounts array required' }, { status: 400 });
      }

      let added = 0;
      for (const acc of accounts) {
        const cat = acc.category || 'chatre';
        const categoryData = data.categories[cat as keyof typeof data.categories];
        if (!categoryData) continue;

        const uname = (acc.username || '').replace('@', '');
        if (!uname) continue;

        if (categoryData.accounts.find(a => a.username.toLowerCase() === uname.toLowerCase())) {
          continue;
        }

        categoryData.accounts.push({
          username: uname,
          addedAt: new Date().toISOString().split('T')[0],
          note: acc.note || '',
        });
        added++;
      }

      data.lastUpdated = new Date().toISOString();
      await saveToBlob(BENCHMARK_FILE, data);

      return NextResponse.json({
        success: true,
        message: `Added ${added} accounts`,
        added,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Benchmark] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update benchmark data' },
      { status: 500 }
    );
  }
}
