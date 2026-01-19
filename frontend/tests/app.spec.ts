import { test, expect } from '@playwright/test';

/**
 * ホームページの基本テスト
 */
test.describe('ホームページ', () => {
    test('ページが正常に読み込まれる', async ({ page }) => {
        await page.goto('/');

        // ページタイトルを確認
        await expect(page).toHaveTitle(/SNS自動生成ツール|チャットレディ求人増加システム/);
    });

    test('ナビゲーションが機能する', async ({ page }) => {
        await page.goto('/');

        // ナビゲーションリンクが存在することを確認
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
    });
});

/**
 * X投稿生成ページのテスト
 */
test.describe('X投稿生成', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/x');
    });

    test('投稿生成フォームが表示される', async ({ page }) => {
        // フォーム要素の確認
        await expect(page.locator('form')).toBeVisible();
        await expect(page.getByRole('button', { name: /生成/i })).toBeVisible();
    });

    test('投稿を生成できる', async ({ page }) => {
        // テーマを入力
        const themeInput = page.locator('input[name="theme"], textarea[name="theme"]');
        await themeInput.fill('チャットレディの魅力について');

        // 生成ボタンをクリック
        const generateButton = page.getByRole('button', { name: /生成/i });
        await generateButton.click();

        // 生成結果を待つ(最大30秒)
        await page.waitForSelector('[data-testid="generated-post"], .generated-content', {
            timeout: 30000,
            state: 'visible'
        });

        // 生成されたコンテンツが表示されることを確認
        const generatedContent = page.locator('[data-testid="generated-post"], .generated-content');
        await expect(generatedContent).toBeVisible();
        await expect(generatedContent).not.toBeEmpty();
    });

    test('エラーハンドリングが機能する', async ({ page }) => {
        // 空のフォームで生成を試みる
        const generateButton = page.getByRole('button', { name: /生成/i });
        await generateButton.click();

        // エラーメッセージが表示されることを確認
        const errorMessage = page.locator('[role="alert"], .error-message');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });
});

/**
 * Instagram投稿生成ページのテスト
 */
test.describe('Instagram投稿生成', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/instagram');
    });

    test('ページが正常に読み込まれる', async ({ page }) => {
        await expect(page).toHaveURL(/\/instagram/);
    });

    test('画像アップロード機能が存在する', async ({ page }) => {
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeVisible();
    });
});

/**
 * WordPress記事生成ページのテスト
 */
test.describe('WordPress記事生成', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/wordpress');
    });

    test('ページが正常に読み込まれる', async ({ page }) => {
        await expect(page).toHaveURL(/\/wordpress/);
    });

    test('記事生成フォームが表示される', async ({ page }) => {
        await expect(page.locator('form')).toBeVisible();
    });
});

/**
 * レスポンシブデザインのテスト
 */
test.describe('レスポンシブデザイン', () => {
    test('モバイルビューで正常に表示される', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // ページが正常に表示されることを確認
        await expect(page.locator('body')).toBeVisible();
    });

    test('タブレットビューで正常に表示される', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/');

        await expect(page.locator('body')).toBeVisible();
    });
});

/**
 * アクセシビリティテスト
 */
test.describe('アクセシビリティ', () => {
    test('キーボードナビゲーションが機能する', async ({ page }) => {
        await page.goto('/');

        // Tabキーでフォーカスを移動
        await page.keyboard.press('Tab');

        // フォーカス可能な要素が存在することを確認
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
});
