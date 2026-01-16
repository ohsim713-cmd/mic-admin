/**
 * Execution Verifier - 実行結果検証システム
 *
 * 「評価眼」の役割: 操作が成功したか失敗したかを判断する
 *
 * - API レスポンスの検証
 * - スクリーンショットからの成功/失敗判定
 * - エラーパターンの検出
 */

import { getGenAI } from '@/lib/gemini';

// ========================================
// Types
// ========================================

export interface VerificationResult {
  success: boolean;
  confidence: number; // 0-1
  message: string;
  details?: Record<string, unknown>;
  errorType?: string;
  recoverable?: boolean;
}

export interface VerificationRule {
  actionType: string;
  successConditions: SuccessCondition[];
  errorPatterns: ErrorPattern[];
}

export interface SuccessCondition {
  type: 'json_field' | 'status_code' | 'contains_text' | 'screenshot';
  field?: string;
  expectedValue?: unknown;
  operator?: 'equals' | 'contains' | 'greater_than' | 'exists';
}

export interface ErrorPattern {
  pattern: string | RegExp;
  errorType: string;
  recoverable: boolean;
  message: string;
}

// ========================================
// Default Rules
// ========================================

const DEFAULT_RULES: VerificationRule[] = [
  {
    actionType: 'generate_post',
    successConditions: [
      { type: 'json_field', field: 'success', expectedValue: true, operator: 'equals' },
      { type: 'json_field', field: 'post.text', operator: 'exists' },
    ],
    errorPatterns: [
      { pattern: 'rate limit', errorType: 'rate_limit', recoverable: true, message: 'API制限に達しました。しばらく待ってください。' },
      { pattern: 'quota exceeded', errorType: 'quota', recoverable: false, message: 'API使用量の上限に達しました。' },
      { pattern: /score.*low|quality.*insufficient/i, errorType: 'quality', recoverable: true, message: '品質スコアが基準に達しませんでした。' },
    ],
  },
  {
    actionType: 'post_to_sns',
    successConditions: [
      { type: 'json_field', field: 'success', expectedValue: true, operator: 'equals' },
      { type: 'json_field', field: 'postId', operator: 'exists' },
    ],
    errorPatterns: [
      { pattern: 'duplicate', errorType: 'duplicate', recoverable: false, message: '同じ内容の投稿が既に存在します。' },
      { pattern: /auth|unauthorized|login/i, errorType: 'auth', recoverable: true, message: '認証エラー。再ログインが必要です。' },
      { pattern: /suspended|banned/i, errorType: 'banned', recoverable: false, message: 'アカウントが制限されています。' },
      { pattern: 'rate limit', errorType: 'rate_limit', recoverable: true, message: '投稿制限に達しました。' },
    ],
  },
  {
    actionType: 'replenish_stock',
    successConditions: [
      { type: 'json_field', field: 'generated', operator: 'greater_than', expectedValue: 0 },
    ],
    errorPatterns: [
      { pattern: 'error', errorType: 'generation_error', recoverable: true, message: '生成中にエラーが発生しました。' },
    ],
  },
  {
    actionType: 'analyze_performance',
    successConditions: [
      { type: 'json_field', field: 'success', expectedValue: true, operator: 'equals' },
    ],
    errorPatterns: [],
  },
];

// ========================================
// Execution Verifier
// ========================================

export class ExecutionVerifier {
  private rules: Map<string, VerificationRule> = new Map();

  constructor() {
    // デフォルトルールを登録
    DEFAULT_RULES.forEach(rule => {
      this.rules.set(rule.actionType, rule);
    });
  }

  /**
   * カスタムルールを追加
   */
  addRule(rule: VerificationRule): void {
    this.rules.set(rule.actionType, rule);
  }

  /**
   * 実行結果を検証
   */
  async verify(actionType: string, result: unknown): Promise<VerificationResult> {
    const rule = this.rules.get(actionType);

    if (!rule) {
      // ルールがない場合は基本的な検証
      return this.basicVerify(result);
    }

    // エラーパターンチェック
    const errorCheck = this.checkErrorPatterns(result, rule.errorPatterns);
    if (errorCheck) {
      return errorCheck;
    }

    // 成功条件チェック
    const successCheck = this.checkSuccessConditions(result, rule.successConditions);

    return successCheck;
  }

