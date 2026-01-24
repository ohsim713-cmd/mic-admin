/**
 * API エンドポイントテスト
 */

import { test, expect } from '@playwright/test';

test.describe('Design API', () => {
  test('GET /api/design/remotion - テンプレート一覧取得', async ({ request }) => {
    const response = await request.get('/api/design/remotion');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.templates).toBeDefined();
    expect(data.templates.length).toBeGreaterThan(0);
    expect(data.propsSchema).toBeDefined();
  });

  test('GET /api/design/generate - テンプレート一覧（Canva）', async ({ request }) => {
    const response = await request.get('/api/design/generate');
    // Canva認証がない場合は401
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('Canva API', () => {
  test('GET /api/canva/status - 認証状態確認', async ({ request }) => {
    const response = await request.get('/api/canva/status');
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('Content API', () => {
  test('GET /api/content/queue - コンテンツキュー取得', async ({ request }) => {
    const response = await request.get('/api/content/queue');
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('Remotion 画像生成', () => {
  test('POST /api/design/remotion - 日本語テキスト画像生成', async ({ request, page }) => {
    // 画像生成API呼び出し
    const response = await request.post('/api/design/remotion', {
      data: {
        template: 'reel',
        props: {
          topic: '日本語テスト',
          description: 'Playwrightで確認中',
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.url).toBeDefined();

    // 生成された画像をブラウザで表示して確認
    await page.goto(data.url);

    // スクリーンショットを保存
    await page.screenshot({ path: 'test-results/remotion-generated.png' });
  });

  test('生成画像の表示確認', async ({ page }) => {
    // 既存の画像を確認
    await page.goto('/generated/test_jp.png');

    // 画像が表示されることを確認
    const img = page.locator('img');
    await expect(img).toBeVisible({ timeout: 10000 });

    // スクリーンショット
    await page.screenshot({ path: 'test-results/remotion-visual-check.png' });
  });
});
