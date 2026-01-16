/**
 * Playwright Sub-Agent
 * ブラウザ自動化によるデータ収集エージェント
 *
 * 機能:
 * - note記事のスクレイピング
 * - 競合サイト監視
 * - OCR（スクリーンショット + Vision API）
 * - フォーム自動入力
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { getVectorMemory, MemoryDocument } from '../../database/vector-memory';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ========================================
// Types
// ========================================

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  author?: string;
  publishedAt?: string;
  images?: string[];
  metadata?: Record<string, unknown>;
}

export interface MonitorTarget {
  url: string;
  name: string;
  selector?: string;
  interval?: number; // minutes
  lastChecked?: string;
  lastContent?: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  regions?: Array<{
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

// ========================================
// Playwright Agent
// ========================================

export class PlaywrightAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ja-JP',
    });
  }

  /**
   * ブラウザを終了
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 新しいページを取得
   */
  private async getPage(): Promise<Page> {
    if (!this.context) await this.launch();
    return this.context!.newPage();
  }

  // ========================================
  // note記事スクレイピング
  // ========================================

  /**
   * note記事を取得
   */
  async scrapeNoteArticle(url: string): Promise<ScrapeResult> {
    const page = await this.getPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 記事データを抽出
      const result = await page.evaluate(() => {
        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const author = document.querySelector('[class*="user"] [class*="name"]')?.textContent?.trim() || '';
        const content = document.querySelector('article')?.textContent?.trim() || '';
        const publishedAt = document.querySelector('time')?.getAttribute('datetime') || '';
        const images = Array.from(document.querySelectorAll('article img'))
          .map(img => img.getAttribute('src'))
          .filter(Boolean) as string[];

        return { title, author, content, publishedAt, images };
      });

      return {
        url,
        ...result,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * noteの検索結果から記事一覧を取得
   */
  async scrapeNoteSearch(query: string, maxResults = 10): Promise<ScrapeResult[]> {
    const page = await this.getPage();
    const results: ScrapeResult[] = [];

    try {
      const searchUrl = `https://note.com/search?q=${encodeURIComponent(query)}&context=note&mode=search`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // 検索結果のリンクを取得
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/n/"]'))
          .map(a => a.getAttribute('href'))
          .filter(href => href && href.includes('/n/n'))
          .slice(0, 20);
      });

      // 各記事を取得
      for (const link of links.slice(0, maxResults)) {
        if (!link) continue;
        const fullUrl = link.startsWith('http') ? link : `https://note.com${link}`;

        try {
          const article = await this.scrapeNoteArticle(fullUrl);
          results.push(article);
          // レート制限対策
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.error(`Failed to scrape ${fullUrl}:`, e);
        }
      }

      return results;
    } finally {
      await page.close();
    }
  }

  // ========================================
  // 汎用スクレイピング
  // ========================================

  /**
   * 任意のページをスクレイピング
   */
  async scrapePage(url: string, options?: {
    selector?: string;
    waitFor?: string;
    extractImages?: boolean;
  }): Promise<ScrapeResult> {
    const page = await this.getPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      if (options?.waitFor) {
        await page.waitForSelector(options.waitFor, { timeout: 10000 });
      }

      const result = await page.evaluate((opts) => {
        const contentEl = opts?.selector
          ? document.querySelector(opts.selector)
          : document.body;

        const title = document.title || '';
        const content = contentEl?.textContent?.trim() || '';
        const images = opts?.extractImages
          ? Array.from(document.querySelectorAll('img'))
              .map(img => img.getAttribute('src'))
              .filter(Boolean) as string[]
          : [];

        return { title, content, images };
      }, options);

      return {
        url,
        ...result,
      };
    } finally {
      await page.close();
    }
  }

  // ========================================
  // OCR（Vision API）
  // ========================================

  /**
   * スクリーンショットを撮ってOCR
   */
  async captureAndOCR(url: string, selector?: string): Promise<OCRResult> {
    const page = await this.getPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // スクリーンショット取得
      const element = selector ? await page.$(selector) : page;
      const screenshot = await (element || page).screenshot({ type: 'png' });
      const base64Image = screenshot.toString('base64');

      // Gemini Vision APIでOCR
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
        {
          text: `この画像に含まれるすべてのテキストを抽出してください。
JSONフォーマットで返してください:
{
  "text": "抽出したテキスト全体",
  "regions": [
    {"text": "領域1のテキスト", "type": "heading/paragraph/button/label"}
  ]
}`,
        },
      ]);

      const responseText = result.response.text();

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            text: parsed.text || '',
            confidence: 0.9,
            regions: parsed.regions,
          };
        }
      } catch {
        // JSONパース失敗時はテキストをそのまま返す
      }

      return {
        text: responseText,
        confidence: 0.8,
      };
    } finally {
      await page.close();
    }
  }

  // ========================================
  // 競合監視
  // ========================================

  /**
   * ページの変更を検知
   */
  async checkForChanges(target: MonitorTarget): Promise<{
    changed: boolean;
    newContent: string;
    diff?: string;
  }> {
    const result = await this.scrapePage(target.url, {
      selector: target.selector,
    });

    const newContent = result.content;
    const changed = target.lastContent !== undefined && target.lastContent !== newContent;

    return {
      changed,
      newContent,
      diff: changed ? `Content changed from ${target.lastContent?.length || 0} to ${newContent.length} chars` : undefined,
    };
  }

  // ========================================
  // Vector Memoryへの保存
  // ========================================

  /**
   * スクレイピング結果をVector Memoryに保存
   */
  async saveToMemory(results: ScrapeResult[], source: string): Promise<string[]> {
    const memory = getVectorMemory();
    const docs: MemoryDocument[] = results.map(r => ({
      content: `${r.title}\n\n${r.content}`,
      metadata: {
        source,
        url: r.url,
        title: r.title,
        author: r.author,
        scraped_at: new Date().toISOString(),
      },
    }));

    return memory.storeBatch(docs);
  }
}

// ========================================
// Function Calling用ツール定義
// ========================================

export const playwrightTools = [
  {
    name: 'scrape_note_search',
    description: 'noteで検索してヒットした記事を取得し、Vector Memoryに保存する',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索キーワード（例: "ライバー 収入"）',
        },
        max_results: {
          type: 'number',
          description: '取得する最大記事数（デフォルト: 10）',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrape_page',
    description: '指定URLのページをスクレイピングする',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'スクレイピングするURL',
        },
        selector: {
          type: 'string',
          description: 'CSSセレクタ（指定部分のみ取得）',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'capture_ocr',
    description: 'ページのスクリーンショットを撮影し、OCRでテキストを抽出する',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'スクリーンショットを撮るURL',
        },
        selector: {
          type: 'string',
          description: '特定要素のみ撮影する場合のCSSセレクタ',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'monitor_page',
    description: 'ページの内容変更を検知する',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '監視するURL',
        },
        name: {
          type: 'string',
          description: '監視対象の名前（識別用）',
        },
        selector: {
          type: 'string',
          description: '監視する要素のCSSセレクタ',
        },
      },
      required: ['url', 'name'],
    },
  },
];

// ========================================
// シングルトン
// ========================================

let _agent: PlaywrightAgent | null = null;

export function getPlaywrightAgent(): PlaywrightAgent {
  if (!_agent) {
    _agent = new PlaywrightAgent();
  }
  return _agent;
}

// 終了時にブラウザを閉じる
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    if (_agent) {
      await _agent.close();
    }
  });
}
