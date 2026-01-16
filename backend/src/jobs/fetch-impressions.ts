/**
 * インプレッション取得ジョブ
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://frontend-kohl-eight-glnhg9tp79.vercel.app';

export async function fetchImpressions() {
  const startTime = Date.now();

  try {
    console.log(`[FetchImpressions] Calling ${VERCEL_URL}/api/cron/fetch-impressions`);

    const response = await fetch(`${VERCEL_URL}/api/cron/fetch-impressions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
      },
    });

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    console.log(`[FetchImpressions] Completed in ${processingTime}ms:`, result);

    return {
      success: response.ok,
      timestamp: new Date().toISOString(),
      processingTime,
      result,
    };
  } catch (error: any) {
    console.error('[FetchImpressions] Error:', error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      error: error.message,
    };
  }
}
