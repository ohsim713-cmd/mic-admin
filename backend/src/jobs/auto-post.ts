/**
 * 自動投稿ジョブ
 * Vercelのフロントエンド API を呼び出して投稿
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://frontend-kohl-eight-glnhg9tp79.vercel.app';
const AUTO_POST_SECRET = process.env.AUTO_POST_SECRET || '';

export async function autoPost() {
  const startTime = Date.now();

  try {
    console.log(`[AutoPost] Calling ${VERCEL_URL}/api/automation/post`);

    const response = await fetch(`${VERCEL_URL}/api/automation/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: AUTO_POST_SECRET,
        dryRun: false,
      }),
    });

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    console.log(`[AutoPost] Completed in ${processingTime}ms:`, result);

    return {
      success: response.ok,
      timestamp: new Date().toISOString(),
      processingTime,
      result,
    };
  } catch (error: any) {
    console.error('[AutoPost] Error:', error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      error: error.message,
    };
  }
}
