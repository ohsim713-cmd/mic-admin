// Agent モジュールエクスポート

// 型定義
export * from './types';

// 状態管理
export {
  getAgentState,
  updateAgentState,
  setAgentStatus,
  getOpportunities,
  addOpportunity,
  updateOpportunityStatus,
  getProducts,
  addProduct,
  updateProductMetrics,
  getTemplates,
  getTemplateById,
} from './state';

// 1号機【脳】Director
export { evaluateOpportunity, evaluatePendingOpportunities, generateProductSpec } from './director';

// 2号機【目】Hunter
export { huntFromX, addManualOpportunity, runScheduledHunt } from './hunter';

// 3号機【顔】Monitor / Dashboard
export { runMonitoringCycle, getDashboardSummary, checkForAlerts } from './monitor';
export type { Alert } from './monitor';

// 4号機【手】Builder
export { buildProduct, buildApprovedOpportunities } from './builder';
