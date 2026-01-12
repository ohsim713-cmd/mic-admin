import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// 環境変数から API キーを取得（Vercel 用）
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
}
const genAI = new GoogleGenerativeAI(apiKey);

// knowledge フォルダは frontend 内に移動済み
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ナレッジファイルを読み込む（JSON）
function loadKnowledge(filename: string) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
}

// ナレッジファイルを読み込む（テキスト/Markdown）
function loadKnowledgeText(filename: string) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}

// フィードバックルールを読み込む
function loadFeedbackRules(businessType: string) {
    const filePath = path.join(KNOWLEDGE_DIR, 'feedback_rules.json');
    try {
        if (fs.existsSync(filePath)) {
            const rules = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return rules.filter((r: any) => r.businessType === businessType || r.businessType === 'all');
        }
    } catch (e) {
        console.error('Failed to load feedback rules:', e);
    }
    return [];
}

// 良い投稿例を読み込む
function loadGoodExamples(businessType: string, limit: number = 3) {
    const filePath = path.join(KNOWLEDGE_DIR, 'good_examples.json');
    try {
        if (fs.existsSync(filePath)) {
            const examples = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const filtered = examples.filter((e: any) => e.businessType === businessType || e.businessType === 'all');
            // 最新のものから取得
            return filtered.slice(-limit);
        }
    } catch (e) {
        console.error('Failed to load good examples:', e);
    }
    return [];
}

// 5,000行からランダムに1件、質の高い投稿をピックアップする
function getRandomPost(rawText: string): string {
    if (!rawText) return "";
    const lines = rawText.split("\n");
    const processed = lines
        .map(line => {
            const parts = line.split("\t");
            let content = parts.length > 1 ? parts[1] : parts[0];
            return content.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
        })
        .filter(c => c.length > 50 && !c.includes("http") && c !== "Text");

    if (processed.length === 0) return "";
    return processed[Math.floor(Math.random() * processed.length)];
}

