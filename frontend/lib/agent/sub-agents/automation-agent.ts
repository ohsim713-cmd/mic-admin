/**
 * Automation Sub-Agent
 *
 * 自動化ワークフローを管理するサブエージェント
 * - 投稿スケジューリング
 * - 自動応答設定
 * - バッチ処理
 */

import { registerSubAgent, SubAgent, SubAgentResult } from './index';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

interface AutomationConfig {
  id: string;
  name: string;
  type: 'schedule' | 'trigger' | 'batch';
  enabled: boolean;
  config: Record<string, unknown>;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

const CONFIG_FILE = path.join(DATA_DIR, 'automation_config.json');

function loadConfigs(): AutomationConfig[] {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')).configs || [];
  }
  return [];
}

function saveConfigs(configs: AutomationConfig[]) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ configs, updatedAt: new Date().toISOString() }, null, 2));
}

const automationAgent: SubAgent = {
  name: 'automation',
  description: '自動化ワークフローを管理するエージェント',

  tools: [
    {
      name: 'create_schedule',
      description: '投稿スケジュールを作成',
      parameters: {
        type: 'object',
        properties: {
          account: {
            type: 'string',
            description: '対象アカウント',
            enum: ['liver', 'chatre1', 'chatre2', 'all'],
          },
          times: {
            type: 'string',
            description: '投稿時間（カンマ区切り、例: 09:00,12:00,19:00）',
          },
          days: {
            type: 'string',
            description: '曜日（カンマ区切り、例: mon,tue,wed,thu,fri）',
          },
          postsPerDay: {
            type: 'string',
            description: '1日の投稿数',
          },
        },
        required: ['account'],
      },
    },
    {
      name: 'create_trigger',
      description: 'イベントトリガーを設定',
      parameters: {
        type: 'object',
        properties: {
          event: {
            type: 'string',
            description: 'トリガーイベント',
            enum: ['dm_received', 'mention', 'follower', 'engagement_spike', 'low_stock'],
          },
          action: {
            type: 'string',
            description: '実行アクション',
            enum: ['notify', 'generate_post', 'send_dm', 'run_analysis'],
          },
          conditions: {
            type: 'string',
            description: '条件（JSON形式）',
          },
        },
        required: ['event', 'action'],
      },
    },
    {
      name: 'create_batch',
      description: 'バッチ処理を設定',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'バッチ名',
          },
          tasks: {
            type: 'string',
            description: 'タスクリスト（JSON配列形式）',
          },
          schedule: {
            type: 'string',
            description: '実行スケジュール',
            enum: ['hourly', 'daily', 'weekly', 'manual'],
          },
        },
        required: ['name', 'tasks'],
      },
    },
    {
      name: 'list_automations',
      description: '設定済みの自動化一覧を取得',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'フィルタタイプ',
            enum: ['all', 'schedule', 'trigger', 'batch'],
          },
          status: {
            type: 'string',
            description: 'ステータスフィルタ',
            enum: ['all', 'enabled', 'disabled'],
          },
        },
      },
    },
    {
      name: 'toggle_automation',
      description: '自動化のON/OFFを切り替え',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '自動化ID',
          },
          enabled: {
            type: 'string',
            description: '有効化（true/false）',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'run_now',
      description: '自動化を即時実行',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '自動化ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_automation',
      description: '自動化を削除',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: '自動化ID',
          },
        },
        required: ['id'],
      },
    },
  ],

  async execute(action: string, params: Record<string, unknown>): Promise<SubAgentResult> {
    const configs = loadConfigs();

    switch (action) {
      case 'create_schedule': {
        const { account, times, days, postsPerDay } = params;

        const timeList = times ? (times as string).split(',') : ['09:00', '12:00', '19:00'];
        const dayList = days ? (days as string).split(',') : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        const config: AutomationConfig = {
          id: `schedule_${Date.now()}`,
          name: `${account}の投稿スケジュール`,
          type: 'schedule',
          enabled: true,
          config: {
            account,
            times: timeList,
            days: dayList,
            postsPerDay: parseInt(postsPerDay as string) || timeList.length,
          },
          createdAt: new Date().toISOString(),
          nextRun: new Date().toISOString(),
        };

        configs.push(config);
        saveConfigs(configs);

        return {
          success: true,
          message: `投稿スケジュールを作成しました`,
          data: {
            id: config.id,
            account,
            times: timeList,
            days: dayList,
          },
        };
      }

      case 'create_trigger': {
        const { event, action: triggerAction, conditions } = params;

        let parsedConditions = {};
        if (conditions) {
          try {
            parsedConditions = JSON.parse(conditions as string);
          } catch {
            return { success: false, error: '条件のJSONが不正です' };
          }
        }

        const config: AutomationConfig = {
          id: `trigger_${Date.now()}`,
          name: `${event} → ${triggerAction}`,
          type: 'trigger',
          enabled: true,
          config: {
            event,
            action: triggerAction,
            conditions: parsedConditions,
          },
          createdAt: new Date().toISOString(),
        };

        configs.push(config);
        saveConfigs(configs);

        return {
          success: true,
          message: `トリガーを設定しました: ${event}発生時に${triggerAction}を実行`,
          data: config,
        };
      }

      case 'create_batch': {
        const { name, tasks, schedule } = params;

        let parsedTasks = [];
        try {
          parsedTasks = JSON.parse(tasks as string);
        } catch {
          return { success: false, error: 'タスクリストのJSONが不正です' };
        }

        const config: AutomationConfig = {
          id: `batch_${Date.now()}`,
          name: name as string,
          type: 'batch',
          enabled: true,
          config: {
            tasks: parsedTasks,
            schedule: schedule || 'manual',
          },
          createdAt: new Date().toISOString(),
        };

        configs.push(config);
        saveConfigs(configs);

        return {
          success: true,
          message: `バッチ処理「${name}」を作成しました`,
          data: config,
        };
      }

      case 'list_automations': {
        const { type, status } = params;

        let filtered = configs;

        if (type && type !== 'all') {
          filtered = filtered.filter(c => c.type === type);
        }

        if (status === 'enabled') {
          filtered = filtered.filter(c => c.enabled);
        } else if (status === 'disabled') {
          filtered = filtered.filter(c => !c.enabled);
        }

        return {
          success: true,
          data: {
            total: filtered.length,
            automations: filtered.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type,
              enabled: c.enabled,
              lastRun: c.lastRun,
              nextRun: c.nextRun,
            })),
          },
        };
      }

      case 'toggle_automation': {
        const { id, enabled } = params;

        const index = configs.findIndex(c => c.id === id);
        if (index === -1) {
          return { success: false, error: `自動化が見つかりません: ${id}` };
        }

        configs[index].enabled = enabled === 'true' || enabled === undefined ? !configs[index].enabled : enabled === 'true';
        saveConfigs(configs);

        return {
          success: true,
          message: `${configs[index].name}を${configs[index].enabled ? '有効' : '無効'}にしました`,
          data: { id, enabled: configs[index].enabled },
        };
      }

      case 'run_now': {
        const { id } = params;

        const config = configs.find(c => c.id === id);
        if (!config) {
          return { success: false, error: `自動化が見つかりません: ${id}` };
        }

        // 実行をマーク
        config.lastRun = new Date().toISOString();
        saveConfigs(configs);

        // 実際の実行ロジックは別途実装
        return {
          success: true,
          message: `${config.name}を実行しました`,
          data: {
            id,
            executedAt: config.lastRun,
            status: 'running',
          },
        };
      }

      case 'delete_automation': {
        const { id } = params;

        const index = configs.findIndex(c => c.id === id);
        if (index === -1) {
          return { success: false, error: `自動化が見つかりません: ${id}` };
        }

        const deleted = configs.splice(index, 1)[0];
        saveConfigs(configs);

        return {
          success: true,
          message: `${deleted.name}を削除しました`,
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
registerSubAgent(automationAgent);

export default automationAgent;
