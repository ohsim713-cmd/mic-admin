/**
 * Obsidian Vault 自動保存ライブラリ
 *
 * charged-tyson プロジェクトの生成コンテンツを
 * Obsidian Vault に自動保存するためのユーティリティ
 */

import { promises as fs } from 'fs';
import path from 'path';

// ========== Configuration ==========

export interface ObsidianConfig {
  vaultPath: string;
  projectFolder: string;
  assetsFolder: string;
  enableDailyDigest: boolean;
  language: 'ja' | 'en';
}

export const DEFAULT_CONFIG: ObsidianConfig = {
  vaultPath: process.env.OBSIDIAN_VAULT_PATH || 'C:\\Users\\user\\Documents\\Obsidian\\SecondBrain',
  projectFolder: 'charged-tyson',
  assetsFolder: 'Assets/charged-tyson/images',
  enableDailyDigest: true,
  language: 'ja',
};

// ========== Type Definitions ==========

export type ContentType = 'instagram' | 'tiktok' | 'image' | 'video';
export type NoteType = 'content' | 'log' | 'idea' | 'digest';

export interface ContentNote {
  id: string;
  type: ContentType;
  platform: 'instagram' | 'tiktok';
  account: 'liver' | 'chatre';
  caption: string;
  textOverlays?: string[];
  suggestedSound?: string | null;
  imagePrompt?: string;
  hasImage: boolean;
  imagePath?: string;
  sourceInfo?: {
    type: 'past_post' | 'buzz_stock';
    originalText?: string;
  };
  createdAt: string;
  tags?: string[];
}

export interface LogEntry {
  timestamp: string;
  action: string;
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export interface IdeaNote {
  id: string;
  title: string;
  content: string;
  source?: string;
  relatedContent?: string[];
  tags?: string[];
  createdAt: string;
}

export interface DailyDigest {
  date: string;
  contentGenerated: {
    instagram: number;
    tiktok: number;
    images: number;
  };
  logs: LogEntry[];
  highlights?: string[];
  issues?: string[];
}

export interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// ========== Main Class ==========

export class ObsidianClient {
  private config: ObsidianConfig;

  constructor(config: Partial<ObsidianConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getProjectPath(): string {
    return path.join(this.config.vaultPath, '01 - Projects', this.config.projectFolder);
  }

  private getContentPath(platform: string): string {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    return path.join(this.getProjectPath(), 'Content', platformName);
  }

  private getLogsPath(type: 'Daily' | 'Weekly' = 'Daily'): string {
    return path.join(this.getProjectPath(), 'Logs', type);
  }

  private getIdeasPath(): string {
    return path.join(this.getProjectPath(), 'Ideas');
  }

  private getAssetsPath(): string {
    return path.join(this.config.vaultPath, this.config.assetsFolder);
  }

  private formatDate(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory exists
    }
  }

  // ----- Content Note Operations -----

