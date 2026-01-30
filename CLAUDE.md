# charged-tyson

SNS自動投稿システム（チャトレ/ライバー事務所向け）

## 技術
Next.js 15 + TypeScript / Gemini API / Twitter API / Remotion

## アカウント
- **tt_liver**: ライバー事務所
- **chatre**: チャットレディ事務所

## 学習モード: ON
解説しながら進める（何を・なぜ・応用ポイント）

## 詳細ファイル（必要時に読む）
- `.claude/user.md` - ユーザー目標・価値観
- `.claude/memory.md` - セッション記録
- `.claude/context/` - 個別トピックの詳細

## 投稿ルール
200-270文字 / ハッシュタグ禁止 / 絵文字1-2個 / 最後にCTA

## コマンド
```bash
cd frontend && npm run dev
curl http://localhost:3000/api/content/tiktok?account=tt_liver
```

## コーディングルール

### テスト
- 新機能には必ずテストを書く
- テストファイル: `*.test.ts` or `*.spec.ts`
- テスト実行: `npm test`

### 品質
- TypeScript strict mode
- 関数は単一責任
- エラーハンドリング必須
- コメントは「なぜ」を書く（「何」は書かない）

### 並列作業時
- 複数ファイル同時編集OK
- 依存関係あるタスクは順番に
- 「並列で」と言えば同時実行

### 外部ツール連携時
- 公式ドキュメントをWebFetchで確認する
- 手動作業を最小限に（CLIで完結させる）
- 設定ファイルは全て自動生成
- 動作確認まで行う

### ユーザーの手動作業を減らす
- インストールはコマンドで実行
- 設定ファイルは書き込む
- 環境変数は.envに追記
- 最後に動作確認コマンドを実行
