// @ts-nocheck
// LangGraph 投稿フローグラフ定義（現在未使用、将来の拡張用）
import { StateGraph, END } from '@langchain/langgraph';
import { PostState } from './types';
import {
  generatePostNode,
  qualityCheckNode,
  revisePostNode,
  postToXNode,
  shouldRevise,
} from './nodes';

// 状態のチャネル定義
const channels = {
  postType: { default: () => '求人' },
  slot: { default: () => 1 },
  targetAudience: { default: () => '副業を探している20-40代女性' },
  generatedPost: { default: () => '' },
  revisedPost: { default: () => undefined },
  qualityScore: { default: () => undefined },
  passedQualityCheck: { default: () => false },
  revisionCount: { default: () => 0 },
  maxRevisions: { default: () => 2 },
  posted: { default: () => false },
  tweetId: { default: () => undefined },
  error: { default: () => undefined },
  startTime: { default: () => Date.now() },
  logs: { default: () => [] as string[] },
};

// グラフ構築
export function createPostGraph() {
  const graph = new StateGraph<PostState>({
    channels,
  });

  // ノード追加
  graph.addNode('generate', generatePostNode);
  graph.addNode('qualityCheck', qualityCheckNode);
  graph.addNode('revise', revisePostNode);
  graph.addNode('postToX', postToXNode);

  // エッジ追加
  graph.addEdge('__start__', 'generate');
  graph.addEdge('generate', 'qualityCheck');

  // 条件分岐: 品質チェック後
  graph.addConditionalEdges('qualityCheck', shouldRevise, {
    revise: 'revise',
    post: 'postToX',
  });

  // 改善後は再度品質チェック
  graph.addEdge('revise', 'qualityCheck');

  // 投稿後は終了
  graph.addEdge('postToX', END);

  return graph.compile();
}

// グラフ実行ヘルパー
export async function runPostGraph(input: Partial<PostState>): Promise<PostState> {
  const graph = createPostGraph();

  const initialState: PostState = {
    postType: input.postType || '求人',
    slot: input.slot || 1,
    targetAudience: input.targetAudience || '副業を探している20-40代女性',
    generatedPost: '',
    revisedPost: undefined,
    qualityScore: undefined,
    passedQualityCheck: false,
    revisionCount: 0,
    maxRevisions: input.maxRevisions || 2,
    posted: false,
    tweetId: undefined,
    error: undefined,
    startTime: Date.now(),
    logs: [`[開始] 投稿フロー開始 - タイプ: ${input.postType || '求人'}`],
  };

  const result = await graph.invoke(initialState);

  // 処理時間を追加
  const processingTime = Date.now() - result.startTime;
  result.logs.push(`[完了] 処理時間: ${processingTime}ms`);

  return result as PostState;
}

// ストリーミング実行（UIで進捗表示用）
export async function* streamPostGraph(input: Partial<PostState>) {
  const graph = createPostGraph();

  const initialState: PostState = {
    postType: input.postType || '求人',
    slot: input.slot || 1,
    targetAudience: input.targetAudience || '副業を探している20-40代女性',
    generatedPost: '',
    revisedPost: undefined,
    qualityScore: undefined,
    passedQualityCheck: false,
    revisionCount: 0,
    maxRevisions: input.maxRevisions || 2,
    posted: false,
    tweetId: undefined,
    error: undefined,
    startTime: Date.now(),
    logs: [`[開始] 投稿フロー開始 - タイプ: ${input.postType || '求人'}`],
  };

  // ストリーミング実行
  for await (const event of await graph.stream(initialState)) {
    yield event;
  }
}
