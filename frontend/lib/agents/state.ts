// Agent状態管理
import * as fs from 'fs';
import * as path from 'path';
import type { AgentState, Opportunity, Product, Template } from './types';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ファイルパス
const PATHS = {
  agentState: path.join(KNOWLEDGE_DIR, 'agent_state.json'),
  opportunities: path.join(KNOWLEDGE_DIR, 'opportunities.json'),
  products: path.join(KNOWLEDGE_DIR, 'products_registry.json'),
  templates: path.join(KNOWLEDGE_DIR, 'template_registry.json'),
};

// 汎用読み込み
function readJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
  }
  return defaultValue;
}

// 汎用書き込み
function writeJSON<T>(filePath: string, data: T): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
    return false;
  }
}

// === Agent State ===
export function getAgentState(): AgentState {
  return readJSON(PATHS.agentState, {
    agents: {
      director: { id: 'director-001', name: 'Product Director', role: '脳', status: 'idle', lastActive: null, tasksCompleted: 0, currentTask: null },
      hunter: { id: 'hunter-001', name: 'Opportunity Hunter', role: '目', status: 'idle', lastActive: null, opportunitiesFound: 0, currentTask: null, schedule: { intervalHours: 4, lastRun: null, nextRun: null } },
      dashboard: { id: 'dashboard-001', name: 'Product Dashboard', role: '顔', status: 'active', lastActive: null, productsMonitoring: 0, currentTask: null },
      builder: { id: 'builder-001', name: 'Builder & Deployer', role: '手', status: 'idle', lastActive: null, productsBuilt: 0, currentBuild: null, currentTask: null },
    },
    systemStatus: 'initializing',
    lastUpdated: null,
  });
}

export function updateAgentState(updates: Partial<AgentState>): boolean {
  const current = getAgentState();
  const updated = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  return writeJSON(PATHS.agentState, updated);
}

export function setAgentStatus(agentId: 'director' | 'hunter' | 'dashboard' | 'builder', status: AgentState['agents']['director']['status'], task?: string): boolean {
  const state = getAgentState();
  if (state.agents[agentId]) {
    state.agents[agentId].status = status;
    state.agents[agentId].lastActive = new Date().toISOString();
    if (task !== undefined) {
      state.agents[agentId].currentTask = task;
    }
    state.lastUpdated = new Date().toISOString();
    return writeJSON(PATHS.agentState, state);
  }
  return false;
}

// === Opportunities ===
interface OpportunitiesData {
  opportunities: Opportunity[];
  pipeline: Record<string, string[]>;
  stats: {
    totalDiscovered: number;
    totalApproved: number;
    totalRejected: number;
    totalDeployed: number;
  };
  lastUpdated: string | null;
}

export function getOpportunities(): OpportunitiesData {
  return readJSON(PATHS.opportunities, {
    opportunities: [],
    pipeline: { discovered: [], evaluating: [], approved: [], building: [], deployed: [], rejected: [] },
    stats: { totalDiscovered: 0, totalApproved: 0, totalRejected: 0, totalDeployed: 0 },
    lastUpdated: null,
  });
}

export function addOpportunity(opportunity: Opportunity): boolean {
  const data = getOpportunities();
  data.opportunities.push(opportunity);
  data.pipeline.discovered.push(opportunity.id);
  data.stats.totalDiscovered++;
  data.lastUpdated = new Date().toISOString();
  return writeJSON(PATHS.opportunities, data);
}

export function updateOpportunityStatus(id: string, newStatus: Opportunity['status'], notes?: string): boolean {
  const data = getOpportunities();
  const opp = data.opportunities.find(o => o.id === id);
  if (!opp) return false;

  // 古いパイプラインから削除
  Object.keys(data.pipeline).forEach(status => {
    data.pipeline[status] = data.pipeline[status].filter(oppId => oppId !== id);
  });

  // 新しいパイプラインに追加
  opp.status = newStatus;
  data.pipeline[newStatus].push(id);

  // 統計更新
  if (newStatus === 'approved') data.stats.totalApproved++;
  if (newStatus === 'rejected') {
    data.stats.totalRejected++;
    opp.rejectionReason = notes;
  }
  if (newStatus === 'deployed') data.stats.totalDeployed++;

  if (notes && newStatus === 'evaluating') {
    opp.evaluationNotes = notes;
    opp.evaluatedAt = new Date().toISOString();
  }

  data.lastUpdated = new Date().toISOString();
  return writeJSON(PATHS.opportunities, data);
}

// === Products ===
interface ProductsData {
  products: Product[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    totalUsers: number;
  };
}

export function getProducts(): ProductsData {
  return readJSON(PATHS.products, {
    products: [],
    stats: { totalProducts: 0, activeProducts: 0, totalRevenue: 0, totalUsers: 0 },
  });
}

export function addProduct(product: Product): boolean {
  const data = getProducts();
  data.products.push(product);
  data.stats.totalProducts++;
  if (product.status === 'active') data.stats.activeProducts++;
  return writeJSON(PATHS.products, data);
}

export function updateProductMetrics(id: string, metrics: Partial<Product['metrics']>): boolean {
  const data = getProducts();
  const product = data.products.find(p => p.id === id);
  if (!product) return false;

  product.metrics = { ...product.metrics, ...metrics };

  // 統計再計算
  data.stats.totalRevenue = data.products.reduce((sum, p) => sum + p.metrics.revenue, 0);
  data.stats.totalUsers = data.products.reduce((sum, p) => sum + p.metrics.users, 0);

  return writeJSON(PATHS.products, data);
}

// === Templates ===
interface TemplatesData {
  templates: Template[];
  categories: { id: string; name: string; description: string }[];
}

export function getTemplates(): TemplatesData {
  return readJSON(PATHS.templates, {
    templates: [],
    categories: [],
  });
}

export function getTemplateById(id: string): Template | undefined {
  const data = getTemplates();
  return data.templates.find(t => t.id === id);
}