  /**
   * スクリーンショットからの検証（Vision API使用）
   */
  async verifyFromScreenshot(
    screenshotBase64: string,
    expectedOutcome: string
  ): Promise<VerificationResult> {
    try {
      const genai = getGenAI();
      const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `この画面のスクリーンショットを分析してください。

【期待する結果】
${expectedOutcome}

【判断してほしいこと】
1. 操作は成功しましたか？
2. エラーメッセージは表示されていますか？
3. 期待通りの画面ですか？

【回答形式】JSON
{
  "success": true/false,
  "confidence": 0.0-1.0,
  "message": "判断理由",
  "errorDetected": "エラーメッセージがあれば記載",
  "recoverable": true/false
}`;

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshotBase64,
          },
        },
      ]);

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: parsed.success ?? false,
          confidence: parsed.confidence ?? 0.5,
          message: parsed.message ?? '',
          errorType: parsed.errorDetected ? 'screenshot_error' : undefined,
          recoverable: parsed.recoverable ?? true,
        };
      }
    } catch (error) {
      console.error('[Verifier] Screenshot verification failed:', error);
    }

    return {
      success: false,
      confidence: 0,
      message: 'スクリーンショット検証に失敗しました',
      recoverable: true,
    };
  }

  // ========================================
  // Internal
  // ========================================

  private basicVerify(result: unknown): VerificationResult {
    // nullやundefinedは失敗
    if (result === null || result === undefined) {
      return {
        success: false,
        confidence: 1,
        message: '結果がありません',
        recoverable: true,
      };
    }

    // オブジェクトの場合
    if (typeof result === 'object') {
      const obj = result as Record<string, unknown>;

      // error フィールドがあれば失敗
      if (obj.error) {
        return {
          success: false,
          confidence: 1,
          message: String(obj.error),
          recoverable: true,
        };
      }

      // success フィールドがあればそれを使用
      if ('success' in obj) {
        return {
          success: Boolean(obj.success),
          confidence: 1,
          message: obj.success ? '成功' : '失敗',
        };
      }
    }

    // それ以外は成功と判断
    return {
      success: true,
      confidence: 0.7,
      message: '結果を受信しました',
    };
  }

  private checkErrorPatterns(
    result: unknown,
    patterns: ErrorPattern[]
  ): VerificationResult | null {
    const resultStr = JSON.stringify(result).toLowerCase();

    for (const pattern of patterns) {
      let matches = false;

      if (typeof pattern.pattern === 'string') {
        matches = resultStr.includes(pattern.pattern.toLowerCase());
      } else {
        matches = pattern.pattern.test(resultStr);
      }

      if (matches) {
        return {
          success: false,
          confidence: 0.9,
          message: pattern.message,
          errorType: pattern.errorType,
          recoverable: pattern.recoverable,
        };
      }
    }

    return null;
  }

  private checkSuccessConditions(
    result: unknown,
    conditions: SuccessCondition[]
  ): VerificationResult {
    if (!result || typeof result !== 'object') {
      return {
        success: false,
        confidence: 0.8,
        message: '無効な結果形式',
        recoverable: true,
      };
    }

    const obj = result as Record<string, unknown>;
    let allPassed = true;
    const failedConditions: string[] = [];

    for (const condition of conditions) {
      if (condition.type === 'json_field' && condition.field) {
        const value = this.getNestedValue(obj, condition.field);
        let passed = false;

        switch (condition.operator) {
          case 'equals':
            passed = value === condition.expectedValue;
            break;
          case 'contains':
            passed = String(value).includes(String(condition.expectedValue));
            break;
          case 'greater_than':
            passed = Number(value) > Number(condition.expectedValue);
            break;
          case 'exists':
            passed = value !== undefined && value !== null;
            break;
          default:
            passed = value === condition.expectedValue;
        }

        if (!passed) {
          allPassed = false;
          failedConditions.push(`${condition.field}: expected ${condition.operator} ${condition.expectedValue}, got ${value}`);
        }
      }
    }

    if (allPassed) {
      return {
        success: true,
        confidence: 1,
        message: 'すべての成功条件を満たしました',
      };
    }

    return {
      success: false,
      confidence: 0.9,
      message: `条件を満たしませんでした: ${failedConditions.join(', ')}`,
      recoverable: true,
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// ========================================
// Singleton
// ========================================

let verifierInstance: ExecutionVerifier | null = null;

export function getExecutionVerifier(): ExecutionVerifier {
  if (!verifierInstance) {
    verifierInstance = new ExecutionVerifier();
  }
  return verifierInstance;
}
