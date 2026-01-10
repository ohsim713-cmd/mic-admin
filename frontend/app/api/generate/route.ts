import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-cbc';

function decrypt(text: string): string {
    try {
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return '';
    }
}

function loadGeminiApiKey(): string {
    try {
        const settingsFile = path.join(process.cwd(), '..', 'settings', 'gemini.json');
        if (!fs.existsSync(settingsFile)) {
            // フォールバック: 古いハードコードされたキーを使用
            return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
        }

        const data = fs.readFileSync(settingsFile, 'utf-8');
        const parsed = JSON.parse(data);
        const apiKey = parsed.apiKey ? decrypt(parsed.apiKey) : '';

        if (!apiKey) {
            // フォールバック
            return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
        }

        return apiKey;
    } catch (error) {
        console.error('Failed to load Gemini API key:', error);
        // フォールバック
        return "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
    }
}

const apiKey = loadGeminiApiKey();
const genAI = new GoogleGenerativeAI(apiKey);

const KNOWLEDGE_DIR = path.join(process.cwd(), '..', 'knowledge');

// ナレッジファイルを読み込む
function loadKnowledge(filename: string) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
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
        const { target: inputTarget, postType: inputPostType, keywords, referencePost, businessType = 'chat-lady', autoMode = false } = await request.json();

        const knowledgeBaseDir = path.join(process.cwd(), "..", "knowledge");

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

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
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

        // 【ステップ2】 抽出された「型」と「教訓」を使い、事務所データで本番の投稿を作る
        const finalPrompt = `
あなたは、${businessTerms.role}の代表です。
目的は求人です。ノウハウや実績を投稿して、ターゲット（${target}）の心を掴んでください。

### 🎯 ターゲット詳細
ペルソナ: ${target}
【この人の不安・悩み】
${targetConcerns.map((c: string) => `- ${c}`).join('\n')}
【この人が求めていること】
${targetDesires.map((d: string) => `- ${d}`).join('\n')}

### 🚨 構成指示 (Opal Logic)
以下の【教訓】を今回の主張にし、抽出された【型】に沿って、事務所の【知識】を盛り込んで作成してください。

【抽出されたインサイト】
${insights}

【事務所の知識】
${internalData}
${knowledgeContext ? `
### 📊 AIナレッジ（市場調査・コピーライティング知見）
${knowledgeContext}
` : ''}
${xGrowthContext}
### 📝 投稿種類
今回の投稿種類: ${postType}
${keywords ? `指定キーワード: ${keywords}` : ""}

### 🪝 一文目（フック）の指示【最重要】
一文目で読者の手を止めさせること。以下のパターンを参考に、強烈なフックで始めて：
参考パターン: 「${selectedHook}」

一文目の例:
- 「ぶっちゃけ、このまま今の収入で大丈夫？って思ったことない？」
- 「正直に言います。最初の1ヶ月は全然稼げなかった。」
- 「40歳で始めて、今こうなった」
- 「誰にも言えなかったけど、私も最初は怖かった」

### ✍️ 執筆ルール
- 文字数: 280-350文字。
- 主張は一投稿に一つ。
- ハッシュタグは絶対に禁止。
- 一文目で興味を引く（スクロールを止めさせる）。
- 「私」視点で本音っぽく語る。
- 夜職の方でもスッと読める、柔らかくてわかりやすい文章（難しい言葉、失礼なタメ口はNG）。
- 2-3行ごとに空行を入れ、スマホでの可読性を極限まで高めて。

投稿文のテキストのみを出力してください。返事はいらない。
`;

        // ストリーミングで出力
        const result = await model.generateContentStream(finalPrompt);

        // メタ情報を生成（自信度は3-5のランダム）
        const confidence = Math.floor(Math.random() * 3) + 3; // 3, 4, or 5
        const metaInfo = JSON.stringify({
            target,
            theme: postType,
            confidence,
            concerns: targetConcerns,
            desires: targetDesires
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
            model: "gemini-3-flash"
        });
        return new Response(JSON.stringify({
            error: error.message,
            detail: "Gemini API error. Please check if the model name is correct for your region/key."
        }), { status: 500 });
    }
}
