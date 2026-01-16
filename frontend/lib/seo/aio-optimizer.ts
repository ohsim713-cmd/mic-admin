/**
 * AIO（AI Overview）最適化ユーティリティ
 *
 * GoogleのAI Overviewsに引用されやすい記事構造を自動生成
 * - 構造化データ（Schema.org）
 * - FAQ自動生成
 * - 権威性文章（数字・統計）
 */

// ===============================
// 構造化データ生成
// ===============================

interface FAQItem {
  question: string;
  answer: string;
}

interface ArticleSchema {
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  publisher?: string;
  image?: string;
  url?: string;
}

interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

/**
 * FAQPage構造化データを生成
 */
export function generateFAQSchema(faqs: FAQItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Article構造化データを生成
 */
export function generateArticleSchema(article: ArticleSchema): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "datePublished": article.datePublished,
    "dateModified": article.dateModified || article.datePublished,
    "author": {
      "@type": "Person",
      "name": article.author || "編集部"
    },
    "publisher": {
      "@type": "Organization",
      "name": article.publisher || "公式サイト",
      "logo": {
        "@type": "ImageObject",
        "url": "/logo.png"
      }
    },
    ...(article.image && { "image": article.image }),
    ...(article.url && { "mainEntityOfPage": article.url })
  };
}

/**
 * HowTo構造化データを生成
 */
export function generateHowToSchema(
  name: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string
): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": name,
    "description": description,
    ...(totalTime && { "totalTime": totalTime }),
    "step": steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text,
      ...(step.image && { "image": step.image })
    }))
  };
}

/**
 * 全構造化データをまとめてscriptタグ用に出力
 */
export function generateSchemaScripts(schemas: object[]): string {
  return schemas.map(schema =>
    `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`
  ).join('\n');
}

// ===============================
// FAQ自動生成
// ===============================

/**
 * 記事キーワードからFAQを自動生成するプロンプト
 */
export function buildFAQGenerationPrompt(
  keyword: string,
  businessType: 'liver-agency' | 'chat-lady',
  existingContent?: string
): string {
  const businessLabel = businessType === 'liver-agency' ? 'ライバー' : 'チャットレディ';

  return `以下のキーワードに関する、Google AI Overviewsに引用されやすいFAQを5つ生成してください。

【キーワード】
${keyword}

【業種】
${businessLabel}

${existingContent ? `【参考記事内容】\n${existingContent.slice(0, 1000)}...` : ''}

【FAQの要件】
1. 「〇〇とは？」「〇〇のメリットは？」などの基本的な質問を含める
2. 回答は簡潔（50-100文字）で、数字や具体例を含める
3. 専門用語を使う場合は説明を添える
4. 検索意図に直接答える形式にする

【出力形式】
JSON配列で出力：
[
  { "question": "質問文", "answer": "回答文" },
  ...
]

JSONのみを出力してください。`;
}

/**
 * よくある質問テンプレート（フォールバック用）
 */
