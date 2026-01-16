/**
 * Project Intelligence
 * charged-tyson 全体を理解し、最適なファイルを推論する
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ========================================
// Types
// ========================================

export interface FileNode {
    path: string;
    type: 'file' | 'directory';
    purpose?: string;
    imports?: string[];
    size?: number;
}

export interface ProjectMap {
    structure: FileNode[];
    dependencies: Record<string, string[]>;
    summary: string;
    stats: {
        totalFiles: number;
        totalDirectories: number;
        apiEndpoints: number;
        pages: number;
        agents: number;
    };
}

// ========================================
// Main Functions
// ========================================

/**
 * charged-tyson 全体をスキャンして、構造を理解する
 */
export async function analyzeProject(): Promise<ProjectMap> {
    const rootDir = process.cwd();

    console.log('[Project Intelligence] Analyzing charged-tyson...');

    // 1. ファイル構造をスキャン
    const structure = scanDirectory(rootDir);

    // 2. 依存関係を解析
    const dependencies = analyzeDependencies(structure);

    // 3. 統計情報を集計
    const stats = calculateStats(structure);

    // 4. Gemini に「このプロジェクトは何をするものか」を要約させる
    const summary = await generateProjectSummary(structure, stats);

    console.log('[Project Intelligence] Analysis complete:', stats);

    return { structure, dependencies, summary, stats };
}

/**
 * 社長の指示から、どのファイルを編集すべきか推論する
 */
export async function inferFilesToEdit(instruction: string): Promise<string[]> {
    console.log('[Project Intelligence] Inferring files for:', instruction);

    const projectMap = await analyzeProject();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `
あなたは charged-tyson プロジェクトのアーキテクトです。

【プロジェクト概要】
${projectMap.summary}

【統計情報】
- 総ファイル数: ${projectMap.stats.totalFiles}
- APIエンドポイント: ${projectMap.stats.apiEndpoints}
- ページ: ${projectMap.stats.pages}
- AIエージェント: ${projectMap.stats.agents}

【ファイル一覧（主要なもの）】
${projectMap.structure
            .filter(n => n.type === 'file')
            .slice(0, 50)
            .map(n => `- ${n.path} (${n.purpose})`)
            .join('\n')}

【社長の指示】
「${instruction}」

この指示を実行するために、編集または作成すべきファイルのパスを、JSON配列で返してください。
新規作成が必要な場合は、適切なパスを提案してください。

回答形式（JSON配列のみ）:
["app/page.tsx", "lib/agent/new-feature.ts"]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON配列を抽出
    const match = text.match(/\[[\s\S]*?\]/);

    if (match) {
        const files = JSON.parse(match[0]);
        console.log('[Project Intelligence] Suggested files:', files);
        return files;
    }

    console.log('[Project Intelligence] Could not infer files');
    return [];
}

// ========================================
// Helper Functions
// ========================================

function scanDirectory(dir: string, depth = 0, maxDepth = 3): FileNode[] {
    if (depth > maxDepth) return [];

    const excludes = ['node_modules', '.next', '.git', 'dist', 'build', '.vercel'];

    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const nodes: FileNode[] = [];

        for (const item of items) {
            if (excludes.includes(item.name)) continue;

            const fullPath = path.join(dir, item.name);
            const relativePath = path.relative(process.cwd(), fullPath);

            if (item.isDirectory()) {
                nodes.push({
                    path: relativePath,
                    type: 'directory',
                    purpose: inferPurpose(relativePath),
                });

                // 再帰的にスキャン
                nodes.push(...scanDirectory(fullPath, depth + 1, maxDepth));
            } else if (item.isFile() && /\.(ts|tsx|js|jsx|json|md)$/.test(item.name)) {
                const stats = fs.statSync(fullPath);
                const imports = extractImports(fullPath);

                nodes.push({
                    path: relativePath,
                    type: 'file',
                    purpose: inferPurpose(relativePath),
                    imports,
                    size: stats.size,
                });
            }
        }

        return nodes;
    } catch (error) {
        console.error(`[Project Intelligence] Error scanning ${dir}:`, error);
        return [];
    }
}

function inferPurpose(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');

    if (normalized.includes('app/api/')) return 'API endpoint';
    if (normalized.includes('app/') && normalized.endsWith('page.tsx')) return 'UI page';
    if (normalized.includes('app/') && normalized.endsWith('layout.tsx')) return 'Layout';
    if (normalized.includes('lib/agent/')) return 'AI agent';
    if (normalized.includes('lib/')) return 'Library';
    if (normalized.includes('knowledge/')) return 'Knowledge base';
    if (normalized.includes('components/')) return 'UI component';
    if (normalized.endsWith('.json')) return 'Configuration';
    if (normalized.endsWith('.md')) return 'Documentation';

    return 'Unknown';
}

function extractImports(filePath: string): string[] {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
        const imports: string[] = [];
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    } catch (error) {
        return [];
    }
}

function analyzeDependencies(nodes: FileNode[]): Record<string, string[]> {
    const deps: Record<string, string[]> = {};

    for (const node of nodes) {
        if (node.type === 'file' && node.imports && node.imports.length > 0) {
            deps[node.path] = node.imports;
        }
    }

    return deps;
}

function calculateStats(nodes: FileNode[]) {
    const files = nodes.filter(n => n.type === 'file');
    const directories = nodes.filter(n => n.type === 'directory');

    return {
        totalFiles: files.length,
        totalDirectories: directories.length,
        apiEndpoints: files.filter(n => n.purpose === 'API endpoint').length,
        pages: files.filter(n => n.purpose === 'UI page').length,
        agents: files.filter(n => n.purpose === 'AI agent').length,
    };
}

async function generateProjectSummary(nodes: FileNode[], stats: any): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
以下のプロジェクト構造を分析して、このプロジェクトが何をするものか、3行で要約してください。

【統計情報】
- 総ファイル数: ${stats.totalFiles}
- APIエンドポイント: ${stats.apiEndpoints}
- ページ: ${stats.pages}
- AIエージェント: ${stats.agents}

【主要なファイル】
${nodes
                .filter(n => n.type === 'file')
                .slice(0, 30)
                .map(n => `- ${n.path} (${n.purpose})`)
                .join('\n')}

簡潔に、3行で要約してください。
`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('[Project Intelligence] Error generating summary:', error);
        return 'charged-tyson: AI自動化システム（要約生成エラー）';
    }
}

// ========================================
// Export for Testing
// ========================================

export const _internal = {
    scanDirectory,
    inferPurpose,
    extractImports,
    analyzeDependencies,
    calculateStats,
};
