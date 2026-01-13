/**
 * DM Hunter - アラート・通知システム
 * 目標達成、異常検知、改善提案を自動通知
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getTodayStats, getHistoricalStats } from './dm-tracker';
import { getTestSummary } from './ab-tester';
import { AccountType } from './sns-adapter';

const ALERTS_PATH = path.join(process.cwd(), 'data', 'alerts.json');

export type AlertType =
  | 'goal_achieved'
  | 'goal_behind'
  | 'goal_critical'
  | 'post_failed'
  | 'account_error'
  | 'performance_drop'
  | 'performance_up'
  | 'ab_test_complete'
  | 'daily_summary'
  | 'weekly_report';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  data?: Record<string, any>;
}

interface AlertsDB {
  alerts: Alert[];
  settings: {
    enabled: boolean;
    quietHoursStart: number; // 0-23
    quietHoursEnd: number;
    notifyOnGoalAchieved: boolean;
    notifyOnGoalBehind: boolean;
    notifyOnErrors: boolean;
    lastChecked: string;
  };
}

/**
 * DBを読み込む
 */
async function loadDB(): Promise<AlertsDB> {
  try {
    const data = await fs.readFile(ALERTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      alerts: [],
      settings: {
        enabled: true,
        quietHoursStart: 0,
        quietHoursEnd: 7,
        notifyOnGoalAchieved: true,
        notifyOnGoalBehind: true,
        notifyOnErrors: true,
        lastChecked: new Date().toISOString(),
      },
    };
  }
}

/**
 * DBを保存する
 */
async function saveDB(db: AlertsDB): Promise<void> {
  const dir = path.dirname(ALERTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ALERTS_PATH, JSON.stringify(db, null, 2));
}

/**
 * アラートを作成
 */
export async function createAlert(params: {
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<Alert> {
  const db = await loadDB();

  // 静粛時間チェック
  const now = new Date();
  const hour = now.getHours();
  const isQuietHour = hour >= db.settings.quietHoursStart && hour < db.settings.quietHoursEnd;

  if (isQuietHour && params.priority !== 'critical') {
    console.log(`[AlertSystem] Skipping non-critical alert during quiet hours`);
    // 静粛時間中は保存だけして通知しない
  }

  const alert: Alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    priority: params.priority,
    title: params.title,
    message: params.message,
    timestamp: new Date().toISOString(),
    read: false,
    dismissed: false,
    data: params.data,
  };

  // 重複チェック（同じタイプで今日既に発行されていないか）
  const today = new Date().toISOString().split('T')[0];
  const existingSameType = db.alerts.find(
    a => a.type === params.type &&
         a.timestamp.startsWith(today) &&
         !a.dismissed
  );

  if (existingSameType && params.type !== 'post_failed') {
    console.log(`[AlertSystem] Skipping duplicate alert: ${params.type}`);
    return existingSameType;
  }

  db.alerts.push(alert);

  // 過去100件のみ保持
  db.alerts = db.alerts
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 100);

  await saveDB(db);

  console.log(`[AlertSystem] Created: ${params.type} - ${params.title}`);
  return alert;
}

/**
 * 全システムをチェックしてアラートを生成
 */
