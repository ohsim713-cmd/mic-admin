import { NextResponse } from 'next/server';
import { getModel } from '@/lib/vertex-ai';

// ===== 投稿タイプ定義 (15種類) =====
const POST_TYPES = {
  greeting: {
    id: 'greeting',
    label: '挨拶系',
    description: '朝夜の挨拶、フォロワーとの関係構築',
    hasImage: false,
    frequency: 'daily',
    structure: '時間帯に合わせた挨拶 → 今日の予定/振り返り → 軽いCTA',
  },
  question: {
    id: 'question',
    label: '質問系',
    description: 'フォロワーの悩みを引き出す質問',
    hasImage: false,
    frequency: 'weekly-1-2',
    structure: '共感できる質問 → 補足説明 → 回答誘導',
  },
  tips: {
    id: 'tips',
    label: 'Tips系',
    description: '役立つ情報、ノウハウ共有',
    hasImage: true,
    frequency: 'daily',
    structure: '「実は〜」で始まる豆知識 → 具体例 → 実践誘導',
  },
  achievement: {
    id: 'achievement',
    label: '実績系',
    description: '所属ライバーの成果報告',
    hasImage: true,
    frequency: 'weekly-1',
    structure: '成果数値 → 背景/ストーリー → 再現性アピール',
  },
  casual: {
    id: 'casual',
    label: '雑談系',
    description: '日常の話題、親近感',
    hasImage: false,
    frequency: 'weekly-3-4',
    structure: '日常の一コマ → 共感ポイント → 軽い問いかけ',
  },
  empathy: {
    id: 'empathy',
    label: '共感系',
    description: 'ターゲットの悩みに寄り添う',
    hasImage: false,
    frequency: 'weekly-2-3',
    structure: '「〜という方も多いですよね」→ 寄り添い → 解決の糸口',
  },
  recruitment: {
    id: 'recruitment',
    label: '募集系',
    description: 'メイン宣伝、応募誘導',
    hasImage: true,
    frequency: 'weekly-2-3',
    structure: 'メリット提示 → 具体的条件 → 明確なCTA',
  },
  story: {
    id: 'story',
    label: 'ストーリー系',
    description: '実際のライバーのエピソード',
    hasImage: false,
    frequency: 'weekly-2-3',
    structure: '「先日〜という方がいて」→ 経緯 → 結果/感想',
  },
  encouragement: {
    id: 'encouragement',
    label: '応援系',
    description: '頑張る人への応援メッセージ',
    hasImage: false,
    frequency: 'weekly-2-3',
    structure: '頑張る姿への言及 → 応援メッセージ → 前向きな締め',
  },
  data: {
    id: 'data',
    label: 'データ系',
    description: '統計・数字で説得力を持たせる',
    hasImage: true,
    frequency: 'weekly-1-2',
    structure: '印象的な数字 → 解説 → インサイト',
  },
  closing: {
    id: 'closing',
    label: '締め系',
    description: '1日の締め、明日への期待',
    hasImage: false,
    frequency: 'daily',
    structure: '今日の振り返り → 感謝 → 明日の予告',
  },
  insight: {
    id: 'insight',
    label: 'インサイト系',
    description: '業界の本音、裏話',
    hasImage: false,
    frequency: 'weekly-1-2',
    structure: '「意外と知られていないのですが」→ 内部情報 → 価値提供',
  },
} as const;

// ===== 1日15投稿スケジュール =====
const DAILY_SCHEDULE = [
  { time: '07:00', type: 'greeting', label: '朝の挨拶' },
  { time: '09:00', type: 'question', label: '朝の質問' },
  { time: '10:00', type: 'tips', label: '午前Tips' },
  { time: '11:00', type: 'achievement', label: '実績紹介' },
  { time: '12:00', type: 'casual', label: 'ランチ雑談' },
  { time: '14:00', type: 'empathy', label: '午後の共感' },
  { time: '16:00', type: 'tips', label: '夕方Tips' },
  { time: '18:00', type: 'recruitment', label: 'メイン宣伝' },
  { time: '19:00', type: 'story', label: 'ストーリー' },
  { time: '20:00', type: 'question', label: '夜の質問' },
  { time: '21:00', type: 'encouragement', label: '応援' },
  { time: '22:00', type: 'data', label: 'データ紹介' },
  { time: '23:00', type: 'casual', label: '夜の雑談' },
  { time: '00:00', type: 'closing', label: '1日の締め' },
  { time: '02:00', type: 'insight', label: '深夜インサイト' },
];

