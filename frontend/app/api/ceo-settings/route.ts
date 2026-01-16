/**
 * CEO Settings API
 *
 * 社長のための設定管理API
 * - エージェント（人材）管理
 * - KPI設計・追跡
 * - ビジョン・方針管理
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CEO_SETTINGS_FILE = path.join(DATA_DIR, 'ceo_settings.json');

// デフォルト設定
const DEFAULT_SETTINGS = {
  // 人材（エージェント）
  agents: [
    { id: 'coo', name: '番頭', role: '最高執行責任者', status: 'active', tasksCompleted: 156, successRate: 94 },
    { id: 'cmo', name: 'CMO', role: 'マーケティング統括', status: 'active', tasksCompleted: 89, successRate: 91 },
    { id: 'creative', name: 'Creative', role: '投稿生成', status: 'active', tasksCompleted: 234, successRate: 88 },
    { id: 'analyst', name: 'Analyst', role: 'データ分析', status: 'active', tasksCompleted: 67, successRate: 96 },
    { id: 'researcher', name: 'Researcher', role: '市場調査', status: 'active', tasksCompleted: 45, successRate: 92 },
    { id: 'copywriter', name: 'Copywriter', role: 'コピー作成', status: 'active', tasksCompleted: 178, successRate: 85 },
    { id: 'scraper', name: 'Scraper', role: 'データ収集', status: 'active', tasksCompleted: 512, successRate: 98 },
    { id: 'automation', name: 'Automation', role: '自動化制御', status: 'active', tasksCompleted: 1024, successRate: 99 },
  ],

  // 採用候補
  availableRoles: [
    { id: 'content_moderator', name: 'コンテンツモデレーター', desc: '投稿品質の監視・改善', hired: false },
    { id: 'ab_tester', name: 'A/Bテスター', desc: '投稿パターンの検証', hired: false },
    { id: 'competitor_analyst', name: '競合アナリスト', desc: '競合分析・ベンチマーク', hired: false },
    { id: 'community_manager', name: 'コミュニティマネージャー', desc: 'フォロワー対応・関係構築', hired: false },
    { id: 'growth_hacker', name: 'グロースハッカー', desc: '成長戦略・実験', hired: false },
    { id: 'seo_specialist', name: 'SEOスペシャリスト', desc: '検索最適化・キーワード戦略', hired: false },
    { id: 'influencer_scout', name: 'インフルエンサースカウト', desc: 'コラボ相手の発掘・交渉', hired: false },
    { id: 'crisis_manager', name: 'クライシスマネージャー', desc: '炎上対策・リスク管理', hired: false },
  ],

  // KPI
  kpis: [
    { id: 'dm', name: 'DM獲得', target: 30, current: 12, unit: '件/月', priority: 'high' },
    { id: 'impression', name: 'インプレッション', target: 100000, current: 45000, unit: '/月', priority: 'medium' },
    { id: 'engagement', name: 'エンゲージメント率', target: 5, current: 3.2, unit: '%', priority: 'high' },
    { id: 'posts', name: '投稿数', target: 300, current: 156, unit: '件/月', priority: 'medium' },
  ],

  // ビジョン・方針
  vision: {
    mission: 'AIを活用して大企業を経営する',
    principles: [
      '「見る」のはプログラム、「考える」のはAI',
      '完全自動化で人件費ゼロを目指す',
      'データドリブンな意思決定',
    ],
    currentFocus: 'Stripchat市場でのシェア拡大',
    longTermGoals: [
      '100人規模のAI組織構築',
      '月商1000万円達成',
      '完全自動運営の実現',
    ],
  },

  // メタデータ
  updatedAt: new Date().toISOString(),
  version: '1.0.0',
};

// 設定を読み込み
function loadSettings() {
  if (fs.existsSync(CEO_SETTINGS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CEO_SETTINGS_FILE, 'utf-8'));
    } catch (error) {
      console.error('Failed to load CEO settings:', error);
    }
  }
  return DEFAULT_SETTINGS;
}

// 設定を保存
function saveSettings(settings: typeof DEFAULT_SETTINGS) {
  const dir = path.dirname(CEO_SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  settings.updatedAt = new Date().toISOString();
  fs.writeFileSync(CEO_SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET: 設定を取得
export async function GET() {
  const settings = loadSettings();
  return NextResponse.json(settings);
}

// POST: 設定を更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const settings = loadSettings();

    switch (action) {
      // エージェント関連
      case 'hire_agent': {
        const role = settings.availableRoles.find((r: any) => r.id === data.roleId);
        if (!role) {
          return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        // 新しいエージェントを追加
        const newAgent = {
          id: `${data.roleId}_${Date.now()}`,
          name: data.name || role.name,
          role: role.desc,
          status: 'active',
          tasksCompleted: 0,
          successRate: 0,
          hiredAt: new Date().toISOString(),
        };

        settings.agents.push(newAgent);
        role.hired = true;
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          message: `${newAgent.name}を採用しました`,
          agent: newAgent
        });
      }

      case 'fire_agent': {
        const index = settings.agents.findIndex((a: any) => a.id === data.agentId);
        if (index === -1) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // 保護されたエージェント（番頭など）はクビにできない
        const protectedAgents = ['coo', 'cmo', 'creative', 'analyst'];
        if (protectedAgents.includes(data.agentId)) {
          return NextResponse.json({
            error: 'このエージェントは解雇できません（コア人材）'
          }, { status: 400 });
        }

        const [fired] = settings.agents.splice(index, 1);
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          message: `${fired.name}を解雇しました`
        });
      }

      case 'update_agent': {
        const agent = settings.agents.find((a: any) => a.id === data.agentId);
        if (!agent) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        Object.assign(agent, data.updates);
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          agent
        });
      }

      // KPI関連
      case 'add_kpi': {
        const newKpi = {
          id: `kpi_${Date.now()}`,
          name: data.name,
          target: data.target,
          current: data.current || 0,
          unit: data.unit,
          priority: data.priority || 'medium',
        };

        settings.kpis.push(newKpi);
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          kpi: newKpi
        });
      }

      case 'update_kpi': {
        const kpi = settings.kpis.find((k: any) => k.id === data.kpiId);
        if (!kpi) {
          return NextResponse.json({ error: 'KPI not found' }, { status: 404 });
        }

        Object.assign(kpi, data.updates);
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          kpi
        });
      }

      case 'delete_kpi': {
        const index = settings.kpis.findIndex((k: any) => k.id === data.kpiId);
        if (index === -1) {
          return NextResponse.json({ error: 'KPI not found' }, { status: 404 });
        }

        settings.kpis.splice(index, 1);
        saveSettings(settings);

        return NextResponse.json({ success: true });
      }

      // ビジョン関連
      case 'update_vision': {
        settings.vision = { ...settings.vision, ...data };
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          vision: settings.vision
        });
      }

      // 全設定更新
      case 'update_all': {
        Object.assign(settings, data);
        saveSettings(settings);

        return NextResponse.json({
          success: true,
          settings
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('CEO settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
