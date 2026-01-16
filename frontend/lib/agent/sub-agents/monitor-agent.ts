/**
 * Monitor Agent - 24時間365日監視システム
 *
 * 機能:
 * - 競合サイト定期監視
 * - SNSトレンド検知
 * - 価格変動アラート
 * - 新規コンテンツ検知
 */

import { getPlaywrightAgent, MonitorTarget, ScrapeResult } from './playwright-agent';
import { getVectorMemory } from '../../database/vector-memory';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// ========================================
// Types
// ========================================

export interface MonitorConfig {
  targets: MonitorTarget[];
  checkInterval: number;  // minutes
  alertThreshold: number; // 変更率%
  enabled: boolean;
}

export interface MonitorAlert {
  id: string;
  targetName: string;
  targetUrl: string;
  type: 'content_change' | 'new_content' | 'price_change' | 'trend_detected';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details?: string;
  detectedAt: string;
  acknowledged: boolean;
}

export interface MonitorStats {
  totalChecks: number;
  alertsToday: number;
  lastCheck: string;
  uptimeHours: number;
  targetsActive: number;
}

// ========================================
// Monitor Agent
// ========================================

export class MonitorAgent {
  private config: MonitorConfig;
  private alerts: MonitorAlert[] = [];
  private stats: MonitorStats;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'monitor');

    // データディレクトリ作成
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }

    // 設定読み込み
    this.config = this.loadConfig();
    this.stats = this.loadStats();
    this.alerts = this.loadAlerts();
  }

  // ========================================
  // 設定管理
  // ========================================

  private loadConfig(): MonitorConfig {
    const configPath = path.join(this.dataPath, 'config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    return {
      targets: [],
      checkInterval: 60, // 1時間
      alertThreshold: 10,
      enabled: true,
    };
  }

  private saveConfig(): void {
    const configPath = path.join(this.dataPath, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  private loadStats(): MonitorStats {
    const statsPath = path.join(this.dataPath, 'stats.json');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }
    return {
      totalChecks: 0,
      alertsToday: 0,
      lastCheck: '',
      uptimeHours: 0,
      targetsActive: 0,
    };
  }

  private saveStats(): void {
    const statsPath = path.join(this.dataPath, 'stats.json');
    fs.writeFileSync(statsPath, JSON.stringify(this.stats, null, 2));
  }

  private loadAlerts(): MonitorAlert[] {
    const alertsPath = path.join(this.dataPath, 'alerts.json');
    if (fs.existsSync(alertsPath)) {
      return JSON.parse(fs.readFileSync(alertsPath, 'utf-8'));
    }
    return [];
  }

  private saveAlerts(): void {
    const alertsPath = path.join(this.dataPath, 'alerts.json');
    // 直近100件のみ保持
    fs.writeFileSync(alertsPath, JSON.stringify(this.alerts.slice(-100), null, 2));
  }

  // ========================================
  // 監視対象管理
  // ========================================

  /**
   * 監視対象を追加
   */
  addTarget(target: Omit<MonitorTarget, 'lastChecked' | 'lastContent'>): void {
    this.config.targets.push({
      ...target,
      lastChecked: undefined,
      lastContent: undefined,
    });
    this.saveConfig();
  }

  /**
   * 監視対象を削除
   */
  removeTarget(url: string): boolean {
    const index = this.config.targets.findIndex(t => t.url === url);
    if (index >= 0) {
      this.config.targets.splice(index, 1);
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * 監視対象一覧を取得
   */
  getTargets(): MonitorTarget[] {
    return this.config.targets;
  }

  // ========================================
  // 監視実行
  // ========================================

  /**
   * 監視を開始
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[Monitor] Starting 24/7 monitoring...');

    // 即座に1回実行
    this.runCheck();

    // 定期実行
    this.intervalId = setInterval(
      () => this.runCheck(),
      this.config.checkInterval * 60 * 1000
    );
  }

  /**
   * 監視を停止
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[Monitor] Monitoring stopped.');
  }

  /**
   * 監視チェックを実行
   */
  async runCheck(): Promise<void> {
    if (!this.config.enabled) return;

    const playwright = getPlaywrightAgent();

    try {
      await playwright.launch();

      for (const target of this.config.targets) {
        try {
          await this.checkTarget(target, playwright);
        } catch (error) {
          console.error(`[Monitor] Error checking ${target.name}:`, error);
        }

        // レート制限対策
        await new Promise(r => setTimeout(r, 2000));
      }

      // 統計更新
      this.stats.totalChecks++;
      this.stats.lastCheck = new Date().toISOString();
      this.stats.targetsActive = this.config.targets.length;
      this.saveStats();

    } finally {
      await playwright.close();
    }
  }

  /**
   * 個別ターゲットをチェック
   */
  private async checkTarget(target: MonitorTarget, playwright: ReturnType<typeof getPlaywrightAgent>): Promise<void> {
    const result = await playwright.checkForChanges(target);

    // 初回チェック
    if (target.lastContent === undefined) {
      target.lastContent = result.newContent;
      target.lastChecked = new Date().toISOString();
      this.saveConfig();
      return;
    }

    // 変更検知
    if (result.changed) {
      const changePercent = Math.abs(
        ((result.newContent.length - (target.lastContent?.length || 0)) / (target.lastContent?.length || 1)) * 100
      );

      if (changePercent >= this.config.alertThreshold) {
        // AI分析
        const analysis = await this.analyzeChange(target, target.lastContent || '', result.newContent);

        // アラート生成
        const alert: MonitorAlert = {
          id: Date.now().toString(),
          targetName: target.name,
          targetUrl: target.url,
          type: 'content_change',
          severity: changePercent > 50 ? 'high' : changePercent > 20 ? 'medium' : 'low',
          message: `${target.name}で${Math.round(changePercent)}%の変更を検知`,
          details: analysis,
          detectedAt: new Date().toISOString(),
          acknowledged: false,
        };

        this.alerts.push(alert);
        this.stats.alertsToday++;
        this.saveAlerts();

        console.log(`[Monitor] Alert: ${alert.message}`);
      }
    }

    // 状態更新
    target.lastContent = result.newContent;
    target.lastChecked = new Date().toISOString();
    this.saveConfig();
  }

  /**
   * 変更内容をAI分析
   */
  private async analyzeChange(target: MonitorTarget, oldContent: string, newContent: string): Promise<string> {
    try {
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `以下は「${target.name}」(${target.url})の変更前後の内容です。
重要な変更点を簡潔に3行以内で報告してください。

【変更前】(${oldContent.length}文字)
${oldContent.slice(0, 1000)}...

【変更後】(${newContent.length}文字)
${newContent.slice(0, 1000)}...`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch {
      return '変更内容の自動分析に失敗しました';
    }
  }

  // ========================================
  // アラート管理
  // ========================================

  /**
   * 未確認アラートを取得
   */
  getUnacknowledgedAlerts(): MonitorAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * アラートを確認済みにする
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlerts();
      return true;
    }
    return false;
  }

  /**
   * 統計情報を取得
   */
  getStats(): MonitorStats {
    return this.stats;
  }

  // ========================================
  // Vector Memory連携
  // ========================================

  /**
   * 検知した変更をVector Memoryに保存
   */
  async saveChangeToMemory(target: MonitorTarget, content: string): Promise<string> {
    const memory = getVectorMemory();

    return memory.store({
      content,
      metadata: {
        source: 'monitor',
        url: target.url,
        title: target.name,
        category: 'competitor_change',
        scraped_at: new Date().toISOString(),
      },
    });
  }
}

// ========================================
// Function Calling用ツール定義
// ========================================

export const monitorTools = [
  {
    name: 'add_monitor_target',
    description: '監視対象を追加する',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '監視するURL',
        },
        name: {
          type: 'string',
          description: '監視対象の名前（例: "競合A社 採用ページ"）',
        },
        selector: {
          type: 'string',
          description: '監視する要素のCSSセレクタ（オプション）',
        },
      },
      required: ['url', 'name'],
    },
  },
  {
    name: 'get_monitor_alerts',
    description: '未確認のアラート一覧を取得する',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_monitor_stats',
    description: '監視システムの統計情報を取得する',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_monitor_check',
    description: '今すぐ監視チェックを実行する',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// ========================================
// シングルトン
// ========================================

let _monitor: MonitorAgent | null = null;

export function getMonitorAgent(): MonitorAgent {
  if (!_monitor) {
    _monitor = new MonitorAgent();
  }
  return _monitor;
}
