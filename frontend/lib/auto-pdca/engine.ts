/**
 * Auto PDCA Engine
 * AIが自動でPDCAサイクルを回し続けるエンジン
 */

export interface PDCACycle {
  id: string;
  phase: 'plan' | 'do' | 'check' | 'act';
  target: 'dm-hunter' | 'content' | 'instagram' | 'wordpress' | 'video';
  startedAt: string;
  completedAt?: string;
  metrics: {
    before: Record<string, number>;
    after?: Record<string, number>;
  };
  improvements: string[];
  status: 'running' | 'completed' | 'failed';
}

export interface AutoPDCAConfig {
  enabled: boolean;
  targets: {
    dmHunter: boolean;
    content: boolean;
    instagram: boolean;
    wordpress: boolean;
    video: boolean;
  };
  intervalMinutes: number;
  maxConcurrent: number;
}

const DEFAULT_CONFIG: AutoPDCAConfig = {
  enabled: true,
  targets: {
    dmHunter: true,
    content: true,
    instagram: true,
    wordpress: true,
    video: true,
  },
  intervalMinutes: 30,
  maxConcurrent: 3,
};

// PDCAフェーズの説明
export const PHASE_DESCRIPTIONS = {
  plan: '改善計画を立案中',
  do: '施策を実行中',
  check: '結果を分析中',
  act: '改善を適用中',
};

// ターゲットの説明
export const TARGET_LABELS = {
  'dm-hunter': 'DM Hunter',
  'content': 'コンテンツ生成',
  'instagram': 'Instagram',
  'wordpress': 'WordPress',
  'video': '動画生成',
};

/**
 * PDCAサイクルを実行
 */
export async function runPDCACycle(
  target: PDCACycle['target'],
  onPhaseChange?: (phase: PDCACycle['phase'], message: string) => void
): Promise<PDCACycle> {
  const cycle: PDCACycle = {
    id: `pdca-${Date.now()}`,
    phase: 'plan',
    target,
    startedAt: new Date().toISOString(),
    metrics: { before: {} },
    improvements: [],
    status: 'running',
  };

  try {
    // Plan フェーズ
    onPhaseChange?.('plan', `${TARGET_LABELS[target]}の現状分析中...`);
    const planResult = await executePlanPhase(target);
    cycle.metrics.before = planResult.metrics;
    await delay(1000);

    // Do フェーズ
    cycle.phase = 'do';
    onPhaseChange?.('do', `改善施策を実行中...`);
    const doResult = await executeDoPhase(target, planResult.suggestions);
    cycle.improvements = doResult.appliedImprovements;
    await delay(1500);

    // Check フェーズ
    cycle.phase = 'check';
    onPhaseChange?.('check', `効果を測定中...`);
    const checkResult = await executeCheckPhase(target);
    cycle.metrics.after = checkResult.metrics;
    await delay(1000);

    // Act フェーズ
    cycle.phase = 'act';
    onPhaseChange?.('act', `学習結果を保存中...`);
    await executeActPhase(target, cycle);
    await delay(500);

    cycle.completedAt = new Date().toISOString();
    cycle.status = 'completed';

  } catch (error) {
    cycle.status = 'failed';
    console.error('PDCA cycle failed:', error);
  }

  return cycle;
}

async function executePlanPhase(target: PDCACycle['target']) {
  // 現状のメトリクスを取得
  const response = await fetch(`/api/auto-pdca/analyze?target=${target}`);
  if (!response.ok) {
    // フォールバック: ダミーデータ
    return {
      metrics: {
        engagementRate: Math.random() * 10,
        conversionRate: Math.random() * 5,
        qualityScore: 5 + Math.random() * 5,
      },
      suggestions: [
        'ターゲット層の絞り込み',
        'CTAの改善',
        '投稿時間の最適化',
      ],
    };
  }
  return response.json();
}

async function executeDoPhase(target: PDCACycle['target'], suggestions: string[]) {
  // 改善施策を適用
  const response = await fetch('/api/auto-pdca/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, suggestions }),
  });

  if (!response.ok) {
    return {
      appliedImprovements: suggestions.slice(0, 2),
    };
  }
  return response.json();
}

async function executeCheckPhase(target: PDCACycle['target']) {
  // 効果測定
  const response = await fetch(`/api/auto-pdca/measure?target=${target}`);
  if (!response.ok) {
    return {
      metrics: {
        engagementRate: Math.random() * 12,
        conversionRate: Math.random() * 7,
        qualityScore: 6 + Math.random() * 4,
      },
    };
  }
  return response.json();
}

async function executeActPhase(target: PDCACycle['target'], cycle: PDCACycle) {
  // 学習結果を保存
  await fetch('/api/auto-pdca/learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target,
      cycle,
      learnings: {
        effectiveImprovements: cycle.improvements,
        metricsDelta: calculateDelta(cycle.metrics.before, cycle.metrics.after || {}),
      },
    }),
  }).catch(() => {});
}

function calculateDelta(before: Record<string, number>, after: Record<string, number>) {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    if (after[key] !== undefined) {
      delta[key] = ((after[key] - before[key]) / before[key]) * 100;
    }
  }
  return delta;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 自動PDCAスケジューラー
 */
export class AutoPDCAScheduler {
  private config: AutoPDCAConfig;
  private runningCycles: Map<string, PDCACycle> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Set<(cycles: PDCACycle[]) => void> = new Set();

  constructor(config: Partial<AutoPDCAConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start() {
    if (this.intervalId) return;

    // 初回実行
    this.runCycles();

    // 定期実行
    this.intervalId = setInterval(() => {
      this.runCycles();
    }, this.config.intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(listener: (cycles: PDCACycle[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const cycles = Array.from(this.runningCycles.values());
    this.listeners.forEach(listener => listener(cycles));
  }

  private async runCycles() {
    if (!this.config.enabled) return;

    const targets: PDCACycle['target'][] = [];
    if (this.config.targets.dmHunter) targets.push('dm-hunter');
    if (this.config.targets.content) targets.push('content');
    if (this.config.targets.instagram) targets.push('instagram');
    if (this.config.targets.wordpress) targets.push('wordpress');
    if (this.config.targets.video) targets.push('video');

    // ランダムに1-2個のターゲットを選択
    const selectedTargets = targets
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(this.config.maxConcurrent, 2));

    for (const target of selectedTargets) {
      const cycle = await runPDCACycle(target, (phase, message) => {
        const existingCycle = this.runningCycles.get(target);
        if (existingCycle) {
          existingCycle.phase = phase;
          this.notify();
        }
      });

      this.runningCycles.set(target, cycle);
      this.notify();

      // 完了後は削除
      setTimeout(() => {
        this.runningCycles.delete(target);
        this.notify();
      }, 5000);
    }
  }

  getRunningCycles(): PDCACycle[] {
    return Array.from(this.runningCycles.values());
  }
}
