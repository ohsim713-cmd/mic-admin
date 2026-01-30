import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 並列実行（高速化）
    pool: 'threads',
    // グローバル
    globals: true,
    // テストファイル
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // 除外
    exclude: ['node_modules', '.next', 'e2e', 'tests'],
  },
})
