# iPhoneでアクセスする方法

このシステムをiPhoneやスマートフォンからアクセスできるようにする方法を説明します。

## 方法1: ngrok（推奨・最も簡単）

ngrokを使うと、ローカルサーバーを即座にインターネット経由でアクセスできるようにできます。

### セットアップ

1. **開発サーバーを起動**

```bash
cd frontend
npm run dev
```

2. **新しいターミナルを開いて、ngrokを起動**

```bash
ngrok http 3000
```

3. **表示されたURLにアクセス**

ngrokが起動すると、以下のようなURLが表示されます：

```
Forwarding    https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:3000
```

このURLをiPhoneのSafariやChromeで開けば、アプリにアクセスできます！

### 注意点

- **無料版の制限**: ngrokの無料版は8時間でセッションが切れます
- **セキュリティ**: 生成されたURLは誰でもアクセスできるので、使用後は停止してください（Ctrl+C）
- **認証追加**: ngrokで `--basic-auth "user:pass"` オプションを使えば、パスワード保護できます

```bash
ngrok http 3000 --basic-auth "admin:yourpassword"
```

---

## 方法2: 同じWi-Fi内でアクセス

同じWi-Fiネットワークに接続している場合、IPアドレスで直接アクセスできます。

### セットアップ

1. **PCのIPアドレスを確認**

Windows PowerShellで:
```bash
ipconfig
```

「IPv4 アドレス」を確認（例: `192.168.1.100`）

2. **Next.jsの設定を変更**

`package.json`の`dev`スクリプトを変更:

```json
"dev": "next dev -H 0.0.0.0"
```

3. **サーバーを起動**

```bash
npm run dev
```

4. **iPhoneからアクセス**

Safari/Chromeで以下のURLを開く:
```
http://192.168.1.100:3000
```
（192.168.1.100の部分は自分のIPアドレスに置き換え）

### 注意点

- **同じWi-Fi必須**: PCとiPhoneが同じネットワークに接続している必要があります
- **ファイアウォール**: Windowsファイアウォールでポート3000を許可する必要があるかもしれません

---

## 方法3: Vercelにデプロイ（本番環境）

継続的に使う場合は、Vercelに無料でデプロイできます。

### セットアップ

1. **GitHubにプッシュ**

```bash
cd frontend
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

2. **Vercelにデプロイ**

- [Vercel](https://vercel.com/)にアクセス
- GitHubアカウントでログイン
- 「Import Project」をクリック
- リポジトリを選択
- `frontend`フォルダをルートディレクトリとして設定
- 「Deploy」をクリック

3. **環境変数を設定**

Vercelのダッシュボードで、以下の環境変数を設定:

- X API認証情報は設定画面から入力できるので、環境変数は不要
- 必要に応じて `ENCRYPTION_KEY` を設定

4. **デプロイ完了**

Vercelが自動的にURLを生成します（例: `https://your-app.vercel.app`）

### 注意点

- **サーバーサイド処理**: スケジューラーなどのバックグラウンド処理はVercelでは動作しません
- **代替案**: スケジューラーを使う場合は、Railway、Render、Herokuなどを検討してください

---

## 推奨フロー

### 開発・テスト中
→ **方法1（ngrok）** または **方法2（同じWi-Fi）**

### 本番運用
→ **方法3（Vercel）** + 別サーバーでスケジューラー実行

---

## セキュリティのベストプラクティス

1. **認証を追加**: 本番環境では必ずパスワード保護を追加
2. **HTTPS使用**: ngrokやVercelは自動的にHTTPSを提供
3. **認証情報の管理**: X APIキーは絶対にGitHubにプッシュしない
4. **定期的な監視**: アクセスログを確認

---

## トラブルシューティング

### iPhoneからアクセスできない

1. PCとiPhoneが同じWi-Fiに接続されているか確認
2. Windowsファイアウォールでポート3000を許可
3. ブラウザのキャッシュをクリア

### ngrokのセッションが切れる

無料版は8時間制限があります。再度 `ngrok http 3000` を実行してください。

### スマホで表示が崩れる

このアプリはレスポンシブデザインになっているので、基本的には問題ありませんが、
もし問題があれば、ブラウザの「デスクトップサイトをリクエスト」を試してください。