// ===== 具体的エピソード素材 =====
const EPISODE_TEMPLATES = {
  achievement: [
    { persona: '2児のママ', age: 32, hours: '2時間/日', income: '月12万円', period: '3ヶ月目' },
    { persona: '会社員（副業）', age: 28, hours: '平日夜2時間', income: '月8万円', period: '半年' },
    { persona: '専業主婦', age: 35, hours: '子供が寝てから3時間', income: '月15万円', period: '1年' },
    { persona: '大学生', age: 21, hours: '週末のみ', income: '月5万円', period: '2ヶ月目' },
    { persona: 'シングルマザー', age: 30, hours: '在宅で4時間', income: '月20万円', period: '8ヶ月' },
  ],
  story: [
    { situation: '転職活動中に副収入が欲しくて', turning: 'スマホ1台で始められると知り', result: '今では本業より稼いでいます' },
    { situation: '子供の教育費が心配で', turning: '顔出し不要と聞いて安心し', result: '毎月の習い事代を余裕で払えるように' },
    { situation: 'パートの収入に限界を感じて', turning: '時間の自由度に惹かれて', result: '今は自分のペースで月10万円以上' },
    { situation: '夫に内緒でお小遣いが欲しくて', turning: '完全匿名でできると知り', result: '今では自分名義の貯金ができました' },
  ],
  data: [
    { stat: '73%', context: '「副業に興味がある」と回答した20-30代女性の割合', source: '2025年調査' },
    { stat: '平均2.3時間', context: '当事務所ライバーの1日の稼働時間', source: '直近3ヶ月平均' },
    { stat: '89%', context: '未経験からスタートした方の割合', source: '所属ライバーアンケート' },
    { stat: '月収15万円以上', context: '週4日以上稼働される方の平均収入', source: '2025年実績' },
  ],
};

// ===== 禁止フレーズチェック =====
const BANNED_PHRASES = [
  'ガチで', 'マジで', '絶対', '確実', '100%', '!!!', '！！',
  '神', 'やばい', 'ヤバい', 'めっちゃ', 'めちゃ', 'まじ',
];

function checkBannedPhrases(text: string): string[] {
  return BANNED_PHRASES.filter(phrase => text.includes(phrase));
}

