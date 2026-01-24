/**
 * Obsidian Integration Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Obsidian API', () => {
  test('GET /api/obsidian - Vault接続状態確認', async ({ request }) => {
    const response = await request.get('/api/obsidian');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('vaultPath');
    expect(data).toHaveProperty('autoSaveEnabled');
    expect(['connected', 'disconnected']).toContain(data.status);
  });

  test('POST /api/obsidian - アイデア保存', async ({ request }) => {
    const response = await request.post('/api/obsidian', {
      data: {
        action: 'save_idea',
        title: 'Playwright Test Idea',
        content: 'This is a test idea created by Playwright.',
        tags: ['test', 'playwright'],
      },
    });

    // Vaultアクセス可能なら200、不可なら503
    expect([200, 503]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.filePath).toBeDefined();
    }
  });

  test('POST /api/obsidian - ダイジェスト生成', async ({ request }) => {
    const response = await request.post('/api/obsidian', {
      data: {
        action: 'generate_digest',
      },
    });

    expect([200, 503]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.digest).toBeDefined();
      expect(data.digest.date).toBeDefined();
      expect(data.digest.contentGenerated).toBeDefined();
    }
  });

  test('POST /api/obsidian - 不正なアクション', async ({ request }) => {
    const response = await request.post('/api/obsidian', {
      data: {
        action: 'invalid_action',
      },
    });

    // Vaultアクセス不可なら503、可能で不正アクションなら400
    expect([400, 503]).toContain(response.status());
  });
});