export async function POST(request: Request) {
    try {
        const { target: inputTarget, postType: inputPostType, keywords, referencePost, businessType = 'chat-lady', autoMode = false, postGoal, postAngle } = await request.json();

        const knowledgeBaseDir = path.join(process.cwd(), "knowledge");

        // theme_options.jsonから読み込み
        let themeOptionsData: any = null;
        try {
            themeOptionsData = loadKnowledge('theme_options.json');
        } catch (e) {
            console.error('Failed to load theme_options.json:', e);
        }

        // ターゲットプロファイル（不安・悩み付き）
        const targetProfiles = themeOptionsData?.targetProfiles || [
            { id: 'default', label: '完全未経験', concerns: ['本当に稼げるの？'], desires: ['安心して始めたい'] }
        ];

        // フックパターン
        const hookPatterns = themeOptionsData?.hookPatterns || [
            'ぶっちゃけ、〇〇って思ってない？',
            '正直に言います。',
            '誰にも言えなかったけど、'
        ];

        // テーマをフラット化
        const themeCategories = themeOptionsData?.themeOptions || {};
        const themeOptions = Object.values(themeCategories).flat() as string[];

        // X伸ばし方の知識
        const xGrowthKnowledge = themeOptionsData?.xGrowthKnowledge || {};

        // 目的別・切り口の設定
        const postGoals = themeOptionsData?.postGoals || [];
        const postAngles = themeOptionsData?.postAngles || [];

        // 選択された目的と切り口を取得
        const selectedGoalData = postGoal ? postGoals.find((g: any) => g.id === postGoal) : null;
        const selectedAngleData = postAngle ? postAngles.find((a: any) => a.id === postAngle) : null;

        // 自動モードの場合はランダムに選択
        const finalGoalData = selectedGoalData || (autoMode ? postGoals[Math.floor(Math.random() * postGoals.length)] : null);
        const finalAngleData = selectedAngleData || (autoMode ? postAngles[Math.floor(Math.random() * postAngles.length)] : null);

        // フィードバックルールと良い例を読み込む
        const feedbackRules = loadFeedbackRules(businessType);
        const goodExamples = loadGoodExamples(businessType, 3);

        // 自動モードならランダムに選択
        const selectedTargetProfile = autoMode
            ? targetProfiles[Math.floor(Math.random() * targetProfiles.length)]
            : targetProfiles.find((t: any) => t.label === inputTarget) || targetProfiles[0];

        const target = selectedTargetProfile.label;
        const targetConcerns = selectedTargetProfile.concerns || [];
        const targetDesires = selectedTargetProfile.desires || [];
        const postType = autoMode ? themeOptions[Math.floor(Math.random() * themeOptions.length)] : (inputPostType || '実績・収入投稿');

        // ビジネスタイプ別の知識の読み取り
        const internalDataFile = businessType === 'liver-agency'
            ? 'liver_agency_internal_data.txt'
            : 'chat_lady_internal_data.txt';

        let internalData = "";
        try {
            internalData = fs.readFileSync(path.join(knowledgeBaseDir, internalDataFile), "utf-8");
        } catch (e) {
            // フォールバック: 古いファイルを試す
            try {
                internalData = fs.readFileSync(path.join(knowledgeBaseDir, "internal_data.txt"), "utf-8");
            } catch (e2) { }
        }

        let pastPosts = "";
        try {
            pastPosts = fs.readFileSync(path.join(knowledgeBaseDir, "past_posts.txt"), "utf-8");
        } catch (e) { }

        // 1. Opal方式：参考投稿がある場合はそれを使用、なければ過去ログからランダムに抽出
        const seededPost = referencePost || getRandomPost(pastPosts);

        // ビジネスタイプに応じた用語設定
        const businessTerms = businessType === 'liver-agency'
            ? { industry: 'ライブ配信業界', role: 'ライバー事務所', person: 'ライバー', audience: 'リスナー' }
            : { industry: 'チャトレ業界', role: 'チャットレディ事務所', person: 'キャスト', audience: 'お客様' };

        // チャットレディ用ナレッジを読み込む
        let knowledgeContext = '';
        if (businessType === 'chat-lady') {
            const chatladyTrends = loadKnowledge('chatlady_trends.json');
            const recruitmentCopy = loadKnowledge('recruitment_copy.json');
            const agencyKnowledge = loadKnowledgeText('agency_knowledge.md');

            // agency_knowledge.mdから事務所情報を追加
            if (agencyKnowledge) {
                // 最初の3000文字を使用（重要な情報が上部にある）
                knowledgeContext += `
【事務所情報（Mignon Group）】
${agencyKnowledge.substring(0, 3000)}
`;
            }

            if (chatladyTrends) {
                const industryTrends = chatladyTrends.industryTrends;
                const incomeInfo = industryTrends?.averageIncome;
                const latestTrends = industryTrends?.latestTrends;
                const workingStyles = industryTrends?.workingStyles;
                const goldenTime = industryTrends?.goldenTime;
                const targets = chatladyTrends.targetAudienceAnalysis?.primaryTargets;
                const triggers = chatladyTrends.targetAudienceAnalysis?.psychologicalTriggers;
                const platforms = chatladyTrends.platformAnalysis;
                const platformComparison = chatladyTrends.platformComparison;
                const safety = chatladyTrends.safetyAndPrivacy;
                const beginnerGuide = chatladyTrends.beginnerGuide;
                const earningTips = chatladyTrends.earningTips;

                // 収入情報
                knowledgeContext += `
【収入の実態】
- 初心者: ${incomeInfo?.beginner || '時給3,000円〜'}
- 中級者: ${incomeInfo?.intermediate || '時給4,000円〜6,000円'}
- 経験者: ${incomeInfo?.experienced || '時給5,000円〜1万円'}
- トップ: ${incomeInfo?.top || '月100万円以上'}
`;

                // 最新トレンド
                if (latestTrends && latestTrends.length > 0) {
                    knowledgeContext += `
【2026年最新トレンド】
${latestTrends.slice(0, 3).map((t: string) => `- ${t}`).join('\n')}
`;
                }

                // 働き方
                if (workingStyles) {
                    knowledgeContext += `
【働き方の選択肢】
- 通勤型: ${workingStyles.commute?.pros?.slice(0, 2).join('、') || '設備完備、サポートあり'}
- 在宅型: ${workingStyles.remote?.pros?.slice(0, 2).join('、') || '報酬率高い、自由'}
- アプリ型: ${workingStyles.app?.pros?.slice(0, 2).join('、') || 'スマホ1台でOK'}
- ゴールデンタイム: ${goldenTime || '22時〜2時'}
`;
                }

                // サイト情報（詳細）
                if (platforms) {
                    knowledgeContext += `
【サイト別詳細】
◆DXLIVE: ${platforms.DXLIVE?.features?.slice(0, 2).join('、')}
  収入: ${platforms.DXLIVE?.income?.twoShot || '時給約1.1万円'}
  特徴: ${platforms.DXLIVE?.bestFor || '安全に高収入狙う人向け'}
◆STRIPCHAT: ${platforms.STRIPCHAT?.features?.slice(0, 2).join('、')}
  還元率: 最大80%
  特徴: ${platforms.STRIPCHAT?.bestFor || '本気で高収入狙う人向け'}
◆FC2ライブ: ${platforms['FC2ライブ']?.features?.slice(0, 2).join('、')}
  収入: ${platforms['FC2ライブ']?.income?.range || '時給5万〜30万円（個人差大）'}
◆FC2 LOVETIP: ${platforms.FC2_LOVETIP?.features?.slice(0, 2).join('、')}
  特徴: ${platforms.FC2_LOVETIP?.bestFor || '初心者向け、ノンアダOK'}
`;
                }

                // サイト選びの指針
                if (platformComparison) {
                    knowledgeContext += `
【サイト選びの指針】
- ${platformComparison.summary || ''}
- 初心者向け: ${platformComparison.forBeginners || ''}
- 経験者向け: ${platformComparison.forExperienced || ''}
`;
                }

                // 身バレ対策
                if (safety) {
                    const prevention = safety.preventionMeasures;
                    knowledgeContext += `
【身バレ対策（実践的）】
- 確率: ${safety.bodyBareRisk?.probability || '100人に1人程度。対策すれば防げる'}
- 外見対策: ${prevention?.appearance?.slice(0, 3).join('、') || 'マスク、ウィッグ、メイク変更'}
- 個人情報: ${prevention?.personalInfo?.slice(0, 2).join('、') || '偽名使用、年齢もごまかす'}
- 税金対策: ${prevention?.tax?.[0] || '確定申告で普通徴収を選択'}
`;
                }

                // 稼ぐコツ
                if (earningTips?.basics) {
                    knowledgeContext += `
【稼ぐコツ】
${earningTips.basics.slice(0, 3).map((t: any) => `- ${t.tip}: ${t.detail}`).join('\n')}
`;
                }

                // 初心者ガイド
                if (beginnerGuide) {
                    knowledgeContext += `
【未経験者向け情報】
- 必要なもの: ${beginnerGuide.requirements?.slice(0, 3).join('、') || 'スマホ、ネット環境、身分証'}
- 収入目安: ${beginnerGuide.incomeExpectation?.first3months || '月5万〜10万円'}
- ポイント: ${beginnerGuide.incomeExpectation?.note || '男性は素人感を好む傾向'}
`;
                }

                // ターゲット別メッセージ
                if (targets && targets.length > 0) {
                    const matchedTarget = targets.find((t: any) =>
                        (target.includes('未経験') && t.persona.includes('大学生')) ||
                        (target.includes('経験者') && t.persona.includes('夜職')) ||
                        (target.includes('夜職') && t.persona.includes('夜職'))
                    ) || targets[0];

                    if (matchedTarget) {
                        knowledgeContext += `
【ターゲット: ${matchedTarget.persona}】
- 状況: ${matchedTarget.currentSituation}
- 動機: ${matchedTarget.motivations?.join('、')}
- 不安: ${matchedTarget.concerns?.join('、')}
- 効果的メッセージ例: ${matchedTarget.effectiveMessages?.[0] || ''}
`;
                    }
                }

                // 心理トリガー
                if (triggers) {
                    knowledgeContext += `
【刺さるポイント】
- 欲求: ${triggers.desires?.slice(0, 4).join('、') || '高収入、自由、承認欲求'}
- 不安解消: ${triggers.barriers?.slice(0, 3).join('、') || '身バレ、未経験、安全性'}
`;
                }

                // グローバル業界統計（新規追加）
                const globalStats = chatladyTrends.globalIndustryStats;
                if (globalStats) {
                    knowledgeContext += `
【業界統計データ（信頼性向上に活用）】
- 世界市場規模: ${globalStats.marketSize?.value || '16億ドル'}
- アクティブモデル数: ${globalStats.workforce?.activeModels || '100万人以上'}
- 平均時給（海外）: ${globalStats.earnings?.hourlyAverage?.overall || '$58.77'}
- トップ10%年収: ${globalStats.earnings?.annualEarnings?.top10percent || '$100,000以上'}
`;
                }

                // 求人訴求ポイント（新規追加）
                const appealPoints = chatladyTrends.recruitmentAppealPoints;
                if (appealPoints) {
                    knowledgeContext += `
【求人で刺さるポイント】
未経験者向け: ${appealPoints.forBeginners?.slice(0, 2).join('、') || ''}
収入面: ${appealPoints.forIncome?.slice(0, 2).join('、') || ''}
安全面: ${appealPoints.forSafety?.slice(0, 2).join('、') || ''}
年齢層: ${appealPoints.forAge?.slice(0, 2).join('、') || ''}
`;
                }
            }

            // 成功事例を読み込み（新規追加）
            const successStories = loadKnowledge('success_stories.json');
            if (successStories?.successStories) {
                const stories = successStories.successStories.slice(0, 3);
                knowledgeContext += `
【実際の成功事例（投稿で使える）】
${stories.map((s: any) => `- ${s.persona}: ${s.period}で月${s.results.peakMonth}達成（${s.site}利用、${s.workStyle.hoursPerDay}・${s.workStyle.daysPerWeek}）`).join('\n')}
`;
                // 成功パターン
                if (successStories.commonSuccessPatterns) {
                    knowledgeContext += `
【成功パターン】
${successStories.commonSuccessPatterns.slice(0, 3).map((p: any) => `- ${p.pattern}: ${p.description}`).join('\n')}
`;
                }
            }

            // FAQ情報を読み込み（新規追加）
            const faqData = loadKnowledge('faq.json');
            if (faqData?.quickAnswers) {
                knowledgeContext += `
【よくある質問への回答（投稿で使える）】
${Object.entries(faqData.quickAnswers).slice(0, 5).map(([q, a]) => `- ${q}: ${a}`).join('\n')}
`;
            }

            // 配信テクニック（新規追加）
            const streamingTechniques = loadKnowledge('streaming_techniques.json');
            if (streamingTechniques?.streamingTechniques?.beginner?.firstWeek) {
                const tips = streamingTechniques.streamingTechniques.beginner.firstWeek.slice(0, 3);
                knowledgeContext += `
【初心者向け配信テクニック】
${tips.map((t: any) => `- ${t.tip}: ${t.detail}`).join('\n')}
`;
            }

            // 収入シミュレーション（新規追加）
            const incomeSimulation = loadKnowledge('income_simulation.json');
            if (incomeSimulation?.incomeSimulations) {
                const patterns = incomeSimulation.incomeSimulations['副業パターン']?.slice(0, 2) || [];
                knowledgeContext += `
【収入シミュレーション例】
${patterns.map((p: any) => `- ${p.pattern}: 初心者${p.estimatedIncome.beginner.average}〜経験者${p.estimatedIncome.experienced.average}`).join('\n')}
`;
            }

            // 身バレ対策（新規追加）
            const privacyProtection = loadKnowledge('privacy_protection.json');
            if (privacyProtection?.privacyProtection?.overview) {
                knowledgeContext += `
【身バレ対策】
- リスク: ${privacyProtection.privacyProtection.overview.riskLevel}
- 対策例: マスク、ウィッグ、メイク変更、偽名使用、背景設定
`;
            }

            // 年齢別戦略（新規追加）
            const ageStrategies = loadKnowledge('age_strategies.json');
            if (ageStrategies?.ageStrategies) {
                const ages = ['30-39歳', '40-49歳'];
                const strategies = ages.map(age => {
                    const data = ageStrategies.ageStrategies[age];
                    return data ? `${age}: ${data.advantages?.slice(0, 2).join('、')}` : '';
                }).filter(Boolean);
                knowledgeContext += `
【年齢別の強み】
${strategies.map(s => `- ${s}`).join('\n')}
`;
            }

            // 季節・イベント情報（新規追加）
            const seasonalTips = loadKnowledge('seasonal_tips.json');
            if (seasonalTips?.seasonalTips?.月別) {
                const currentMonth = new Date().getMonth() + 1;
                const monthKey = `${currentMonth}月`;
                const monthData = seasonalTips.seasonalTips.月別[monthKey];
                if (monthData) {
                    knowledgeContext += `
【今月の稼ぎ方（${monthKey}）】
- 需要: ${monthData.demand}
- ポイント: ${monthData.tips?.slice(0, 2).join('、') || ''}
`;
                }
            }

            // X（Twitter）運用戦略（新規追加）
            const xStrategies = loadKnowledge('x_strategies.json');
            if (xStrategies?.xStrategies) {
                const algo = xStrategies.xStrategies.algorithm2025;
                const quickRef = xStrategies.xStrategies.quickReference;
                const chatladyTips = xStrategies.xStrategies.chatladySpecificTips;

                knowledgeContext += `
【X（Twitter）2025年アルゴリズム対応】
- ${quickRef?.['2025MustKnow']?.slice(0, 4).join('\n- ') || ''}

【X投稿で伸びる要素】
${algo?.whatWorksNow?.slice(0, 3).map((w: string) => `- ${w}`).join('\n') || ''}

【X投稿NG】
${algo?.whatDoesntWork?.slice(0, 2).map((w: string) => `- ${w}`).join('\n') || ''}

【チャットレディ求人X投稿のコツ】
${chatladyTips?.effectiveMessages?.slice(0, 3).map((m: string) => `- ${m}`).join('\n') || ''}
`;

                // 最適な投稿時間
                const timing = xStrategies.xStrategies.optimalPostingTime;
                if (timing?.goldenTimes) {
                    knowledgeContext += `
【X投稿ベストタイミング】
- 朝: ${timing.goldenTimes.morningPeak}
- 夜: ${timing.goldenTimes.eveningPeak}
- ベスト: ${timing.goldenTimes.bestOverall}
`;
                }
            }

            if (recruitmentCopy) {
                const objections = recruitmentCopy.objectionHandling?.common || chatladyTrends?.copywritingFormulas?.objectionHandling;
                const ctas = recruitmentCopy.ctaPatterns?.lowBarrier || chatladyTrends?.copywritingFormulas?.callToActions?.lowBarrier;

                if (objections && objections.length > 0) {
                    knowledgeContext += `
【不安への回答パターン】
${objections.slice(0, 4).map((o: any) => `- 「${o.objection}」→ ${o.response}`).join('\n')}
`;
                }
                if (ctas && ctas.length > 0) {
                    knowledgeContext += `
【効果的なCTA】
${ctas.slice(0, 3).map((c: any) => typeof c === 'string' ? `- ${c}` : `- ${c.text}`).join('\n')}
`;
                }
            }
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        // 【ステップ1】 投稿の「教訓」と「型」を抽出させる（AI内部思考）
        const extractPrompt = `
あなたは業界を知り尽くした事務所代表です。
以下の過去の投稿文から、【${businessTerms.industry}で通用する本質的で抽象的な教訓】と【投稿の型（構成）】を抜き出してください。

【過去の投稿】
${seededPost}

余計な挨拶は不要です。教訓と型だけを簡潔に出力してください。
`;

        const extractResult = await model.generateContent(extractPrompt);
        const insights = extractResult.response.text();

        // フックパターンからランダムに1つ選択
        const selectedHook = hookPatterns[Math.floor(Math.random() * hookPatterns.length)];

        // X伸ばし方の知識をプロンプト用に整形
        const xGrowthContext = xGrowthKnowledge ? `
### 📈 X（Twitter）で伸びる投稿の法則
【基本原則】
${(xGrowthKnowledge.基本原則 || []).slice(0, 3).map((r: string) => `- ${r}`).join('\n')}

【フック文のコツ】
${(xGrowthKnowledge.フック文のコツ || []).slice(0, 3).map((r: string) => `- ${r}`).join('\n')}

【伸びやすいパターン】
${(xGrowthKnowledge.伸びやすい投稿パターン || []).slice(0, 3).map((r: string) => `- ${r}`).join('\n')}

【NG】
${(xGrowthKnowledge.やってはいけないこと || []).slice(0, 2).map((r: string) => `- ${r}`).join('\n')}
` : '';

        // フィードバックルールをプロンプト用に整形
        const feedbackContext = feedbackRules.length > 0 ? `
### 🚫 学習済みルール（過去のフィードバックから）
以下のルールを必ず守ってください：
${feedbackRules.map((r: any) => `- ${r.rule}${r.reason ? `（理由: ${r.reason}）` : ''}`).join('\n')}
` : '';

        // 良い例をプロンプト用に整形
        const goodExamplesContext = goodExamples.length > 0 ? `
### ✅ 承認された良い投稿例（参考にしてください）
${goodExamples.map((e: any, i: number) => `【例${i + 1}】\n${e.post}`).join('\n\n')}
` : '';

        // 目的別・切り口のプロンプト追加
        const goalContext = finalGoalData ? `
### 🎯 投稿の目的【重要】
目的: ${finalGoalData.label}
狙い: ${finalGoalData.description}
【執筆のコツ】${finalGoalData.promptHint}
${finalGoalData.cta ? `【CTA】最後に「${finalGoalData.cta}」のような誘導を自然に入れる` : ''}
` : '';

        const angleContext = finalAngleData ? `
### 📐 切り口・構成【重要】
切り口: ${finalAngleData.label}
効果: ${finalAngleData.description}
【構成のコツ】${finalAngleData.promptHint}
` : '';

        // メリット一覧（ランダムに1つ選ぶ）
        const benefitOptions = [
            // 働き方・自由系
            { id: 'no-commute', label: '通勤ゼロ', description: '満員電車なし。家から一歩も出ずに稼げる。移動時間ゼロで1日2時間浮く', howTo: '在宅ワークを始めるだけ。登録したその日から家で働ける' },
            { id: 'time-free', label: '完全シフト自由', description: '朝5時でも深夜2時でもOK。週1でも毎日でも自分で決められる', howTo: '好きな時間にログインするだけ。予約も申請も不要' },
            { id: 'pajama-work', label: 'パジャマで仕事OK', description: 'メイクなし、着替えなし。起きたらそのまま仕事開始できる', howTo: 'スマホかPCがあれば、ベッドの上でも稼げる' },
            { id: 'no-relations', label: '人間関係ストレスゼロ', description: '上司なし、同僚なし、先輩後輩なし。誰にも気を使わない', howTo: '完全個人プレー。チームワークも飲み会も一切なし' },
            { id: 'kids-ok', label: '子供がいてもできる', description: '子供が寝てる間の2時間だけでOK。急な発熱でも休める', howTo: '短時間からスタート可能。1日1時間でも収入になる' },

            // 収入系
            { id: 'daily-pay', label: '日払い対応', description: '働いた翌日に振込。急な出費にもすぐ対応できる', howTo: '申請すれば翌日入金。週払い・月払いも選べる' },
            { id: 'high-hourly', label: '時給3,000円〜', description: 'コンビニバイトの3倍以上。同じ時間働いて3倍稼げる', howTo: '登録して配信を始めるだけ。経験者なら時給5,000円以上も' },
            { id: 'income-10man', label: '月10万円の副収入', description: '週3日×3時間で月10万円。本業にプラスで生活が変わる', howTo: '空いてる時間を使うだけ。本業バレなしで副収入' },
            { id: 'income-30man', label: '月30万円を在宅で', description: '1日4時間×週5で月30万円。フルタイムパートの2倍の収入', howTo: '本気で取り組めば3ヶ月で到達。サポート体制あり' },
            { id: 'income-50man', label: '月50万円超えも現実的', description: 'トップ層は月100万円以上。努力次第で青天井', howTo: 'コツを掴めば半年で到達。ノウハウは全部教えます' },
            { id: 'bonus-system', label: 'ボーナス・歩合あり', description: '基本報酬+インセンティブ。頑張りがそのまま収入に', howTo: 'ランキング上位や継続特典など、やればやるほど稼げる仕組み' },

            // 安心・安全系
            { id: 'anonymous', label: '完全匿名OK', description: '本名不要、顔出し不要、年齢も偽装OK。誰にもバレない', howTo: 'ニックネーム登録だけ。マスク・ウィッグ使用者多数' },
            { id: 'no-face', label: '顔出しなしで稼げる', description: 'マスクOK、手元だけ配信OK。80%が顔出しなしで稼いでる', howTo: '顔を出さないスタイルでも月20万円以上稼ぐ人多数' },
            { id: 'privacy-safe', label: '身バレ対策万全', description: 'IP制限、知り合いブロック機能あり。徹底的に守れる', howTo: '専用ツールで対策。身バレ率は対策すればほぼゼロ' },
            { id: 'no-touch', label: '非接触で安全', description: '誰とも会わない、触られない。画面越しだから100%安全', howTo: 'オンライン完結。実際に会う必要は一切なし' },

            // ハードル低い系
            { id: 'beginner-ok', label: '完全未経験から始められる', description: '特別なスキル不要。スマホが使えれば誰でもできる', howTo: '登録は5分。マニュアルとサポートありで初日から稼げる' },
            { id: 'smartphone', label: 'スマホ1台で完結', description: '初期費用ゼロ、機材不要。今持ってるスマホでOK', howTo: 'アプリを入れるだけ。PCがなくても問題なし' },
            { id: 'age-30s', label: '30代から始める人が多い', description: '20代より30代の方が稼げる。落ち着きと会話力が武器になる', howTo: '年齢は強み。大人の女性を求めるユーザーは多い' },
            { id: 'age-40s', label: '40代でも需要あり', description: '40代の方が指名率高いことも。経験と包容力が価値になる', howTo: '熟女カテゴリは常に人気。年齢を活かして稼ぐ' },
            { id: 'trial-ok', label: 'お試し感覚で始められる', description: '合わなければすぐ辞められる。ノルマなし、違約金なし', howTo: 'まず1日だけ試してみる。続けるかは後から決めればOK' },

            // 生活改善系
            { id: 'save-money', label: '貯金が増える', description: '月5万円の副収入で年間60万円の貯金。将来の不安が消える', howTo: '空き時間を収入に変えるだけ。生活費はそのままで貯金UP' },
            { id: 'loan-payoff', label: '借金・ローン返済に', description: '毎月の返済がラクになる。完済して身軽になった人多数', howTo: '副業収入を返済に回す。精神的にもラクになる' },
            { id: 'quit-job', label: '嫌な仕事を辞められる', description: '在宅収入が安定したら本業を辞める選択肢も。実際に脱サラした人多数', howTo: 'まず副業で始めて、収入が安定したら独立を検討' },
            { id: 'luxury', label: 'ちょっと贅沢ができる', description: '我慢してたものが買える。旅行も外食も気兼ねなく', howTo: '月数万円の余裕で生活の質が上がる' },
        ];
        const selectedBenefit = benefitOptions[Math.floor(Math.random() * benefitOptions.length)];

        // 【ステップ2】 メリット特化の投稿を作成
        const finalPrompt = `
あなたは在宅ワーク求人のプロコピーライターです。
**「${selectedBenefit.label}」** というメリットを伝える投稿を書いてください。

### 🎯 今回伝えるメリット
**${selectedBenefit.label}**
${selectedBenefit.description}

### 💡 このメリットを得る方法
${selectedBenefit.howTo}

### 📝 投稿の構成
1. **メリットをドーンと出す**（1文目で興味を引く）
2. **具体的な数字や事例**で信頼性UP
3. **どうすれば得られるか**を軽く触れる
4. **CTA**で締める（DMへ誘導）

### 書き出し例：
- 「通勤なし、人間関係なし、時間自由。これが私の働き方」
- 「週3日、1日3時間で月15万。在宅ワークの現実」
- 「顔出しなしで月20万稼いでる。誰にもバレてない」
- 「40代、未経験から始めて3ヶ月で月収30万になった」
- 「子供が寝た後の2時間で月8万円。これがリアル」

### ✍️ ルール
- 文字数: 200-280文字（短く刺さる）
- 数字を入れる（時間、金額、日数など）
- 「私」視点のリアルな体験談風に
- ハッシュタグ禁止
- 2-3行ごとに空行
- 最後に「気になる人はDMで💬」などCTAを入れる

投稿文のみ出力。余計な説明不要。
`;

        // ストリーミングで出力
        const result = await model.generateContentStream(finalPrompt);

        // メタ情報を生成（自信度は3-5のランダム）
        const confidence = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
        const metaInfo = JSON.stringify({
            target,
            theme: selectedBenefit.label,
            benefit: selectedBenefit.label,
            benefitDescription: selectedBenefit.description,
            confidence,
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    // 最初にメタ情報を送信
                    controller.enqueue(encoder.encode(`<!--META:${metaInfo}-->\n`));

                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        controller.enqueue(encoder.encode(chunkText));
                    }
                    controller.close();
                } catch (e) {
                    controller.error(e);
                }
            },
        });

        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

    } catch (error: any) {
        console.error('Generation Error Detail:', {
            message: error.message,
            stack: error.stack,
            model: "gemini-3-flash-preview"
        });
        return new Response(JSON.stringify({
            error: error.message,
            detail: "Gemini API error. Please check if the model name is correct for your region/key."
        }), { status: 500 });
    }
}
