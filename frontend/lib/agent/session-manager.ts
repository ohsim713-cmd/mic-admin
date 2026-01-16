/**
 * Session Manager - クッキー永続化システム
 *
 * 「社員証」の役割: ログイン状態を維持する
 *
 * - SNSごとのクッキーを暗号化して保存
 * - セッションの有効期限管理
 * - 自動リフレッシュ
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ========================================
// Types
// ========================================

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface PlatformSession {
  platform: string;
  accountId: string;
  cookies: SessionCookie[];
  localStorage?: Record<string, string>;
  lastRefreshed: string;
  expiresAt?: string;
  userAgent?: string;
}

export interface SessionStore {
  version: string;
  encryptedSessions: Record<string, string>; // platform:accountId -> encrypted data
  metadata: Record<string, {
    platform: string;
    accountId: string;
    lastUsed: string;
    isValid: boolean;
  }>;
}

// ========================================
// Encryption Helpers
// ========================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  // 環境変数から取得、なければ固定キー（開発用）
  const key = process.env.SESSION_ENCRYPTION_KEY || 'charged-tyson-session-key-32chr';
  return crypto.scryptSync(key, 'salt', 32);
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv + authTag + encrypted
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(encryptedText.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2), 'hex');
  const encrypted = encryptedText.slice(IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ========================================
// Session Manager
// ========================================

export class SessionManager {
  private store: SessionStore;
  private storePath: string;
  private sessions: Map<string, PlatformSession> = new Map();

  constructor(storePath?: string) {
    this.storePath = storePath || path.join(process.cwd(), 'data', 'sessions.enc.json');
    this.store = this.loadStore();
    this.decryptAllSessions();
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * セッションを保存
   */
  saveSession(session: PlatformSession): void {
    const key = this.getSessionKey(session.platform, session.accountId);

    session.lastRefreshed = new Date().toISOString();
    this.sessions.set(key, session);

    // 暗号化して保存
    const encrypted = encrypt(JSON.stringify(session));
    this.store.encryptedSessions[key] = encrypted;
    this.store.metadata[key] = {
      platform: session.platform,
      accountId: session.accountId,
      lastUsed: new Date().toISOString(),
      isValid: true,
    };

    this.persistStore();
    console.log(`[SessionManager] Saved session: ${session.platform}/${session.accountId}`);
  }

  /**
   * セッションを取得
   */
  getSession(platform: string, accountId: string): PlatformSession | null {
    const key = this.getSessionKey(platform, accountId);
    const session = this.sessions.get(key);

    if (!session) {
      return null;
    }

    // 有効期限チェック
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      console.log(`[SessionManager] Session expired: ${platform}/${accountId}`);
      this.invalidateSession(platform, accountId);
      return null;
    }

    // 最終使用日時を更新
    this.store.metadata[key].lastUsed = new Date().toISOString();
    this.persistStore();

    return session;
  }

  /**
   * セッションが有効か確認
   */
  isSessionValid(platform: string, accountId: string): boolean {
    const session = this.getSession(platform, accountId);
    if (!session) return false;

    const metadata = this.store.metadata[this.getSessionKey(platform, accountId)];
    return metadata?.isValid ?? false;
  }

  /**
   * セッションを無効化
   */
  invalidateSession(platform: string, accountId: string): void {
    const key = this.getSessionKey(platform, accountId);
    this.sessions.delete(key);
    delete this.store.encryptedSessions[key];

    if (this.store.metadata[key]) {
      this.store.metadata[key].isValid = false;
    }

    this.persistStore();
    console.log(`[SessionManager] Invalidated session: ${platform}/${accountId}`);
  }

  /**
   * Playwrightのコンテキスト用にクッキーを変換
   */
  getPlaywrightCookies(platform: string, accountId: string): {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }[] | null {
    const session = this.getSession(platform, accountId);
    if (!session) return null;

    return session.cookies;
  }

  /**
   * Playwrightのコンテキストからクッキーを保存
   */
  saveFromPlaywrightCookies(
    platform: string,
    accountId: string,
    cookies: SessionCookie[],
    localStorage?: Record<string, string>
  ): void {
    const session: PlatformSession = {
      platform,
      accountId,
      cookies,
      localStorage,
      lastRefreshed: new Date().toISOString(),
      // 30日後に期限切れ
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.saveSession(session);
  }

  /**
   * 全セッションの一覧
   */
  listSessions(): { platform: string; accountId: string; lastUsed: string; isValid: boolean }[] {
    return Object.values(this.store.metadata);
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  cleanup(): number {
    let cleaned = 0;

    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.sessions.delete(key);
        delete this.store.encryptedSessions[key];
        if (this.store.metadata[key]) {
          this.store.metadata[key].isValid = false;
        }
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.persistStore();
      console.log(`[SessionManager] Cleaned up ${cleaned} expired sessions`);
    }

    return cleaned;
  }

  // ========================================
  // Internal
  // ========================================

  private getSessionKey(platform: string, accountId: string): string {
    return `${platform}:${accountId}`;
  }

  private loadStore(): SessionStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load store:', error);
    }

    return {
      version: '1.0',
      encryptedSessions: {},
      metadata: {},
    };
  }

  private persistStore(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      console.error('[SessionManager] Failed to persist store:', error);
    }
  }

  private decryptAllSessions(): void {
    for (const [key, encrypted] of Object.entries(this.store.encryptedSessions)) {
      try {
        const decrypted = decrypt(encrypted);
        const session = JSON.parse(decrypted) as PlatformSession;
        this.sessions.set(key, session);
      } catch (error) {
        console.error(`[SessionManager] Failed to decrypt session ${key}:`, error);
        // 復号化に失敗したセッションは無効化
        if (this.store.metadata[key]) {
          this.store.metadata[key].isValid = false;
        }
      }
    }
  }
}

// ========================================
// Singleton
// ========================================

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