export function getDefaultFAQs(
  keyword: string,
  businessType: 'liver-agency' | 'chat-lady'
): FAQItem[] {
  if (businessType === 'liver-agency') {
    return [
      {
        question: `${keyword}とは何ですか？`,
        answer: `${keyword}は、ライブ配信で収入を得る働き方の一つです。スマホ1台から始められ、月収30万円以上を稼ぐ方も多くいます。`
      },
      {
        question: `${keyword}を始めるのに必要なものは？`,
        answer: `スマートフォンとインターネット環境があれば始められます。事務所に所属すれば、機材サポートや配信ノウハウの指導も受けられます。`
      },
      {
        question: `${keyword}でどのくらい稼げますか？`,
        answer: `初心者でも月5-10万円、人気ライバーになると月50-100万円以上稼ぐ方もいます。当事務所の平均月収は約25万円です。`
      },
      {
        question: `顔出しなしでもできますか？`,
        answer: `はい、Vtuberやラジオ配信など顔出しなしで活動する方法もあります。当事務所では顔出しなしで月20万円以上稼ぐ方もいます。`
      },
      {
        question: `事務所に入るメリットは何ですか？`,
        answer: `報酬アップ交渉、機材サポート、配信ノウハウ指導、税務サポートなど個人では得られないメリットがあります。所属ライバーの継続率は85%以上です。`
      }
    ];
  } else {
    return [
      {
        question: `${keyword}とは何ですか？`,
        answer: `${keyword}は、チャットでお客様と会話をする在宅ワークです。スマホやPCがあれば自宅で働け、月収50万円以上を稼ぐ方もいます。`
      },
      {
        question: `${keyword}は安全ですか？`,
        answer: `大手サイトを使えば個人情報は保護され、顔出しも任意です。当事務所では安全対策の研修を徹底しており、トラブル発生率は0.1%未満です。`
      },
      {
        question: `${keyword}でどのくらい稼げますか？`,
        answer: `時給換算で3,000-8,000円が相場です。週3-4日、1日3時間の活動で月20-30万円を稼ぐ方が多いです。`
      },
      {
        question: `未経験でも始められますか？`,
        answer: `はい、当事務所では未経験者が90%以上です。マンツーマンの研修制度があり、初月から平均15万円の報酬を得ています。`
      },
      {
        question: `確定申告は必要ですか？`,
        answer: `年間所得が20万円を超える場合は必要です。当事務所では税理士による無料相談サービスを提供しています。`
      }
    ];
  }
}

// ===============================
// 権威性文章生成
// ===============================

interface AuthorityStats {
  stat: string;
  context: string;
}

/**
 * ビジネスタイプに応じた権威性統計データ
 */
export function getAuthorityStats(businessType: 'liver-agency' | 'chat-lady'): AuthorityStats[] {
  if (businessType === 'liver-agency') {
    return [
      { stat: "累計1,000名以上", context: "の所属ライバーをサポート" },
      { stat: "平均月収25万円", context: "を達成する所属ライバー" },
      { stat: "継続率85%以上", context: "の高い定着率" },
      { stat: "24時間対応", context: "のサポート体制" },
      { stat: "最短3日", context: "でデビュー可能" },
      { stat: "報酬還元率70%以上", context: "の業界最高水準" },
      { stat: "300万円以上", context: "の月収を達成したトップライバーも在籍" },
      { stat: "設立5年", context: "の実績と信頼" },
    ];
  } else {
    return [
      { stat: "累計3,000名以上", context: "の登録実績" },
      { stat: "時給3,000-8,000円", context: "の高収入" },
      { stat: "未経験者90%以上", context: "が初月から稼いでいます" },
      { stat: "在宅率100%", context: "で完全在宅ワーク" },
      { stat: "24時間365日", context: "好きな時間に働ける" },
      { stat: "顔出しなしOK", context: "プライバシー完全保護" },
      { stat: "日払い対応", context: "で急な出費にも安心" },
      { stat: "サポート満足度98%", context: "の充実したフォロー体制" },
    ];
  }
}

/**
 * 権威性セクションを生成
 */
export function generateAuthoritySection(
  businessType: 'liver-agency' | 'chat-lady',
  format: 'html' | 'text' = 'html'
): string {
  const stats = getAuthorityStats(businessType);
  const selected = stats.slice(0, 4); // 4つを選択

  if (format === 'html') {
    const items = selected.map(s =>
      `<li><strong>${s.stat}</strong>${s.context}</li>`
    ).join('\n');

    return `<div class="authority-section">
<h3>選ばれる理由</h3>
<ul>
${items}
</ul>
</div>`;
  } else {
    return selected.map(s => `✅ ${s.stat}${s.context}`).join('\n');
  }
}

/**
 * ランダムな権威性フレーズを取得
 */
export function getRandomAuthorityStat(businessType: 'liver-agency' | 'chat-lady'): string {
  const stats = getAuthorityStats(businessType);
  const random = stats[Math.floor(Math.random() * stats.length)];
  return `${random.stat}${random.context}`;
}

// ===============================
// AIO最適化コンテンツ生成
// ===============================

