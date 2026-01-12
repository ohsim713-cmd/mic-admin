// 4号機【手：Builder & Deployer】
// テンプレート複製、カスタマイズ、自動デプロイ

import { addProduct, setAgentStatus, getAgentState, getTemplateById, updateOpportunityStatus } from './state';
import type { Product, Template } from './types';

interface BuildConfig {
  opportunityId: string;
  templateId: string;
  productName: string;
  customizations: Record<string, string>;
}

interface BuildResult {
  success: boolean;
  product?: Product;
  repoUrl?: string;
  deployUrl?: string;
  error?: string;
  logs: string[];
}

// ユニークID生成
function generateProductId(): string {
  return `prod-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// GitHub リポジトリ複製 (モック)
async function cloneRepository(template: Template, productName: string): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  // 実際の実装では GitHub API を使用
  /*
  const response = await fetch('https://api.github.com/repos/template/generate', {
    method: 'POST',
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      owner: 'your-org',
      name: productName.toLowerCase().replace(/\s+/g, '-'),
      description: `Auto-generated from ${template.name}`,
    })
  });
  */

  console.log(`[Builder] Would clone ${template.repoUrl} to new repo: ${productName}`);

  return {
    success: true,
    repoUrl: `https://github.com/your-org/${productName.toLowerCase().replace(/\s+/g, '-')}`,
  };
}

// コードカスタマイズ (モック)
async function customizeCode(repoUrl: string, customizations: Record<string, string>): Promise<boolean> {
  // 実際の実装では:
  // 1. リポジトリをクローン
  // 2. 設定ファイルを書き換え (テーマ、ブランディング、コピー等)
  // 3. AI によるコード生成/書き換え
  // 4. コミット & プッシュ

  console.log(`[Builder] Would customize ${repoUrl} with:`, customizations);

  return true;
}

// Vercel デプロイ (モック)
async function deployToVercel(repoUrl: string, projectName: string): Promise<{ success: boolean; deployUrl?: string; error?: string }> {
  // 実際の実装では Vercel API を使用
  /*
  const response = await fetch('https://api.vercel.com/v9/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
    },
    body: JSON.stringify({
      name: projectName,
      gitRepository: {
        type: 'github',
        repo: repoUrl.replace('https://github.com/', '')
      }
    })
  });
  */

  console.log(`[Builder] Would deploy ${repoUrl} to Vercel as ${projectName}`);

  return {
    success: true,
    deployUrl: `https://${projectName.toLowerCase()}.vercel.app`,
  };
}

// プロダクトビルド実行
export async function buildProduct(config: BuildConfig): Promise<BuildResult> {
  const logs: string[] = [];
  setAgentStatus('builder', 'working', `${config.productName}をビルド中`);

  try {
    // 1. テンプレート取得
    logs.push(`[1/4] テンプレート ${config.templateId} を取得中...`);
    const template = getTemplateById(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }
    logs.push(`✓ テンプレート取得完了: ${template.name}`);

    // 2. リポジトリ複製
    logs.push(`[2/4] リポジトリを複製中...`);
    const cloneResult = await cloneRepository(template, config.productName);
    if (!cloneResult.success) {
      throw new Error(`Clone failed: ${cloneResult.error}`);
    }
    logs.push(`✓ リポジトリ作成完了: ${cloneResult.repoUrl}`);

    // 3. コードカスタマイズ
    logs.push(`[3/4] コードをカスタマイズ中...`);
    const customized = await customizeCode(cloneResult.repoUrl!, config.customizations);
    if (!customized) {
      throw new Error('Customization failed');
    }
    logs.push(`✓ カスタマイズ完了`);

    // 4. デプロイ
    logs.push(`[4/4] Vercelにデプロイ中...`);
    const deployResult = await deployToVercel(
      cloneResult.repoUrl!,
      config.productName.toLowerCase().replace(/\s+/g, '-')
    );
    if (!deployResult.success) {
      throw new Error(`Deploy failed: ${deployResult.error}`);
    }
    logs.push(`✓ デプロイ完了: ${deployResult.deployUrl}`);

    // プロダクト登録
    const product: Product = {
      id: generateProductId(),
      name: config.productName,
      description: `Generated from ${template.name}`,
      templateId: config.templateId,
      opportunityId: config.opportunityId,
      status: 'active',
      deployUrl: deployResult.deployUrl!,
      repoUrl: cloneResult.repoUrl!,
      metrics: {
        users: 0,
        revenue: 0,
        lastActive: null,
      },
      health: {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        uptime: 100,
      },
      createdAt: new Date().toISOString(),
      isOriginal: false,
      customizations: config.customizations,
    };

    addProduct(product);

    // 機会ステータス更新
    updateOpportunityStatus(config.opportunityId, 'deployed');

    // Builder統計更新
    const state = getAgentState();
    state.agents.builder.productsBuilt++;

    setAgentStatus('builder', 'idle', undefined);

    return {
      success: true,
      product,
      repoUrl: cloneResult.repoUrl,
      deployUrl: deployResult.deployUrl,
      logs,
    };
  } catch (error) {
    logs.push(`✗ エラー: ${error}`);
    setAgentStatus('builder', 'error', String(error));

    return {
      success: false,
      error: String(error),
      logs,
    };
  }
}

// 承認済み機会を自動ビルド
export async function buildApprovedOpportunities(): Promise<{
  built: number;
  failed: number;
  results: BuildResult[];
}> {
  // 実装は evaluateOpportunity の結果から spec を取得して buildProduct を呼ぶ
  // 現時点ではスタブ
  return {
    built: 0,
    failed: 0,
    results: [],
  };
}
