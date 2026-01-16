/**
 * SNS Poster - Playwright を使った実際の投稿実行
 *
 * 「手足」の役割: 実際にブラウザを操作してSNSに投稿する
 *
 * 対応プラットフォーム:
 * - Twitter/X
 * - Instagram (後日)
 * - TikTok (後日)
 * - Threads (後日)
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getSessionManager, SessionCookie } from './session-manager';
import { getExecutionVerifier, VerificationResult } from './execution-verifier';

// ========================================
// Types
// ========================================

export type Platform = 'twitter' | 'instagram' | 'tiktok' | 'threads';

export interface PostRequest {
  platform: Platform;
  accountId: string;
  text: string;
  mediaUrls?: string[];
  replyToId?: string;
}

export interface PostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  screenshot?: string; // base64
  verification?: VerificationResult;
}

export interface LoginCredentials {
  username: string;
  password: string;
  totpSecret?: string; // 2FA用
}

// ========================================
// SNS Poster
// ========================================

export class SNSPoster {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private sessionManager = getSessionManager();
  private verifier = getExecutionVerifier();

  // ========================================
  // Public API
  // ========================================

  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    console.log('[SNSPoster] Browser launched');
  }

  /**
   * ブラウザを終了
   */
  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log('[SNSPoster] Browser closed');
  }

  /**
   * 投稿を実行
   */
  async post(request: PostRequest): Promise<PostResult> {
    await this.launch();

    try {
      switch (request.platform) {
        case 'twitter':
          return await this.postToTwitter(request);
        case 'instagram':
          return await this.postToInstagram(request);
        case 'threads':
          return await this.postToThreads(request);
        default:
          return {
            success: false,
            error: `Unsupported platform: ${request.platform}`,
          };
      }
    } catch (error) {
      console.error('[SNSPoster] Post error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ログイン状態を確認
   */
  async checkLoginStatus(platform: Platform, accountId: string): Promise<boolean> {
    const session = this.sessionManager.getSession(platform, accountId);
    if (!session) return false;

    await this.launch();
    const context = await this.getContext(platform, accountId);
    const page = await context.newPage();

    try {
      switch (platform) {
        case 'twitter':
          await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded' });
          // ログインページにリダイレクトされていなければログイン済み
          const url = page.url();
          return !url.includes('login') && !url.includes('flow');

        default:
          return true;
      }
    } catch {
      return false;
    } finally {
      await page.close();
    }
  }

  /**
   * ログインを実行（クッキーを保存）
   */
  async login(
    platform: Platform,
    accountId: string,
    credentials: LoginCredentials
  ): Promise<boolean> {
    await this.launch();
    const context = await this.getContext(platform, accountId, false);
    const page = await context.newPage();

    try {
      switch (platform) {
        case 'twitter':
          return await this.loginToTwitter(page, accountId, credentials);
        default:
          return false;
      }
    } catch (error) {
      console.error('[SNSPoster] Login error:', error);
      return false;
    } finally {
      await page.close();
    }
  }

  // ========================================
  // Twitter Implementation
  // ========================================

  private async postToTwitter(request: PostRequest): Promise<PostResult> {
    const context = await this.getContext('twitter', request.accountId);
    const page = await context.newPage();

    try {
      // Twitterホームに移動
      await page.goto('https://twitter.com/compose/tweet', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // ログインチェック
      if (page.url().includes('login') || page.url().includes('flow')) {
        return {
          success: false,
          error: '認証エラー: ログインが必要です',
        };
      }

      // 投稿テキストを入力
      const tweetBox = page.locator('[data-testid="tweetTextarea_0"]');
      await tweetBox.waitFor({ timeout: 10000 });
      await tweetBox.fill(request.text);

      // 少し待つ（人間らしさ）
      await page.waitForTimeout(1000 + Math.random() * 2000);

      // 投稿ボタンをクリック
      const postButton = page.locator('[data-testid="tweetButton"]');
      await postButton.click();

      // 投稿完了を待つ
      await page.waitForTimeout(3000);

      // スクリーンショットで検証
      const screenshot = await page.screenshot({ encoding: 'base64' });
      const verification = await this.verifier.verifyFromScreenshot(
        screenshot,
        'ツイートが正常に投稿された画面'
      );

      // セッションを更新
      const cookies = await context.cookies();
      this.sessionManager.saveFromPlaywrightCookies('twitter', request.accountId, cookies as SessionCookie[]);

      if (verification.success) {
        return {
          success: true,
          verification,
          screenshot,
        };
      }

      return {
        success: false,
        error: verification.message,
        verification,
        screenshot,
      };

    } catch (error) {
      const screenshot = await page.screenshot({ encoding: 'base64' }).catch(() => undefined);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        screenshot,
      };
    } finally {
      await page.close();
    }
  }

  private async loginToTwitter(
    page: Page,
    accountId: string,
    credentials: LoginCredentials
  ): Promise<boolean> {
    try {
      await page.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // ユーザー名を入力
      const usernameInput = page.locator('input[autocomplete="username"]');
      await usernameInput.waitFor({ timeout: 10000 });
      await usernameInput.fill(credentials.username);
      await page.keyboard.press('Enter');

      await page.waitForTimeout(2000);

      // パスワードを入力
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.waitFor({ timeout: 10000 });
      await passwordInput.fill(credentials.password);
      await page.keyboard.press('Enter');

      // ログイン完了を待つ
      await page.waitForTimeout(5000);

      // ホームに移動できたか確認
      const url = page.url();
      if (url.includes('/home') || !url.includes('login')) {
        // セッションを保存
        const context = page.context();
        const cookies = await context.cookies();
        this.sessionManager.saveFromPlaywrightCookies('twitter', accountId, cookies as SessionCookie[]);

        console.log(`[SNSPoster] Twitter login successful: ${accountId}`);
        return true;
      }

      console.log(`[SNSPoster] Twitter login failed: ${accountId}`);
      return false;

    } catch (error) {
      console.error('[SNSPoster] Twitter login error:', error);
      return false;
    }
  }

  // ========================================
  // Instagram Implementation (Placeholder)
  // ========================================

  private async postToInstagram(request: PostRequest): Promise<PostResult> {
    // TODO: Instagram投稿の実装
    return {
      success: false,
      error: 'Instagram posting not yet implemented',
    };
  }

  // ========================================
  // Threads Implementation (Placeholder)
  // ========================================

  private async postToThreads(request: PostRequest): Promise<PostResult> {
    // TODO: Threads投稿の実装
    return {
      success: false,
      error: 'Threads posting not yet implemented',
    };
  }

  // ========================================
  // Context Management
  // ========================================

  private async getContext(
    platform: Platform,
    accountId: string,
    loadSession: boolean = true
  ): Promise<BrowserContext> {
    const key = `${platform}:${accountId}`;

    // 既存のコンテキストを再利用
    if (this.contexts.has(key)) {
      return this.contexts.get(key)!;
    }

    if (!this.browser) {
      throw new Error('Browser not launched');
    }

    // 新しいコンテキストを作成
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'ja-JP',
    });

    // 保存されたセッションを復元
    if (loadSession) {
      const cookies = this.sessionManager.getPlaywrightCookies(platform, accountId);
      if (cookies) {
        await context.addCookies(cookies);
        console.log(`[SNSPoster] Restored session: ${platform}/${accountId}`);
      }
    }

    this.contexts.set(key, context);
    return context;
  }
}

// ========================================
// Singleton
// ========================================

let snsPosterInstance: SNSPoster | null = null;

export function getSNSPoster(): SNSPoster {
  if (!snsPosterInstance) {
    snsPosterInstance = new SNSPoster();
  }
  return snsPosterInstance;
}
