/**
 * Sub-Agent Registry
 *
 * 各サブエージェントを登録・管理するレジストリ
 * チャットからFunction Callingで呼び出される
 */

export interface SubAgent {
  name: string;
  description: string;
  // このサブエージェントが持つツール
  tools: SubAgentTool[];
  // 実行関数
  execute: (action: string, params: Record<string, unknown>) => Promise<SubAgentResult>;
}

export interface SubAgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface SubAgentResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

// サブエージェント一覧
export const SUB_AGENTS: Record<string, SubAgent> = {};

// サブエージェント登録関数
export function registerSubAgent(agent: SubAgent) {
  SUB_AGENTS[agent.name] = agent;
  console.log(`[SubAgent] Registered: ${agent.name}`);
}

// サブエージェント取得
export function getSubAgent(name: string): SubAgent | undefined {
  return SUB_AGENTS[name];
}

// 全サブエージェントのツール一覧を取得（Gemini Function Calling用）
export function getAllSubAgentTools() {
  const tools: SubAgentTool[] = [];

  for (const agent of Object.values(SUB_AGENTS)) {
    for (const tool of agent.tools) {
      tools.push({
        ...tool,
        name: `${agent.name}_${tool.name}`,
        description: `[${agent.name}] ${tool.description}`,
      });
    }
  }

  return tools;
}

// サブエージェントのツールを実行
export async function executeSubAgentTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<SubAgentResult> {
  // ツール名からサブエージェント名とアクション名を分離
  const parts = toolName.split('_');
  const agentName = parts[0];
  const action = parts.slice(1).join('_');

  const agent = getSubAgent(agentName);
  if (!agent) {
    return {
      success: false,
      error: `Unknown sub-agent: ${agentName}`,
    };
  }

  return agent.execute(action, params);
}

// 初期化時にサブエージェントを自動読み込み
export async function initializeSubAgents() {
  try {
    // 各サブエージェントをインポート
    await import('./scraper-agent');
    await import('./chrome-extension-agent');
    await import('./analytics-agent');
    await import('./automation-agent');

    console.log(`[SubAgent] Initialized ${Object.keys(SUB_AGENTS).length} sub-agents`);
  } catch (error) {
    console.error('[SubAgent] Initialization error:', error);
  }
}
