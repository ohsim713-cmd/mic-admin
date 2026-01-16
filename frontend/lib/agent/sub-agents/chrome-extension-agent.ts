/**
 * Chrome Extension Sub-Agent
 *
 * Chrome拡張機能と連携してブラウザ操作を自動化
 * - ページスクレイピング
 * - フォーム入力
 * - 定期データ収集
 */

import { registerSubAgent, SubAgent, SubAgentResult } from './index';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const EXTENSION_QUEUE_FILE = path.join(DATA_DIR, 'extension_queue.json');

interface ExtensionTask {
  id: string;
  type: 'scrape' | 'screenshot' | 'fill_form' | 'click' | 'extract';
  url?: string;
  selector?: string;
  data?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  createdAt: string;
  completedAt?: string;
}

// タスクキューを読み込み
function loadTaskQueue(): ExtensionTask[] {
  if (fs.existsSync(EXTENSION_QUEUE_FILE)) {
    return JSON.parse(fs.readFileSync(EXTENSION_QUEUE_FILE, 'utf-8')).tasks || [];
  }
  return [];
}

// タスクキューを保存
function saveTaskQueue(tasks: ExtensionTask[]) {
  const dir = path.dirname(EXTENSION_QUEUE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(EXTENSION_QUEUE_FILE, JSON.stringify({ tasks, updatedAt: new Date().toISOString() }, null, 2));
}

const chromeExtensionAgent: SubAgent = {
  name: 'chrome',
  description: 'Chrome拡張機能と連携してブラウザ自動化を行うエージェント',

  tools: [
    {
      name: 'scrape_page',
      description: '指定URLのページ内容をスクレイピング（Chrome拡張経由）',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'スクレイピング対象のURL',
          },
          selector: {
            type: 'string',
            description: '抽出するCSSセレクター（省略時はページ全体）',
          },
          waitFor: {
            type: 'string',
            description: '待機するセレクター（動的コンテンツ用）',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'take_screenshot',
      description: '指定URLのスクリーンショットを撮影',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'スクリーンショット対象のURL',
          },
          fullPage: {
            type: 'string',
            description: 'フルページスクリーンショット（true/false）',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'fill_form',
      description: 'フォームに自動入力（ログイン等）',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'フォームのあるページURL',
          },
          fields: {
            type: 'string',
            description: 'フィールドと値のJSON（例: {"#username": "user", "#password": "pass"}）',
          },
          submitSelector: {
            type: 'string',
            description: '送信ボタンのセレクター',
          },
        },
        required: ['url', 'fields'],
      },
    },
    {
      name: 'schedule_scrape',
      description: '定期スクレイピングをスケジュール',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'スクレイピング対象のURL',
          },
          interval: {
            type: 'string',
            description: '実行間隔',
            enum: ['hourly', 'daily', 'weekly'],
          },
          selector: {
            type: 'string',
            description: '抽出するCSSセレクター',
          },
        },
        required: ['url', 'interval'],
      },
    },
    {
      name: 'get_task_status',
      description: '拡張機能タスクの実行状況を確認',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'タスクID（省略時は全タスク）',
          },
        },
      },
    },
    {
      name: 'extract_data',
      description: 'ページから構造化データを抽出',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '対象ページのURL',
          },
          schema: {
            type: 'string',
            description: '抽出スキーマ（JSON形式）',
          },
        },
        required: ['url', 'schema'],
      },
    },
  ],

  async execute(action: string, params: Record<string, unknown>): Promise<SubAgentResult> {
    const tasks = loadTaskQueue();

    switch (action) {
      case 'scrape_page': {
        const { url, selector, waitFor } = params;

        const task: ExtensionTask = {
          id: `scrape_${Date.now()}`,
          type: 'scrape',
          url: url as string,
          selector: selector as string,
          data: { waitFor },
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        tasks.push(task);
        saveTaskQueue(tasks);

        return {
          success: true,
          message: `スクレイピングタスクをキューに追加しました`,
          data: {
            taskId: task.id,
            url,
            status: 'pending',
            note: 'Chrome拡張機能がタスクを実行します。ブラウザでMIC拡張機能が有効になっていることを確認してください。',
          },
        };
      }

      case 'take_screenshot': {
        const { url, fullPage } = params;

        const task: ExtensionTask = {
          id: `screenshot_${Date.now()}`,
          type: 'screenshot',
          url: url as string,
          data: { fullPage: fullPage === 'true' },
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        tasks.push(task);
        saveTaskQueue(tasks);

        return {
          success: true,
          message: `スクリーンショットタスクを追加しました`,
          data: {
            taskId: task.id,
            url,
            status: 'pending',
          },
        };
      }

      case 'fill_form': {
        const { url, fields, submitSelector } = params;

        let parsedFields;
        try {
          parsedFields = JSON.parse(fields as string);
        } catch {
          return {
            success: false,
            error: 'フィールドのJSONが不正です',
          };
        }

        const task: ExtensionTask = {
          id: `form_${Date.now()}`,
          type: 'fill_form',
          url: url as string,
          data: { fields: parsedFields, submitSelector },
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        tasks.push(task);
        saveTaskQueue(tasks);

        return {
          success: true,
          message: `フォーム入力タスクを追加しました`,
          data: {
            taskId: task.id,
            url,
            status: 'pending',
            warning: 'セキュリティ上、パスワード等の機密情報は暗号化して保存することを推奨します',
          },
        };
      }

      case 'schedule_scrape': {
        const { url, interval, selector } = params;

        // スケジュール設定をファイルに保存
        const scheduleFile = path.join(DATA_DIR, 'scrape_schedules.json');
        let schedules: any[] = [];
        if (fs.existsSync(scheduleFile)) {
          schedules = JSON.parse(fs.readFileSync(scheduleFile, 'utf-8')).schedules || [];
        }

        const schedule = {
          id: `schedule_${Date.now()}`,
          url,
          interval,
          selector,
          active: true,
          createdAt: new Date().toISOString(),
          lastRun: null,
          nextRun: new Date().toISOString(),
        };

        schedules.push(schedule);
        fs.writeFileSync(scheduleFile, JSON.stringify({ schedules }, null, 2));

        return {
          success: true,
          message: `定期スクレイピングを設定しました: ${interval}`,
          data: {
            scheduleId: schedule.id,
            url,
            interval,
          },
        };
      }

      case 'get_task_status': {
        const { taskId } = params;

        if (taskId) {
          const task = tasks.find(t => t.id === taskId);
          if (!task) {
            return {
              success: false,
              error: `タスクが見つかりません: ${taskId}`,
            };
          }
          return {
            success: true,
            data: task,
          };
        }

        // 全タスクの状況
        const pending = tasks.filter(t => t.status === 'pending').length;
        const running = tasks.filter(t => t.status === 'running').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const failed = tasks.filter(t => t.status === 'failed').length;

        return {
          success: true,
          data: {
            summary: { pending, running, completed, failed },
            recentTasks: tasks.slice(-10),
          },
        };
      }

      case 'extract_data': {
        const { url, schema } = params;

        let parsedSchema;
        try {
          parsedSchema = JSON.parse(schema as string);
        } catch {
          return {
            success: false,
            error: '抽出スキーマのJSONが不正です',
          };
        }

        const task: ExtensionTask = {
          id: `extract_${Date.now()}`,
          type: 'extract',
          url: url as string,
          data: { schema: parsedSchema },
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        tasks.push(task);
        saveTaskQueue(tasks);

        return {
          success: true,
          message: `データ抽出タスクを追加しました`,
          data: {
            taskId: task.id,
            url,
            schema: parsedSchema,
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  },
};

// 登録
registerSubAgent(chromeExtensionAgent);

export default chromeExtensionAgent;
