# 🧪 テストガイド - Claude Codeでのテスト方法

## 📋 目次
1. [テスト環境のセットアップ](#テスト環境のセットアップ)
2. [テストの実行方法](#テストの実行方法)
3. [テストの種類](#テストの種類)
4. [デバッグ方法](#デバッグ方法)
5. [CI/CDへの統合](#cicdへの統合)

---

## 🚀 テスト環境のセットアップ

### 1. Playwrightブラウザのインストール

```bash
# Playwrightブラウザをインストール
npx playwright install

# 依存関係も含めてインストール
npx playwright install --with-deps
```

### 2. 環境変数の設定

テスト用の環境変数を `.env.test` に設定:

```bash
# .env.test
NEXT_PUBLIC_API_URL=http://localhost:3000
GEMINI_API_KEY=your_test_api_key
```

---

## 🎯 テストの実行方法

### 基本的なテスト実行

```bash
# すべてのテストを実行
npm run test

# 特定のテストファイルのみ実行
npm run test tests/app.spec.ts

# 特定のテストケースのみ実行
npm run test -g "投稿を生成できる"
```

### UIモードでのテスト実行(推奨)

```bash
# UIモードで実行(視覚的にテストを確認できる)
npm run test:ui
```

**UIモードの利点:**
- ✅ テストの実行状況をリアルタイムで確認
- ✅ 各ステップでのスクリーンショットを表示
- ✅ デバッグが容易
- ✅ テストの再実行が簡単

### ブラウザを表示してテスト

```bash
# ヘッドレスモードではなく、ブラウザを表示してテスト
npm run test:headed
```

### デバッグモード

```bash
# デバッガーを使用してステップ実行
npm run test:debug
```

### テストレポートの表示

```bash
# HTMLレポートを表示
npm run test:report
```

---

## 📊 テストの種類

### 1. **E2Eテスト** (`tests/app.spec.ts`)

ユーザーの実際の操作をシミュレート:

```typescript
test('投稿を生成できる', async ({ page }) => {
  await page.goto('/x');
  await page.fill('input[name="theme"]', 'テストテーマ');
  await page.click('button:has-text("生成")');
  await expect(page.locator('.generated-content')).toBeVisible();
});
```

### 2. **APIテスト** (`tests/api.spec.ts`)

APIエンドポイントの動作を検証:

```typescript
test('API経由で投稿を生成できる', async ({ request }) => {
  const response = await request.post('/api/generate', {
    data: { theme: 'テストテーマ' }
  });
  expect(response.ok()).toBeTruthy();
});
```

### 3. **レスポンシブテスト**

異なる画面サイズでの動作を確認:

```typescript
test('モバイルで正常に表示', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  // テスト内容...
});
```

---

## 🐛 デバッグ方法

### 1. **Playwright Inspector を使用**

```bash
npm run test:debug
```

- ステップバイステップでテストを実行
- DOM要素を検査
- セレクターをテスト

### 2. **スクリーンショットを撮る**

```typescript
test('デバッグ用スクリーンショット', async ({ page }) => {
  await page.goto('/x');
  await page.screenshot({ path: 'debug-screenshot.png' });
});
```

### 3. **コンソールログを確認**

```typescript
test('コンソールログを監視', async ({ page }) => {
  page.on('console', msg => console.log('Browser:', msg.text()));
  await page.goto('/');
});
```

### 4. **ネットワークリクエストを監視**

```typescript
test('APIリクエストを監視', async ({ page }) => {
  page.on('request', request => 
    console.log('Request:', request.url())
  );
  page.on('response', response => 
    console.log('Response:', response.status())
  );
  await page.goto('/');
});
```

---

## 🔧 テストのカスタマイズ

### 特定のブラウザでのみテスト

```bash
# Chromiumのみ
npx playwright test --project=chromium

# Firefoxのみ
npx playwright test --project=firefox

# モバイルChromeのみ
npx playwright test --project="Mobile Chrome"
```

### 並列実行の制御

```bash
# ワーカー数を指定
npx playwright test --workers=4

# シリアル実行(1つずつ)
npx playwright test --workers=1
```

### タイムアウトの調整

```typescript
test('長時間かかるテスト', async ({ page }) => {
  test.setTimeout(60000); // 60秒
  // テスト内容...
});
```

---

## 📈 テストレポート

### HTMLレポート

テスト実行後、自動的に生成されます:

```bash
npm run test:report
```

レポートには以下が含まれます:
- ✅ テスト結果の概要
- 📸 失敗時のスクリーンショット
- 🎥 失敗時のビデオ
- 📊 実行時間の統計

### JSONレポート

`test-results/results.json` に出力されます。
CI/CDパイプラインでの解析に使用できます。

---

## 🚀 CI/CDへの統合

### GitHub Actions の例

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npm run test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 💡 ベストプラクティス

### 1. **テストの独立性を保つ**

```typescript
test.beforeEach(async ({ page }) => {
  // 各テストの前に初期状態にリセット
  await page.goto('/');
});
```

### 2. **適切なセレクターを使用**

```typescript
// ❌ 悪い例: 脆弱なセレクター
await page.click('.btn-primary');

// ✅ 良い例: 安定したセレクター
await page.click('[data-testid="generate-button"]');
await page.getByRole('button', { name: '生成' }).click();
```

### 3. **待機を適切に使用**

```typescript
// ✅ 要素が表示されるまで待つ
await page.waitForSelector('[data-testid="result"]');

// ✅ ネットワークリクエストの完了を待つ
await page.waitForResponse(response => 
  response.url().includes('/api/generate')
);
```

### 4. **テストデータを外部化**

```typescript
const testData = {
  validTheme: 'チャットレディの魅力',
  invalidTheme: '',
  expectedLength: 280
};

test('有効なテーマで投稿生成', async ({ page }) => {
  await page.fill('input', testData.validTheme);
  // ...
});
```

---

## 🎓 よくある問題と解決方法

### 問題1: テストがタイムアウトする

**解決方法:**
```typescript
test.setTimeout(60000); // タイムアウトを延長
```

### 問題2: 要素が見つからない

**解決方法:**
```typescript
// 要素が表示されるまで待つ
await page.waitForSelector('[data-testid="element"]', {
  state: 'visible',
  timeout: 10000
});
```

### 問題3: APIレスポンスが遅い

**解決方法:**
```typescript
// モックレスポンスを使用
await page.route('/api/generate', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ post: 'モック投稿' })
  });
});
```

---

## 📚 参考リンク

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Playwrightベストプラクティス](https://playwright.dev/docs/best-practices)
- [Next.jsテストガイド](https://nextjs.org/docs/testing)

---

## 🎯 次のステップ

1. ✅ `npm run test:ui` でテストを実行
2. ✅ テスト結果を確認
3. ✅ 失敗したテストをデバッグ
4. ✅ 新しいテストケースを追加
5. ✅ CI/CDパイプラインに統合

---

**Happy Testing! 🚀**
