// Agent共通型定義

export type AgentStatus = 'idle' | 'working' | 'error' | 'active';

export interface AgentBase {
  id: string;
  name: string;
  role: '脳' | '目' | '顔' | '手';
  status: AgentStatus;
  lastActive: string | null;
  currentTask: string | null;
}

export interface DirectorAgent extends AgentBase {
  role: '脳';
  tasksCompleted: number;
}

export interface HunterAgent extends AgentBase {
  role: '目';
  opportunitiesFound: number;
  schedule: {
    intervalHours: number;
    lastRun: string | null;
    nextRun: string | null;
  };
}

export interface DashboardAgent extends AgentBase {
  role: '顔';
  productsMonitoring: number;
}

export interface BuilderAgent extends AgentBase {
  role: '手';
  productsBuilt: number;
  currentBuild: string | null;
}

// 機会 (Opportunity)
export type OpportunityStatus =
  | 'discovered'
  | 'evaluating'
  | 'approved'
  | 'building'
  | 'deployed'
  | 'rejected';

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  source: 'x' | 'reddit' | 'trends' | 'manual';
  sourceUrl?: string;
  keywords: string[];
  painPoints: string[];
  targetAudience: string;
  estimatedDemand: 'low' | 'medium' | 'high';
  suggestedTemplate?: string;
  status: OpportunityStatus;
  discoveredAt: string;
  evaluatedAt?: string;
  evaluationScore?: number;
  evaluationNotes?: string;
  rejectionReason?: string;
}

// プロダクト
export type ProductStatus = 'building' | 'deploying' | 'active' | 'paused' | 'error';

export interface ProductMetrics {
  users: number;
  revenue: number;
  postsGenerated?: number;
  lastActive: string | null;
}

export interface ProductHealth {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: string | null;
  uptime: number;
  errorCount?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  templateId: string;
  opportunityId?: string;
  status: ProductStatus;
  deployUrl: string | null;
  repoUrl: string | null;
  metrics: ProductMetrics;
  health: ProductHealth;
  createdAt: string;
  isOriginal: boolean;
  customizations?: Record<string, string>;
}

// テンプレート
export interface Template {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  category: string;
  features: string[];
  customizableFields: string[];
  deployTarget: 'vercel' | 'cloudflare' | 'railway';
  status: 'active' | 'deprecated';
  createdAt: string;
}

// Agent State
export interface AgentState {
  agents: {
    director: DirectorAgent;
    hunter: HunterAgent;
    dashboard: DashboardAgent;
    builder: BuilderAgent;
  };
  systemStatus: 'initializing' | 'running' | 'paused' | 'error';
  lastUpdated: string | null;
}
