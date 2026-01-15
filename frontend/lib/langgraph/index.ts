// LangGraph エクスポート
export * from './types';
export * from './nodes';
export { createPostGraph, runPostGraph, streamPostGraph } from './graph';

// 投稿生成エンジン（戦略切り替え対応）
export {
  generateSinglePost,
  generateMultiplePosts,
  GenerationProgress,
  ProgressCallback,
} from './post-generator';

export {
  generateSinglePostHybrid,
  generateMultiplePostsHybrid,
} from './post-generator-hybrid';

// 戦略ヘルパー
export type AIStrategy = 'gemini' | 'hybrid' | 'claude';

export function getAIStrategy(): AIStrategy {
  const strategy = process.env.AI_MODEL_STRATEGY || 'gemini';
  if (strategy === 'hybrid' || strategy === 'claude') {
    return strategy;
  }
  return 'gemini';
}
