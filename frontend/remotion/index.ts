/**
 * Remotion エントリーポイント
 *
 * ※ render.ts はサーバーサイド専用のため、ここではエクスポートしない
 */

import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);

// クライアントサイド用エクスポートのみ
export { ReelTemplate } from './ReelTemplate';
export type { ReelTemplateProps } from './ReelTemplate';
export { RemotionRoot } from './Root';
