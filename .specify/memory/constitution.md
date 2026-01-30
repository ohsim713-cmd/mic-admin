# charged-tyson Constitution

## Core Principles

### I. SNS自動化優先
- 投稿文は200-270文字（Twitter API制限280文字以内）
- ハッシュタグ禁止、絵文字は1-2個まで
- 最後にCTA（「DMで」など）を含める

### II. アカウント分離
- tt_liver: ライバー事務所向け（配信者募集、副業、自由な働き方）
- chatre: チャットレディ事務所向け（高収入、在宅ワーク）
- 各アカウントは独立したプロンプトと設定を持つ

### III. API統合
- Gemini API (gemini-3-flash-preview) でコンテンツ生成
- Canva API で画像生成
- Twitter/X API で投稿
- Remotion で動画生成

### IV. 品質管理
- 投稿前に重複チェック（posts_history.json）
- LangGraphで品質チェック
- テスト駆動開発を推奨

## 技術スタック

- Next.js 15 + TypeScript
- フロントエンドは frontend/ ディレクトリ
- 環境変数で機密情報を管理

## 開発ワークフロー

1. Spec-Kit で仕様定義
2. 計画作成
3. タスク分解
4. 実装・テスト

**Version**: 1.0.0 | **Ratified**: 2026-01-27 | **Last Amended**: 2026-01-27
