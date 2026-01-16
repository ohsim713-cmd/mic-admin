/**
 * 自動学習ジョブ
 * 成功パターンを分析して学習
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://frontend-kohl-eight-glnhg9tp79.vercel.app';

export async function autoLearn() {
  const startTime = Date.now();

  try {
    console.log(`[AutoLearn] Calling ${VERCEL_URL}/api/cron/auto-learn`);

    const response = await fetch(`${VERCEL_URL}/api/cron/auto-learn`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
      },
    });

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    console.log(`[AutoLearn] Completed in ${processingTime}ms:`, result);

    return {
      success: response.ok,
      timestamp: new Date().toISOString(),
      processingTime,
      result,
    };
  } catch (error: any) {
    console.error('[AutoLearn] Error:', error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      error: error.message,
    };
  }
}
