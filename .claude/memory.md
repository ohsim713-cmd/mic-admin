# セッション記録

## 2026-01-29

### Instagram運用
- 新アカウント: 朝日葵 (aa98.720) / aoi.asahi720@gmail.com
- 目標: 10アカウント作成
- リソース: 端末3-5台、メアド10個、WiFi5種類

### VPS (133.117.72.109)
- ClawdBot稼働中
- 認証: OAuthトークン（定期更新必要）
- Discord/Telegram両方有効

**稼働中サービス:**
| ポート | サービス |
|--------|----------|
| 3001 | Satori API（サムネ） |
| 3002 | Video API（動画） |
| 3003 | Whisper API（字幕生成） |
| 5000 | Postiz（投稿管理） |
| 50021 | VOICEVOX（音声生成） |

### スタッフ用ワークスペース
- `/root/.clawdbot-staff/` - ClawdBot設定
- `/root/clawd-staff/TOOLS.md` - ツール一覧

### 音声・字幕API
**VOICEVOX（ポート50021）**
```bash
# 音声生成（ずんだもん=3）
curl -X POST "http://133.117.72.109:50021/audio_query?text=こんにちは&speaker=3" -o query.json
curl -X POST -H "Content-Type: application/json" "http://133.117.72.109:50021/synthesis?speaker=3" -d @query.json -o voice.wav
```
- キャラ一覧: http://133.117.72.109:50021/speakers

**Whisper（ポート3003）**
```bash
# 音声→テキスト
curl -X POST -F "audio=@voice.wav" http://133.117.72.109:3003/transcribe

# SRT字幕生成
curl -X POST -F "audio=@voice.wav" http://133.117.72.109:3003/srt -o subtitle.srt
```

### TikTok/Instagram調査（RapidAPI）
- API Key: `30bdff99b9mshfab5d2727125d43p189157jsn574e512b628c`
- TikTokスクリプト: `/opt/scripts/tiktok-research.sh`
  ```bash
  # 使い方
  ./tiktok-research.sh チャットレディ 5
  ./tiktok-research.sh ライバー 10
  ```
- Instagram API: エンドポイント要調査（既存コードと不一致）

### アカウント情報
- 朝日葵 (aa98.720)
  - Email: aoi.asahi720@gmail.com
  - Password: Aoi1998July!

### ローカル設定
- Vitest導入済み（`npm test`）
- zoxide導入済み（`z`でフォルダ移動）