  async saveContentNote(content: ContentNote): Promise<SaveResult> {
    try {
      const dir = this.getContentPath(content.platform);
      await this.ensureDirectory(dir);

      const filename = `${this.formatDate()}-${content.id}.md`;
      const filePath = path.join(dir, filename);

      const markdown = this.generateContentMarkdown(content);
      await fs.writeFile(filePath, markdown, 'utf-8');

      console.log(`[Obsidian] Saved content note: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Obsidian] Error saving content note:', error);
      return { success: false, error: errorMessage };
    }
  }

  private generateContentMarkdown(content: ContentNote): string {
    const platformEmoji = content.platform === 'instagram' ? '📸' : '🎵';
    const accountLabel = content.account === 'liver' ? 'ライバー事務所' : 'チャトレ事務所';

    let md = `# ${platformEmoji} ${content.platform.charAt(0).toUpperCase() + content.platform.slice(1)} Content\n\n`;
    md += `## メタデータ\n`;
    md += `- **ID**: \`${content.id}\`\n`;
    md += `- **アカウント**: ${accountLabel}\n`;
    md += `- **作成日時**: ${content.createdAt}\n`;
    md += `- **画像あり**: ${content.hasImage ? 'はい' : 'いいえ'}\n`;

    if (content.sourceInfo) {
      md += `- **ソース**: ${content.sourceInfo.type === 'buzz_stock' ? 'バズ投稿参考' : 'オリジナル'}\n`;
    }

    md += `\n## キャプション\n`;
    md += `\`\`\`\n${content.caption}\n\`\`\`\n`;

    if (content.textOverlays && content.textOverlays.length > 0) {
      md += `\n## テキストオーバーレイ\n`;
      content.textOverlays.forEach((text, i) => {
        md += `${i + 1}. ${text}\n`;
      });
    }

    if (content.suggestedSound) {
      md += `\n## 推奨サウンド\n`;
      md += `🎵 ${content.suggestedSound}\n`;
    }

    if (content.imagePrompt) {
      md += `\n## 画像プロンプト\n`;
      md += `\`\`\`\n${content.imagePrompt}\n\`\`\`\n`;
    }

    if (content.imagePath) {
      md += `\n## 生成画像\n`;
      md += `![[${content.imagePath}]]\n`;
    }

    if (content.tags && content.tags.length > 0) {
      md += `\n## タグ\n`;
      md += content.tags.map(t => `#${t}`).join(' ') + '\n';
    }

    md += `\n---\n`;
    md += `*Auto-generated by charged-tyson*\n`;

    return md;
  }

  // ----- Image Operations -----

  async saveImage(imageData: string, contentId: string, mimeType: string = 'image/png'): Promise<SaveResult> {
    try {
      const dir = this.getAssetsPath();
      await this.ensureDirectory(dir);

      const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';
      const filename = `${contentId}.${extension}`;
      const filePath = path.join(dir, filename);

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await fs.writeFile(filePath, buffer);

      console.log(`[Obsidian] Saved image: ${filePath}`);

      const relativePath = `${this.config.assetsFolder}/${filename}`;
      return { success: true, filePath: relativePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Obsidian] Error saving image:', error);
      return { success: false, error: errorMessage };
    }
  }

  // ----- Log Operations -----

  async appendToLog(entry: LogEntry): Promise<SaveResult> {
    try {
      const dir = this.getLogsPath('Daily');
      await this.ensureDirectory(dir);

      const filename = `${this.formatDate()}.md`;
      const filePath = path.join(dir, filename);

      let existingContent = '';
      try {
        existingContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        existingContent = this.generateLogHeader();
      }

      const logLine = this.formatLogEntry(entry);
      const updatedContent = existingContent + logLine;

      await fs.writeFile(filePath, updatedContent, 'utf-8');

      console.log(`[Obsidian] Appended to log: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Obsidian] Error appending to log:', error);
      return { success: false, error: errorMessage };
    }
  }

  private generateLogHeader(): string {
    const date = this.formatDate();
    return `# 📊 ${date} 実行ログ\n\n## ログエントリ\n\n`;
  }

  private formatLogEntry(entry: LogEntry): string {
    const statusEmoji = entry.success ? '✅' : '❌';
    const time = new Date(entry.timestamp).toLocaleTimeString('ja-JP');
    let line = `- ${time} ${statusEmoji} **${entry.action}**`;

    if (entry.details) {
      line += ` - ${JSON.stringify(entry.details)}`;
    }

    if (entry.error) {
      line += ` - Error: ${entry.error}`;
    }

    return line + '\n';
  }

  // ----- Daily Digest Operations -----

  async saveDailyDigest(digest: DailyDigest): Promise<SaveResult> {
    try {
      const dir = this.getLogsPath('Daily');
      await this.ensureDirectory(dir);

      const filename = `${digest.date}-digest.md`;
      const filePath = path.join(dir, filename);

      const markdown = this.generateDigestMarkdown(digest);
      await fs.writeFile(filePath, markdown, 'utf-8');

      console.log(`[Obsidian] Saved daily digest: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Obsidian] Error saving daily digest:', error);
      return { success: false, error: errorMessage };
    }
  }

  private generateDigestMarkdown(digest: DailyDigest): string {
    let md = `# 📈 ${digest.date} Daily Digest\n\n`;

    md += `## 生成サマリー\n`;
    md += `| Platform | Count |\n`;
    md += `|----------|-------|\n`;
    md += `| Instagram | ${digest.contentGenerated.instagram} |\n`;
    md += `| TikTok | ${digest.contentGenerated.tiktok} |\n`;
    md += `| Images | ${digest.contentGenerated.images} |\n`;

    if (digest.highlights && digest.highlights.length > 0) {
      md += `\n## ハイライト\n`;
      digest.highlights.forEach(h => {
        md += `- ${h}\n`;
      });
    }

    if (digest.issues && digest.issues.length > 0) {
      md += `\n## 課題・エラー\n`;
      digest.issues.forEach(i => {
        md += `- ⚠️ ${i}\n`;
      });
    }

    md += `\n## 詳細ログ\n`;
    md += `![[${digest.date}]]\n`;

    md += `\n---\n`;
    md += `*Auto-generated by charged-tyson*\n`;

    return md;
  }

  // ----- Idea Note Operations -----

  async saveIdeaNote(idea: IdeaNote): Promise<SaveResult> {
    try {
      const dir = this.getIdeasPath();
      await this.ensureDirectory(dir);

      const filename = `${this.formatDate()}-${idea.id}.md`;
      const filePath = path.join(dir, filename);

      const markdown = this.generateIdeaMarkdown(idea);
      await fs.writeFile(filePath, markdown, 'utf-8');

      console.log(`[Obsidian] Saved idea note: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Obsidian] Error saving idea note:', error);
      return { success: false, error: errorMessage };
    }
  }

  private generateIdeaMarkdown(idea: IdeaNote): string {
    let md = `# 💡 ${idea.title}\n\n`;
    md += `## メタデータ\n`;
    md += `- **作成日時**: ${idea.createdAt}\n`;

    if (idea.source) {
      md += `- **ソース**: ${idea.source}\n`;
    }

    md += `\n## 内容\n`;
    md += `${idea.content}\n`;

    if (idea.relatedContent && idea.relatedContent.length > 0) {
      md += `\n## 関連コンテンツ\n`;
      idea.relatedContent.forEach(c => {
        md += `- [[${c}]]\n`;
      });
    }

    if (idea.tags && idea.tags.length > 0) {
      md += `\n## タグ\n`;
      md += idea.tags.map(t => `#${t}`).join(' ') + '\n';
    }

    md += `\n---\n`;
    md += `*Auto-generated by charged-tyson*\n`;

    return md;
  }

  // ----- Batch Operations -----

  async saveContentWithImage(
    content: ContentNote,
    imageData?: string,
    mimeType?: string
  ): Promise<{ contentResult: SaveResult; imageResult?: SaveResult }> {
    let imageResult: SaveResult | undefined;

    if (imageData && content.hasImage) {
      imageResult = await this.saveImage(imageData, content.id, mimeType);
      if (imageResult.success && imageResult.filePath) {
        content.imagePath = imageResult.filePath;
      }
    }

    const contentResult = await this.saveContentNote(content);

    return { contentResult, imageResult };
  }
}

// ========== Singleton Instance ==========

let obsidianClient: ObsidianClient | null = null;

export function getObsidianClient(config?: Partial<ObsidianConfig>): ObsidianClient {
  if (!obsidianClient) {
    obsidianClient = new ObsidianClient(config);
  }
  return obsidianClient;
}

// ========== Helper Functions ==========

export async function checkVaultAccess(vaultPath?: string): Promise<boolean> {
  const targetPath = vaultPath || DEFAULT_CONFIG.vaultPath;
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function createInstagramContentNote(
  apiResponse: {
    queueId: string;
    content: {
      caption: string;
      suggestedSound: string | null;
      textOverlays: string[];
      imagePrompt: string;
      generatedImage?: { base64: string; mimeType: string };
      sourceInfo?: { type: 'past_post' | 'buzz_stock'; originalText?: string };
    };
  },
  account: 'liver' | 'chatre'
): ContentNote {
  return {
    id: apiResponse.queueId,
    type: 'instagram',
    platform: 'instagram',
    account,
    caption: apiResponse.content.caption,
    textOverlays: apiResponse.content.textOverlays,
    suggestedSound: apiResponse.content.suggestedSound,
    imagePrompt: apiResponse.content.imagePrompt,
    hasImage: !!apiResponse.content.generatedImage,
    sourceInfo: apiResponse.content.sourceInfo,
    createdAt: new Date().toISOString(),
    tags: ['instagram', account, 'auto-generated'],
  };
}

export function createTikTokContentNote(
  apiResponse: {
    queueId: string;
    content: {
      caption: string;
      suggestedSound: string | null;
      textOverlays: string[];
      backgroundPrompt: string;
      generatedImage?: { base64: string; mimeType: string };
      sourceInfo?: { type: 'past_post' | 'buzz_stock'; originalText?: string };
    };
  },
  account: 'liver' | 'chatre'
): ContentNote {
  return {
    id: apiResponse.queueId,
    type: 'tiktok',
    platform: 'tiktok',
    account,
    caption: apiResponse.content.caption,
    textOverlays: apiResponse.content.textOverlays,
    suggestedSound: apiResponse.content.suggestedSound,
    imagePrompt: apiResponse.content.backgroundPrompt,
    hasImage: !!apiResponse.content.generatedImage,
    sourceInfo: apiResponse.content.sourceInfo,
    createdAt: new Date().toISOString(),
    tags: ['tiktok', account, 'auto-generated'],
  };
}