export async function checkAllAndAlert(): Promise<Alert[]> {
  const newAlerts: Alert[] = [];
  const now = new Date();
  const hour = now.getHours();

  // 1. DM目標チェック
  const dmStats = await getTodayStats();

  // 目標達成
  if (dmStats.goalAchieved) {
    const alert = await createAlert({
      type: 'goal_achieved',
      priority: 'low',
      title: '目標達成！',
      message: `本日のDM目標 ${dmStats.goal}件を達成しました！（現在: ${dmStats.total}件）`,
      data: { dmStats },
    });
    newAlerts.push(alert);
  }

  // 18時以降で進捗が悪い
  if (hour >= 18 && !dmStats.goalAchieved) {
    const progress = dmStats.total / dmStats.goal;

    if (progress === 0) {
      const alert = await createAlert({
        type: 'goal_critical',
        priority: 'critical',
        title: '緊急: DM 0件',
        message: `${hour}時時点でDMが0件です。投稿内容や頻度を見直してください。`,
        data: { dmStats },
      });
      newAlerts.push(alert);
    } else if (progress < 0.5 && hour >= 21) {
      const alert = await createAlert({
        type: 'goal_behind',
        priority: 'high',
        title: '目標未達の可能性',
        message: `残り${dmStats.remaining}件。追加施策を検討してください。`,
        data: { dmStats },
      });
      newAlerts.push(alert);
    }
  }

  // 2. パフォーマンストレンドチェック
  const history = await getHistoricalStats(7);

  if (history.trend === 'down' && history.avgDMsPerDay < dmStats.goal * 0.7) {
    const alert = await createAlert({
      type: 'performance_drop',
      priority: 'medium',
      title: 'パフォーマンス低下',
      message: `過去7日間のDM獲得数が下降傾向です。投稿戦略の見直しを検討してください。`,
      data: { history },
    });
    newAlerts.push(alert);
  } else if (history.trend === 'up') {
    const alert = await createAlert({
      type: 'performance_up',
      priority: 'low',
      title: 'パフォーマンス向上中',
      message: `過去7日間のDM獲得数が上昇傾向です！この調子で続けましょう。`,
      data: { history },
    });
    newAlerts.push(alert);
  }

  // 3. A/Bテスト完了チェック
  const testSummary = await getTestSummary();

  for (const test of testSummary.recentCompleted) {
    // 過去1時間以内に完了したテスト
    const completedAt = new Date(test.completedAt || '');
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (completedAt > hourAgo) {
      const winner = test.winner === 'A' ? test.variantA : test.variantB;
      const alert = await createAlert({
        type: 'ab_test_complete',
        priority: 'medium',
        title: 'A/Bテスト完了',
        message: test.winner === 'tie'
          ? `テストID ${test.id} は引き分けでした。追加テストを検討してください。`
          : `勝者: ${winner?.target} × ${winner?.benefit} (信頼度: ${test.confidence}%)`,
        data: { test },
      });
      newAlerts.push(alert);
    }
  }

  return newAlerts;
}

/**
 * 未読アラートを取得
 */
export async function getUnreadAlerts(): Promise<Alert[]> {
  const db = await loadDB();
  return db.alerts.filter(a => !a.read && !a.dismissed);
}

/**
 * 最近のアラートを取得
 */
export async function getRecentAlerts(limit: number = 20): Promise<Alert[]> {
  const db = await loadDB();
  return db.alerts
    .filter(a => !a.dismissed)
    .slice(0, limit);
}

/**
 * アラートを既読にする
 */
export async function markAsRead(alertId: string): Promise<void> {
  const db = await loadDB();
  const alert = db.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.read = true;
    await saveDB(db);
  }
}

/**
 * 全アラートを既読にする
 */
export async function markAllAsRead(): Promise<void> {
  const db = await loadDB();
  for (const alert of db.alerts) {
    alert.read = true;
  }
  await saveDB(db);
}

/**
 * アラートを非表示にする
 */
export async function dismissAlert(alertId: string): Promise<void> {
  const db = await loadDB();
  const alert = db.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.dismissed = true;
    await saveDB(db);
  }
}

/**
 * 設定を更新
 */
export async function updateSettings(settings: Partial<AlertsDB['settings']>): Promise<void> {
  const db = await loadDB();
  db.settings = { ...db.settings, ...settings };
  await saveDB(db);
}

/**
 * アラートサマリーを取得
 */
export async function getAlertSummary(): Promise<{
  unreadCount: number;
  criticalCount: number;
  highCount: number;
  recentAlerts: Alert[];
}> {
  const db = await loadDB();
  const unread = db.alerts.filter(a => !a.read && !a.dismissed);

  return {
    unreadCount: unread.length,
    criticalCount: unread.filter(a => a.priority === 'critical').length,
    highCount: unread.filter(a => a.priority === 'high').length,
    recentAlerts: db.alerts.filter(a => !a.dismissed).slice(0, 5),
  };
}

/**
 * 日次サマリーアラートを生成
 */
export async function createDailySummary(): Promise<Alert> {
  const dmStats = await getTodayStats();
  const history = await getHistoricalStats(7);

  const message = [
    `【本日の成果】`,
    `DM: ${dmStats.total}件 ${dmStats.goalAchieved ? '✓達成' : `(目標: ${dmStats.goal}件)`}`,
    ``,
    `【週間トレンド】`,
    `平均DM/日: ${history.avgDMsPerDay}`,
    `目標達成率: ${history.goalAchievementRate}%`,
    `傾向: ${history.trend === 'up' ? '上昇↑' : history.trend === 'down' ? '下降↓' : '横ばい→'}`,
  ].join('\n');

  return createAlert({
    type: 'daily_summary',
    priority: 'low',
    title: '日次サマリー',
    message,
    data: { dmStats, history },
  });
}
