import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright設定ファイル
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests',

    /* 並列実行の設定 */
    fullyParallel: true,

    /* CI環境でのみfail fast */
    forbidOnly: !!process.env.CI,

    /* リトライ設定 */
    retries: process.env.CI ? 2 : 0,

    /* 並列ワーカー数 */
    workers: process.env.CI ? 1 : undefined,

    /* レポーター設定 */
    reporter: [
        ['html'],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }]
    ],

    /* 共通設定 */
    use: {
        /* ベースURL */
        baseURL: 'http://localhost:3000',

        /* スクリーンショット設定 */
        screenshot: 'only-on-failure',

        /* ビデオ設定 */
        video: 'retain-on-failure',

        /* トレース設定 */
        trace: 'on-first-retry',
    },

    /* プロジェクト設定 */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },

        /* モバイルテスト */
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
    ],

    /* 開発サーバー設定 */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
