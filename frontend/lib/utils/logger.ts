/**
 * 永続化ロガー
 * エラーログをファイルに保存し、後から分析可能に
 */

import fs from 'fs';
import path from 'path';

// ログレベル定義
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LoggerConfig {
  maxFileSize: number; // MB
  maxFiles: number;
  logDir: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxFileSize: 5, // 5MB
  maxFiles: 10,
  logDir: path.join(process.cwd(), 'data', 'logs'),
};

// ログファイルパス
function getLogFilePath(config: LoggerConfig = DEFAULT_CONFIG): string {
  const today = new Date().toISOString().split('T')[0];
  return path.join(config.logDir, `app-${today}.log`);
}

// ログディレクトリを確保
function ensureLogDir(config: LoggerConfig = DEFAULT_CONFIG): void {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

// ログローテーション
function rotateLogsIfNeeded(config: LoggerConfig = DEFAULT_CONFIG): void {
  try {
    const files = fs.readdirSync(config.logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse();

    // 古いファイルを削除
    if (files.length > config.maxFiles) {
      const toDelete = files.slice(config.maxFiles);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(config.logDir, file));
      }
    }
  } catch {
    // 無視
  }
}

// ログエントリを書き込み
function writeLog(entry: LogEntry, config: LoggerConfig = DEFAULT_CONFIG): void {
  try {
    ensureLogDir(config);
    rotateLogsIfNeeded(config);

    const logFile = getLogFilePath(config);
    const line = JSON.stringify(entry) + '\n';

    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (error) {
    console.error('[Logger] Failed to write log:', error);
  }
}

// エラーオブジェクトをシリアライズ
function serializeError(error: any): { name: string; message: string; stack?: string } | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

// レベル別カラー（コンソール出力用）
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  critical: '\x1b[35m', // magenta
};
const RESET = '\x1b[0m';

/**
 * ロガークラス
 */
class Logger {
  private category: string;
  private config: LoggerConfig;

  constructor(category: string, config: Partial<LoggerConfig> = {}) {
    this.category = category;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private log(level: LogLevel, message: string, data?: any, error?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: this.category,
      message,
      data,
      error: serializeError(error),
    };

    // コンソール出力
    const color = LEVEL_COLORS[level];
    const prefix = `${color}[${level.toUpperCase()}]${RESET} [${this.category}]`;
    console.log(`${prefix} ${message}`, data || '');
    if (error) console.error(error);

    // ファイル出力（warn以上）
    if (['warn', 'error', 'critical'].includes(level)) {
      writeLog(entry, this.config);
    }
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any, error?: any): void {
    this.log('warn', message, data, error);
  }

  error(message: string, error?: any, data?: any): void {
    this.log('error', message, data, error);
  }

  critical(message: string, error?: any, data?: any): void {
    this.log('critical', message, data, error);
  }
}

/**
 * カテゴリ別ロガーを作成
 */
export function createLogger(category: string): Logger {
  return new Logger(category);
}

// 事前定義ロガー
export const automationLogger = createLogger('Automation');
export const cronLogger = createLogger('Cron');
export const generatorLogger = createLogger('Generator');
export const twitterLogger = createLogger('Twitter');
export const discordLogger = createLogger('Discord');

/**
 * 最近のエラーログを取得
 */
export function getRecentErrors(hours: number = 24, limit: number = 100): LogEntry[] {
  try {
    const config = DEFAULT_CONFIG;
    ensureLogDir(config);

    const files = fs.readdirSync(config.logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 3); // 直近3日分

    const entries: LogEntry[] = [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    for (const file of files) {
      const content = fs.readFileSync(path.join(config.logDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          if (
            new Date(entry.timestamp) >= cutoff &&
            ['error', 'critical'].includes(entry.level)
          ) {
            entries.push(entry);
          }
        } catch {
          // パース失敗は無視
        }
      }
    }

    return entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * ログ統計を取得
 */
export function getLogStats(hours: number = 24): {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
} {
  try {
    const config = DEFAULT_CONFIG;
    ensureLogDir(config);

    const files = fs.readdirSync(config.logDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 3);

    const stats = {
      total: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0, critical: 0 } as Record<LogLevel, number>,
      byCategory: {} as Record<string, number>,
    };

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    for (const file of files) {
      const content = fs.readFileSync(path.join(config.logDir, file), 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          if (new Date(entry.timestamp) >= cutoff) {
            stats.total++;
            stats.byLevel[entry.level]++;
            stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
          }
        } catch {
          // パース失敗は無視
        }
      }
    }

    return stats;
  } catch {
    return {
      total: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0, critical: 0 },
      byCategory: {},
    };
  }
}