// ===== メインプロンプト生成 =====
function generatePrompt(
  postType: typeof POST_TYPES[keyof typeof POST_TYPES],
  scheduleItem: typeof DAILY_SCHEDULE[number],
  account: string
): string {
  const isRecruiting = postType.id === 'recruitment';
  const needsEpisode = ['achievement', 'story', 'data'].includes(postType.id);
  
  let episodeContext = '';
  if (needsEpisode && postType.id === 'achievement') {
    const ep = EPISODE_TEMPLATES.achievement[Math.floor(Math.random() * EPISODE_TEMPLATES.achievement.length)];
    episodeContext = `\n## 使用する実績データ\n- ペルソナ: ${ep.persona}（${ep.age}歳）\n- 稼働時間: ${ep.hours}\n- 収入: ${ep.income}\n- 期間: ${ep.period}`;
  } else if (needsEpisode && postType.id === 'story') {
    const ep = EPISODE_TEMPLATES.story[Math.floor(Math.random() * EPISODE_TEMPLATES.story.length)];
    episodeContext = `\n## 使用するストーリー\n- きっかけ: ${ep.situation}\n- 転機: ${ep.turning}\n- 結果: ${ep.result}`;
  } else if (needsEpisode && postType.id === 'data') {
    const ep = EPISODE_TEMPLATES.data[Math.floor(Math.random() * EPISODE_TEMPLATES.data.length)];
    episodeContext = `\n## 使用するデータ\n- 数字: ${ep.stat}\n- 内容: ${ep.context}\n- 出典: ${ep.source}`;
  }

  return `あなたはX（旧Twitter）でライバー事務所の認知拡大と応募獲得を担当しています。
1日15投稿で月30件の問い合わせを目指しています。

## 投稿タイプ
${postType.label}: ${postType.description}

## 投稿構成
${postType.structure}

## 投稿時間帯
${scheduleItem.time} - ${scheduleItem.label}
${episodeContext}

## 文体ルール【最重要】
- 敬語（です/ます調）を基本とする
- 丁寧だが堅すぎない、親しみやすい敬語
- 「〜ですよね」「〜かもしれませんね」など柔らかい表現を使う
- 「〜なんです」「〜だったりします」で親近感を出す

## 禁止事項【厳守】
- 「ガチで」「マジで」「やばい」「めっちゃ」は絶対禁止
- 「絶対」「確実」「100%」「神」も禁止
- ハッシュタグ禁止
- 連続感嘆符（！！、!!）禁止
- 同じフレーズの繰り返し禁止

## 投稿ルール
- 200-270文字（APIリミット280文字）
- 2-3段落に分ける（空行で区切る）
- 1文は30文字以内が理想
- 絵文字は最後に1個だけ（✨💬🌙など）
- 具体的な数字を入れる（時間、金額、日数、割合）
${isRecruiting ? '- 最後に「DMでお気軽にご相談ください」など明確なCTA' : '- CTAは自然な形で（強制しない）'}

## 良い例（敬語スタイル）

【挨拶系】
おはようございます。

今日も1日が始まりますね。
最近、「在宅で働きたいけど何から始めれば…」というご相談が増えています。

焦らなくて大丈夫です。
まずは情報収集から、ゆっくり考えてみてくださいね✨

【Tips系】
意外と知られていないのですが、ライバーの仕事って「話し上手」じゃなくても大丈夫なんです。

実際、うちの事務所では「聞き上手」な方のほうが人気だったりします。
相手の話に「うんうん」と頷くだけでも、十分なんですよ。

気になる方はプロフィールからどうぞ💬

【実績系】
先日、32歳・2児のママさんから嬉しいご報告がありました。

「子供が寝た後の2時間だけで、月12万円を超えました」とのこと。
始めて3ヶ月目だそうです。

顔出しなし、通勤ゼロ。
同じような状況の方、意外と多いんですよ✨

---

投稿文のみ出力してください。説明や補足は不要です。`;
}

// ===== 画像プロンプト生成 =====
function generateImagePrompt(postType: string): string | null {
  const prompts: Record<string, string> = {
    tips: 'シンプルでモダンな日本語インフォグラフィック、パステルカラー、ミニマルデザイン、副業・在宅ワークのTips、クリーンな背景',
    achievement: '成功を表現する抽象的なイラスト、上昇グラフ、暖色系、達成感、ポジティブな雰囲気、日本のビジネスウーマン',
    recruitment: 'スマートフォンを持つ女性のシルエット、自由なライフスタイル、在宅ワークイメージ、明るく温かい色調、プロフェッショナル',
    data: 'データビジュアライゼーション、円グラフや棒グラフ、ブルー系の配色、クリーンでモダン、インフォグラフィックスタイル',
  };
  return prompts[postType] || null;
}

