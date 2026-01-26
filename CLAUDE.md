# charged-tyson プロジェクト

## 概要
SNS自動投稿システム - チャットレディ/ライバー事務所向け求人コンテンツ自動生成

## 技術スタック
- Next.js 15 + TypeScript
- Gemini API (gemini-3-flash-preview)
- Canva API (画像生成)
- Twitter/X API
- Remotion (動画生成)

## アカウントタイプ
- **tt_liver**: ライバー事務所向け（配信者募集、副業、自由な働き方）
- **chatre**: チャットレディ事務所向け（高収入、在宅ワーク）

## 主要ディレクトリ
```
frontend/
├── app/api/
│   ├── content/instagram/  # Instagram投稿生成
│   ├── content/tiktok/     # TikTok投稿生成
│   ├── design/             # Canva画像生成
│   └── generate/x/         # X(Twitter)投稿生成
├── knowledge/
│   └── posts_history.json  # 投稿履歴
├── lib/
│   ├── dm-hunter/          # DM営業用投稿生成
│   ├── langgraph/          # LangGraph品質チェック
│   └── canva-api.ts        # Canva連携
└── remotion/               # 動画生成
```

## よく使うコマンド
```bash
# 開発サーバー起動
cd frontend && npm run dev

# TikTok投稿生成
curl http://localhost:3000/api/content/tiktok?account=tt_liver

# Instagram投稿生成
curl http://localhost:3000/api/content/instagram?account=tt_liver
```

## 投稿ルール
- 200-270文字（Twitter API制限280文字以内）
- ハッシュタグ禁止
- 絵文字は1-2個まで
- 最後にCTA（「DMで」など）

## 環境変数
- GEMINI_API_KEY
- CANVA_API_KEY / CANVA_USER_ID
- TWITTER_API_KEY_TT_LIVER / TWITTER_ACCESS_TOKEN_TT_LIVER
- ENCRYPTION_KEY

## スキル
このプロジェクトでは以下の作業が可能:
1. 投稿文の生成・改善
2. プロンプトの確認・修正
3. 投稿履歴の確認
4. コードの編集・デバッグ
5. Web検索でトレンド調査
