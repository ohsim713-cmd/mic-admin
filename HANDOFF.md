# HANDOFF.md - charged-tyson → Obsidian 移行完了

## 概要
2026-01-27にcharged-tysonからObsidianへのナレッジ移行を実施。
今後はPostiz + Clawdbot + Obsidianで運用。

## 新運用フロー
```
Obsidian (知識) → Clawdbot (生成) → Postiz (予約) → X投稿
```

## 停止したもの
- **GitHub Actions** (`full-automation.yml`) - スケジュールをコメントアウト済み
- **Vercel Pro** - 解約OK
- **charged-tysonサーバー** - 使わない

## Obsidianに移行済みナレッジ
場所: `~/Documents/Obsidian/SecondBrain/Clawd/`

```
Clawd/
├── README.md (インデックス)
├── 運用ルール.md
├── SNS運用/
│   ├── クロージング投稿.md (1日3回ルール)
│   └── クロージングテンプレート.md
└── ナレッジ/
    ├── 成功パターン.md (スコア8-9の投稿パターン)
    ├── 失敗パターン.md (避けるべき表現)
    ├── チャトレ業界知識.md (サイト別特徴)
    ├── ライバー業界知識.md (アプリ別攻略)
    ├── チャトレトレンド2026.md (業界トレンド・収入目安)
    ├── バズ投稿ストック.md (高エンゲージ投稿のお手本)
    ├── 競合サイト分析.md (競合サイト特徴・差別化)
    ├── X運用戦略.md (アルゴリズム2025・投稿時間)
    ├── 求人コピー集.md (ヘッドライン公式)
    ├── ストチャ攻略.md (Stripchat収益最大化)
    └── アカウントスタイル.md (ターゲット別トーン・配色)
```

## 投稿ルール
- **敬語（ですます調）**
- **DM誘導はクロージング投稿のみ**（1日3回: 12:00, 18:00, 22:00頃）
- それ以外は価値提供のみ（DM誘導なし）
- ハッシュタグ禁止（または1-2個に厳選）
- 絵文字1-2個

## Postiz API
- URL: http://localhost:4007
- X Integration ID: `cmkvaapmf0001l2rtbtfqjlpw`
- ログイン: ohsim.713@gmail.com / ohsim713

## 使い分けルール
| 用途 | 使うもの |
|------|----------|
| 投稿文を作る時 | Obsidian（深い知識・感覚） |
| 投稿を予約する時 | Postiz API |
| 履歴を記録する時 | ファイル（JSON） |
| 設定・認証情報 | ファイル |

## charged-tyson（参照用に残す）
- パス: `~/.gemini/antigravity/playground/charged-tyson/`
- `frontend/knowledge/*.json` - 元データとして保持（posts_history.json等）
- サーバーは起動不要

## 投稿作成フロー
1. Obsidianのナレッジを読む（README.md参照）
2. ターゲット・投稿タイプを決める
3. 成功パターン/失敗パターンを参考に作成
4. Postiz APIで予約

---
作成: Clawdbot (2026-01-27)
