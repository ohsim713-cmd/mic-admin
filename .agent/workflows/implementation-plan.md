---
description: SNS自動生成ツール - 実装計画書 (改訂版 2026-01-12)
---

# 📋 SNS自動生成ツール - 実装計画書 (Parallel Agent Phase)

**更新日**: 2026-01-12
**フェーズ**: 「自動生成ツール」から「自律型AIチーム (Manus-Style)」への進化。
**開発体制**: Claude Code 4台並列体制による爆速開発。

---

## 🎯 最終目標: 1日3件の問い合わせを自律的に獲得する
人間に代わり、AIのCXOチーム（CEO, CMO, COO, Creative）がアカウントを完全運用し、目標達成まで試行錯誤し続ける。

## 📊 並列開発マイルストーン

### 🟢 Phase 1: 自律の基礎 (Day 1)
- [ ] LangGraphによる「作成・検閲・修正」ループの完成。
- [ ] Google Search 連携による「今日」のネタの自動取得。
- [ ] 各エージェント（役員）の人格設定の反映。

### 🟡 Phase 2: 体験のプレミアム化 (Day 2-3)
- [ ] Manus風の自律稼働ログUIの実装。
- [ ] Google Cloud TTS による高品質音声の統合。
- [ ] インプレッション/クリック数に基づく「AI反省会」ロジック。

### 🔴 Phase 3: 全業種対応 & スケール (Day 4-5)
- [ ] ナレッジベースのプラグイン化（ネイル、求人、不動産など）。
- [ ] 複数アカウントの同時自律運用。

---

## 🛠️ 技術スタック
- **Engine**: LangGraph.js / LangChain
- **LLM**: Gemini 1.5/2.0/3.0 Flash & Pro
- **Storage**: File-based Knowledge / Vercel KV (予定)
- **UI**: Next.js 14 (App Router) / Lucide / Glassmorphism

---

## 💡 開発へのアドバイス (for Claude Team)
各インスタンスは `PARALLEL_DEV_GUIDE.md` に従え。
全体の設計思想は `AGENT_ARCHITECTURE.md` にある。
互いの領域を尊重しつつ、統合された「一つの自律体」を作り上げること。
