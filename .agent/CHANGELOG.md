# 変更ログ

各Claude Codeが行った変更を時系列で記録。

---

## 2026-01-12

### 10:15 - Claude #2
**GitHub Actions定期投稿スケジューラー**

追加:
- `.github/workflows/auto-post.yml` - Vercel Cron代替の定期実行

機能:
- 1日4回の自動投稿 (7:00, 12:00, 18:00, 21:00 JST)
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
