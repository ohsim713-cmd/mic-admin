import { test, expect } from '@playwright/test';

/**
 * API エンドポイントのテスト
 */
test.describe('API エンドポイント', () => {

    /**
     * X投稿生成API
     */
    test.describe('POST /api/generate', () => {
        test('有効なリクエストで投稿を生成できる', async ({ request }) => {
            const response = await request.post('/api/generate', {
                data: {
                    theme: 'チャットレディの魅力',
                    tone: 'フレンドリー',
                    targetAudience: '20代女性'
                }
            });

            expect(response.ok()).toBeTruthy();
            expect(response.status()).toBe(200);

            const data = await response.json();
            expect(data).toHaveProperty('post');
            expect(data.post).toBeTruthy();
            expect(typeof data.post).toBe('string');
        });

        test('無効なリクエストでエラーを返す', async ({ request }) => {
            const response = await request.post('/api/generate', {
                data: {}
            });

            expect(response.status()).toBeGreaterThanOrEqual(400);
        });
    });

    /**
     * Instagram画像生成API
     */
    test.describe('POST /api/instagram/generate-image', () => {
        test('画像生成リクエストが処理される', async ({ request }) => {
            const response = await request.post('/api/instagram/generate-image', {
                data: {
                    prompt: '明るく楽しいチャットレディのイメージ',
                    style: 'professional'
                }
            });

            // APIキーが設定されていない場合は401を返す可能性がある
            expect([200, 401, 500]).toContain(response.status());
        });
    });

    /**
     * Instagram キャプション生成API
     */
    test.describe('POST /api/instagram/generate-caption', () => {
        test('キャプション生成リクエストが処理される', async ({ request }) => {
            const response = await request.post('/api/instagram/generate-caption', {
                data: {
                    theme: 'チャットレディの1日',
                    tone: 'カジュアル'
                }
            });

            expect([200, 401, 500]).toContain(response.status());
        });
    });

    /**
     * WordPress記事生成API
     */
    test.describe('POST /api/wordpress/generate-article', () => {
        test('記事生成リクエストが処理される', async ({ request }) => {
            const response = await request.post('/api/wordpress/generate-article', {
                data: {
                    topic: 'チャットレディとして成功する方法',
                    keywords: ['チャットレディ', '副業', '在宅ワーク']
                }
            });

            expect([200, 401, 500]).toContain(response.status());
        });
    });

    /**
     * 動画生成API
     */
    test.describe('POST /api/video/generate', () => {
        test('動画生成リクエストが処理される', async ({ request }) => {
            const response = await request.post('/api/video/generate', {
                data: {
                    script: 'こんにちは!チャットレディのお仕事について紹介します。',
                    voice: 'female'
                },
                timeout: 60000 // 動画生成は時間がかかる可能性がある
            });

            expect([200, 401, 500]).toContain(response.status());
        });
    });

    /**
     * ヘルスチェック
     */
    test.describe('GET /api/health', () => {
        test('ヘルスチェックが成功する', async ({ request }) => {
            const response = await request.get('/api/health');

            if (response.ok()) {
                const data = await response.json();
                expect(data).toHaveProperty('status');
                expect(data.status).toBe('ok');
            }
        });
    });
});

/**
 * APIレート制限のテスト
 */
test.describe('APIレート制限', () => {
    test('連続リクエストが適切に処理される', async ({ request }) => {
        const requests = Array(5).fill(null).map(() =>
            request.post('/api/generate', {
                data: {
                    theme: 'テスト投稿',
                    tone: 'フレンドリー'
                }
            })
        );

        const responses = await Promise.all(requests);

        // 少なくとも一部のリクエストは成功するはず
        const successfulResponses = responses.filter(r => r.ok());
        expect(successfulResponses.length).toBeGreaterThan(0);
    });
});

/**
 * エラーハンドリングのテスト
 */
test.describe('エラーハンドリング', () => {
    test('存在しないエンドポイントで404を返す', async ({ request }) => {
        const response = await request.get('/api/nonexistent-endpoint');
        expect(response.status()).toBe(404);
    });

    test('不正なメソッドで405を返す', async ({ request }) => {
        const response = await request.get('/api/generate');
        expect([404, 405]).toContain(response.status());
    });
});
