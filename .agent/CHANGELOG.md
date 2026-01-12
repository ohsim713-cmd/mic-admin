# 変更ログ

各Claude Codeが行った変更を時系列で記録。

---

## 2026-01-12

### 12:00 - Claude #4
**投稿効果測定機能**

追加:
- `frontend/app/api/metrics/route.ts` - エンゲージメント取得API
- `frontend/app/metrics/page.tsx` - 効果測定ダッシュボードUI
- `frontend/knowledge/post_metrics.json` - メトリクス保存（自動生成）

変更:
- `frontend/app/auto-post/page.tsx` - 効果測定ページへのリンク追加

機能:
- X APIからいいね/RT/返信/インプレッションを取得
- サマリービュー（合計/平均/エンゲージメント率）
- 投稿一覧ビュー（メトリクス付き）
- タイプ別パフォーマンス分析
- 手動メトリクス更新ボタン

アクセス:
- `/metrics` または `/auto-post` から「効果測定」ボタン

### 11:30 - Claude #1
**GitHub Actions 1日15投稿対応**

変更:
- `.github/workflows/auto-post.yml` - 4回→15回のスケジュールに拡張

スケジュール（全15スロット）:
```
 6:30 おはよう    | 12:45 軽い話題  | 20:00 求人
 7:30 ノウハウ    | 14:00 実績      | 21:00 成功事例
 8:30 Q&A         | 15:30 不安解消  | 21:45 本音
10:00 体験談      | 17:30 共感      | 22:30 クロージング
12:00 共感        | 18:30 メリット  | 23:30 夜向け
```

### 10:15 - Claude #2
**GitHub Actions定期投稿スケジューラー**

追加:
- `.github/workflows/auto-post.yml` - Vercel Cron代替の定期実行

機能:
- 1日15回の自動投稿（上記で拡張済み）
- 時間帯に応じた適切なスロット選択
- 手動実行サポート (workflow_dispatch)
- ドライランモード対応

設定方法:
- GitHub Secrets に `VERCEL_DEPLOY_URL` を設定
- オプション: `AUTO_POST_SECRET` で認証

### 08:30 - Claude #1
**LangGraph自動投稿実装**

追加:
- `frontend/lib/langgraph/` - 投稿フローグラフ
- `frontend/app/auto-post/page.tsx` - 管理UI

変更:
- `frontend/app/api/auto-post/route.ts` - LangGraph対応
- `frontend/app/components/Sidebar.tsx` - 自動投稿リンク追加

動作:
```
POST /api/auto-post → LangGraphで投稿
GET /api/auto-post → 状態確認
```

### 07:00 - Claude #1
**Agent Factory Phase 1**

追加:
- `frontend/lib/agents/` - 4 Agent基盤
- `frontend/app/api/agents/` - Agent API群
- `frontend/app/dashboard/` - ダッシュボードUI
- `frontend/knowledge/agent_state.json` 他

### 以前
- OAuth実装 (X, YouTube)
- 設定ページUI改善
- メリット特化の投稿生成プロンプト改善

---

## 使い方

新しい変更を追加するときは、以下の形式で**先頭に追加**:

```markdown
### HH:MM - Claude #N
**タイトル**

追加:
- ファイルパス - 説明

変更:
- ファイルパス - 説明

削除:
- ファイルパス

備考:
- 注意点など
```