// ===== API エンドポイント =====
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      mode = 'single',  // 'single' | 'schedule' | 'batch'
      type,             // 単一投稿時の投稿タイプ
      scheduleIndex,    // スケジュールインデックス (0-14)
      account = 'tt_liver',
      count = 1,        // batch時の生成数
    } = body;

    const model = getModel();

    // モード別処理
    if (mode === 'schedule') {
      // 1日分のスケジュール全体を返す
      const schedule = DAILY_SCHEDULE.map((item, index) => ({
        index,
        time: item.time,
        type: item.type,
        label: item.label,
        postType: POST_TYPES[item.type as keyof typeof POST_TYPES],
      }));
      
      return NextResponse.json({
        schedule,
        totalPosts: schedule.length,
      });
    }

    if (mode === 'batch') {
      // 複数投稿を一括生成
      const posts = [];
      const usedIndices = new Set<number>();
      
      for (let i = 0; i < Math.min(count, 15); i++) {
        let idx: number;
        do {
          idx = Math.floor(Math.random() * DAILY_SCHEDULE.length);
        } while (usedIndices.has(idx) && usedIndices.size < DAILY_SCHEDULE.length);
        usedIndices.add(idx);
        
        const scheduleItem = DAILY_SCHEDULE[idx];
        const postType = POST_TYPES[scheduleItem.type as keyof typeof POST_TYPES];
        const prompt = generatePrompt(postType, scheduleItem, account);
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.candidates?.[0].content.parts[0].text?.trim() || '';
        
        const bannedFound = checkBannedPhrases(text);
        
        posts.push({
          index: idx,
          text,
          type: postType.id,
          typeLabel: postType.label,
          scheduledTime: scheduleItem.time,
          scheduleLabel: scheduleItem.label,
          hasImage: postType.hasImage,
          imagePrompt: postType.hasImage ? generateImagePrompt(postType.id) : null,
          charCount: text.length,
          warnings: bannedFound.length > 0 ? `禁止フレーズ検出: ${bannedFound.join(', ')}` : null,
        });
      }
      
      return NextResponse.json({
        posts,
        generatedCount: posts.length,
        timestamp: new Date().toISOString(),
      });
    }

    // 単一投稿生成（デフォルト）
    let scheduleItem: typeof DAILY_SCHEDULE[number];
    let postType: typeof POST_TYPES[keyof typeof POST_TYPES];

    if (typeof scheduleIndex === 'number' && scheduleIndex >= 0 && scheduleIndex < DAILY_SCHEDULE.length) {
      // スケジュールインデックス指定
      scheduleItem = DAILY_SCHEDULE[scheduleIndex];
      postType = POST_TYPES[scheduleItem.type as keyof typeof POST_TYPES];
    } else if (type && POST_TYPES[type as keyof typeof POST_TYPES]) {
      // タイプ指定
      postType = POST_TYPES[type as keyof typeof POST_TYPES];
      scheduleItem = DAILY_SCHEDULE.find(s => s.type === type) || DAILY_SCHEDULE[0];
    } else {
      // ランダム
      const randomIndex = Math.floor(Math.random() * DAILY_SCHEDULE.length);
      scheduleItem = DAILY_SCHEDULE[randomIndex];
      postType = POST_TYPES[scheduleItem.type as keyof typeof POST_TYPES];
    }

    const prompt = generatePrompt(postType, scheduleItem, account);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.candidates?.[0].content.parts[0].text?.trim() || '';

    const bannedFound = checkBannedPhrases(text);

    return NextResponse.json({
      text,
      type: postType.id,
      typeLabel: postType.label,
      scheduledTime: scheduleItem.time,
      scheduleLabel: scheduleItem.label,
      hasImage: postType.hasImage,
      imagePrompt: postType.hasImage ? generateImagePrompt(postType.id) : null,
      charCount: text.length,
      warnings: bannedFound.length > 0 ? `禁止フレーズ検出: ${bannedFound.join(', ')}` : null,
      postTypes: Object.keys(POST_TYPES),
      schedule: DAILY_SCHEDULE,
    });

  } catch (error) {
    console.error('Error generating X post:', error);
    return NextResponse.json({ 
      error: 'Failed to generate content',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET: スケジュールと投稿タイプ一覧を取得
export async function GET() {
  return NextResponse.json({
    postTypes: Object.values(POST_TYPES).map(pt => ({
      id: pt.id,
      label: pt.label,
      description: pt.description,
      hasImage: pt.hasImage,
      frequency: pt.frequency,
    })),
    schedule: DAILY_SCHEDULE.map((item, index) => ({
      index,
      time: item.time,
      type: item.type,
      label: item.label,
    })),
    totalDailyPosts: DAILY_SCHEDULE.length,
    rules: {
      charLimit: { min: 200, max: 270 },
      bannedPhrases: BANNED_PHRASES,
      style: '敬語（です/ます調）',
    },
  });
}
