import { NextRequest, NextResponse } from 'next/server';
import { generatePostsForAllAccounts, generateDMPostForAccount } from '@/lib/dm-hunter/generator';
import { checkQuality } from '@/lib/dm-hunter/quality-checker';
import {
  postToAllAccounts,
  postToTwitterAccount,
  checkAllAccountsStatus,
  ACCOUNTS,
  AccountType
} from '@/lib/dm-hunter/sns-adapter';

// POST: 自動実行（3アカウント同時投稿）
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false, secret, account } = body;

    // 認証チェック（オプション）
    const expectedSecret = process.env.AUTO_POST_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    console.log('[DM Hunter] Starting auto-run...');

    // 単一アカウント指定の場合
    if (account) {
      return await runSingleAccount(account as AccountType, dryRun, startTime);
    }

    // 全アカウント実行
    return await runAllAccounts(dryRun, startTime);

  } catch (error: any) {
    console.error('[DM Hunter] Auto-run error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime,
    }, { status: 500 });
  }
}

// 単一アカウント実行
async function runSingleAccount(account: AccountType, dryRun: boolean, startTime: number) {
  console.log(`[DM Hunter] Generating post for ${account}...`);

  // 投稿生成（最大3回リトライ）
  let post = await generateDMPostForAccount(account);
  let score = checkQuality(post.text);
  let attempts = 1;

  while (!score.passed && attempts < 3) {
    console.log(`[DM Hunter] Retry ${attempts} for ${account}...`);
    post = await generateDMPostForAccount(account);
    score = checkQuality(post.text);
    attempts++;
  }

  if (!score.passed) {
    return NextResponse.json({
      success: false,
      account,
      error: 'No post passed quality check after 3 attempts',
      score,
    });
  }

  // ドライラン
  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      account,
      post: {
        text: post.text,
        target: post.target.label,
        benefit: post.benefit.label,
      },
      score,
      processingTime: Date.now() - startTime,
    });
  }

  // 投稿実行
  const result = await postToTwitterAccount(post.text, account);

  // ログ保存
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  await fetch(`${baseUrl}/api/dm-hunter/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: post.text,
      target: post.target.label,
      benefit: post.benefit.label,
      account: account,
      score: score.total,
      results: [result],
    }),
  }).catch(() => {});

  return NextResponse.json({
    success: result.success,
    account,
    post: {
      text: post.text,
      target: post.target.label,
      benefit: post.benefit.label,
    },
    score,
    result,
    processingTime: Date.now() - startTime,
  });
}

// 全アカウント実行
async function runAllAccounts(dryRun: boolean, startTime: number) {
  console.log('[DM Hunter] Generating posts for all accounts...');

  // 3アカウント分の投稿を生成
  const generated = await generatePostsForAllAccounts();

  // 各投稿の品質チェック
  const postsWithScore = generated.map(({ account, post }) => ({
    account,
    post,
    score: checkQuality(post.text),
  }));

  // 品質チェックを通過したもののみ
  const validPosts = postsWithScore.filter(p => p.score.passed);

  if (validPosts.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No posts passed quality check',
      details: postsWithScore.map(p => ({
        account: p.account,
        score: p.score.total,
        passed: p.score.passed,
      })),
    });
  }

  // ドライラン
  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      posts: postsWithScore.map(p => ({
        account: p.account,
        accountName: ACCOUNTS.find(a => a.id === p.account)?.name,
        text: p.post.text,
        target: p.post.target.label,
        benefit: p.post.benefit.label,
        score: p.score,
      })),
      processingTime: Date.now() - startTime,
    });
  }

  // 投稿実行
  console.log('[DM Hunter] Posting to all accounts...');
  const postData = validPosts.map(p => ({
    account: p.account,
    text: p.post.text,
  }));

  const results = await postToAllAccounts(postData);

  // ログ保存
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  for (const p of validPosts) {
    const result = results.find(r => r.account.includes(ACCOUNTS.find(a => a.id === p.account)?.handle || ''));
    await fetch(`${baseUrl}/api/dm-hunter/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: p.post.text,
        target: p.post.target.label,
        benefit: p.post.benefit.label,
        account: p.account,
        score: p.score.total,
        results: result ? [result] : [],
      }),
    }).catch(() => {});
  }

  const successCount = results.filter(r => r.success).length;
  const processingTime = Date.now() - startTime;

  console.log(`[DM Hunter] Completed: ${successCount}/${results.length} posted in ${processingTime}ms`);

  return NextResponse.json({
    success: successCount > 0,
    message: `Posted to ${successCount}/${results.length} accounts`,
    posts: postsWithScore.map(p => ({
      account: p.account,
      accountName: ACCOUNTS.find(a => a.id === p.account)?.name,
      text: p.post.text.substring(0, 100) + '...',
      target: p.post.target.label,
      benefit: p.post.benefit.label,
      score: p.score.total,
    })),
    results,
    processingTime,
  });
}

// GET: ステータス確認
export async function GET() {
  try {
    // アカウント状態を確認
    const accountsStatus = await checkAllAccountsStatus();

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    let stats = { todayPosts: 0, todaySuccess: 0 };
    try {
      const logsRes = await fetch(`${baseUrl}/api/dm-hunter/logs?today=true`);
      const logsData = await logsRes.json();
      stats = logsData.stats || stats;
    } catch {}

    return NextResponse.json({
      status: 'ready',
      accounts: accountsStatus,
      todayPosts: stats.todayPosts,
      todaySuccess: stats.todaySuccess,
      scheduledTimes: ['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'],
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      accounts: ACCOUNTS.map(a => ({
        account: a.id,
        name: a.name,
        handle: a.handle,
        connected: false,
        error: 'Status check failed',
      })),
      todayPosts: 0,
      todaySuccess: 0,
      scheduledTimes: ['07:00', '12:00', '18:00', '20:00', '22:00', '24:00'],
    });
  }
}