/**
 * AIO最適化されたプロンプトを生成
 */
export function buildAIOOptimizedPrompt(
  keyword: string,
  businessType: 'liver-agency' | 'chat-lady',
  articleLength: 'short' | 'medium' | 'long' = 'medium'
): string {
  const businessLabel = businessType === 'liver-agency' ? 'ライバー事務所' : 'チャットレディ事務所';
  const stats = getAuthorityStats(businessType).slice(0, 3);

  let charCount = '2000-2500';
  if (articleLength === 'short') charCount = '1000-1500';
  if (articleLength === 'long') charCount = '3000-4000';

  return `あなたは${businessLabel}の代表で、Google AI Overviewsに引用されやすいSEO記事を書くプロです。

【メインキーワード】
${keyword}

【権威性データ（必ず記事内に含める）】
${stats.map(s => `- ${s.stat}${s.context}`).join('\n')}

【文字数】
${charCount}文字程度

【AIO最適化要件】
1. **定義セクション**: 「〇〇とは」で始まる明確な定義文を冒頭に
2. **数字を含む文章**: 統計、実績、期間など具体的な数字を多用
3. **リスト形式**: 箇条書きや番号リストを活用（AIが抽出しやすい）
4. **FAQ形式**: よくある質問と回答を2-3個含める
5. **ステップガイド**: 「〇〇の始め方」などの手順を含める
6. **比較表**: 可能であれば選択肢の比較表を含める

【構成】
1. H1: キーワードを含む魅力的なタイトル
2. 導入文: 「〇〇とは、△△です。」で始まる定義
3. H2: 〇〇のメリット・デメリット
4. H2: 〇〇の始め方（ステップ形式）
5. H2: よくある質問（FAQ）
6. H2: まとめ + CTA

【出力形式】
JSON:
{
  "title": "記事タイトル",
  "metaDescription": "メタディスクリプション（120文字以内）",
  "content": "記事本文（HTML）",
  "faqs": [
    { "question": "質問", "answer": "回答" }
  ],
  "suggestedTags": ["タグ1", "タグ2"]
}

JSONのみを出力してください。`;
}

/**
 * FAQ HTMLセクションを生成
 */
export function generateFAQSection(faqs: FAQItem[]): string {
  const faqItems = faqs.map(faq => `
<div class="faq-item">
  <h4 class="faq-question">Q. ${faq.question}</h4>
  <p class="faq-answer">A. ${faq.answer}</p>
</div>`).join('\n');

  return `<div class="faq-section">
<h2>よくある質問</h2>
${faqItems}
</div>`;
}

/**
 * 記事にAIO最適化要素を追加
 */
export function enhanceContentForAIO(
  content: string,
  faqs: FAQItem[],
  businessType: 'liver-agency' | 'chat-lady'
): { enhancedContent: string; schemas: object[] } {
  // FAQ構造化データ
  const faqSchema = generateFAQSchema(faqs);

  // FAQ HTMLセクション（既存のFAQセクションがなければ追加）
  let enhancedContent = content;
  if (!content.includes('よくある質問') && !content.includes('FAQ')) {
    const faqSection = generateFAQSection(faqs);
    // まとめセクションの前に挿入
    if (content.includes('<h2>まとめ')) {
      enhancedContent = content.replace(/<h2>まとめ/i, `${faqSection}\n\n<h2>まとめ`);
    } else {
      enhancedContent = content + '\n\n' + faqSection;
    }
  }

  // 権威性セクション（既存の「選ばれる理由」がなければ追加）
  if (!content.includes('選ばれる理由') && !content.includes('実績')) {
    const authoritySection = generateAuthoritySection(businessType);
    // 最初のH2の前に挿入
    const firstH2Match = enhancedContent.match(/<h2>/i);
    if (firstH2Match) {
      enhancedContent = enhancedContent.replace(/<h2>/i, `${authoritySection}\n\n<h2>`);
    }
  }

  return {
    enhancedContent,
    schemas: [faqSchema]
  };
}

export type { FAQItem, ArticleSchema, HowToStep, AuthorityStats };
