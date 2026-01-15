import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// 環境変数から API キーを取得
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// 知識ディレクトリ
const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// ヘルパー関数群
function loadKnowledge(filename: string) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadKnowledgeText(filename: string) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
}

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

/**
 * 検証AIによる採点とフィードバック
 */
async function reviewPost(content: string, target: string, model: any) {
    const reviewPrompt = `
あなたはSNSマーケティングのプロであり、辛口のエディターです。
以下の投稿文を、1日1000インプレッション獲得し、月3件の問い合わせに繋げるという目標に照らして採点してください。

【投稿文】
${content}

【ターゲット】
${target}

以下の4項目について、各25点（合計100点）で採点し、改善点を挙げてください。

1. 【フック（引き）】: 最初の1行で手が止まるか？インパクトはあるか？
2. 【信頼性】: 具体的な数字や実績があり、嘘っぽくないか？
3. 【共感・悩み】: ターゲットの悩みに寄り添えているか？
4. 【可読性】: 読みやすい改行、空白、リズムになっているか？
5. 【視点チェック】: 一人称が「私」などの個人になっていないか？（「当事務所」「うち」などの組織視点であるべき）

回答は以下のJSON形式のみで出力してください。
{
  "score": 0,
  "feedback": "改善が必要な具体的なポイント",
  "points": { "hook": 0, "trust": 0, "empathy": 0, "readability": 0 }
}
`;
    try {
        const result = await model.generateContent(reviewPrompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 70, feedback: "解析エラー" };
    } catch (e) {
        return { score: 70, feedback: "検証エラー" };
    }
}

/**
 * 修正AIによるリライト
 */
async function refinePost(content: string, feedback: string, model: any) {
    const refinePrompt = `
あなたはSNS投稿のプロです。検証担当者から以下のダメ出しを受けました。
このフィードバックを完璧に反映し、より高品質な投稿にリライトしてください。

【元の投稿】
${content}

【フィードバック】
${feedback}

【ルール】
- 一人称は「当事務所」「うち」などに固定。個人の「私」や「私の体験談」は厳禁。
- ライバー個人の昔話ではなく、事務所としての実績や運営側の本音として語る。
- 絵文字は極力使わない（使う場合も1つ、誠実さを損なわない範囲で。多用は禁止）。
- ハッシュタグ禁止。
- 2-3行ごとに空行。
- 自然で誠実なトーン。

新しい投稿文のみを出力してください。説明は不要です。
`;
    const result = await model.generateContent(refinePrompt);
    return result.response.text();
}

/**
 * メインの生成ループ
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { target: inputTarget, autoMode = false, businessType = 'chat-lady' } = body;

        let themeOptionsData = loadKnowledge('theme_options.json');
        const targetProfiles = themeOptionsData?.targetProfiles || [{ label: '未経験', concerns: [] }];
        const selectedTargetProfile = autoMode
            ? targetProfiles[Math.floor(Math.random() * targetProfiles.length)]
            : targetProfiles.find((t: any) => t.label === inputTarget) || targetProfiles[0];

        const target = selectedTargetProfile.label;
        const pastPosts = loadKnowledgeText('past_posts.txt') || "";
        const seededPost = getRandomPost(pastPosts);

        // メリット等の設定（元のコードから簡略化してロジックを保持）
        const benefitOptions = [
            { label: '在宅完全自由', description: '通勤ゼロ、好きな時間にログインするだけ。', howTo: 'スマホかPCで登録' },
            { label: '高額日払い', description: '働いた翌日に全額振込。急な出費も安心。', howTo: '申請1つで翌日着金' }
        ];
        const selectedBenefit = benefitOptions[Math.floor(Math.random() * benefitOptions.length)];

        // ライバー用ナレッジをフル導入（Google検索結果 + 各種マスターデータ）
        let knowledgeContext = "";
        const writingMaster = loadKnowledge('liver_writing_master.json');

        if (businessType === 'liver-agency') {
            const liverTrends = loadKnowledge('liver_trends.json');
            const liverCopy = loadKnowledge('liver_recruitment_copy.json');
            const marketMaster = loadKnowledge('liver_market_master.json');
            const opStrategy = loadKnowledge('liver_operation_strategy.json');
            const complianceMaster = loadKnowledge('liver_compliance_master.json');
            const viralTemplates = loadKnowledge('liver_viral_templates.json');

            if (marketMaster) {
                knowledgeContext += `\n【市場・収益】\n- プラットフォーム: ${JSON.stringify(marketMaster.platform_deep_dive)}\n- 収益予測: ${JSON.stringify(marketMaster.earnings_projections)}`;
            }

            if (opStrategy) {
                knowledgeContext += `\n【運用戦略】\n- ファン化: ${opStrategy.fan_management_tactics?.gratitude?.join('、')}\n- トラブル対策: ${opStrategy.trouble_avoidance?.harassment_handling}`;
            }

            if (complianceMaster) {
                knowledgeContext += `\n【信頼性】\n- 安全指標: ${complianceMaster.agency_selection_checklist?.green_flags?.join('、')}\n- 経費知識: ${complianceMaster.tax_and_legal?.deductible_expenses?.slice(0, 3).join('、')}\n- 最新動向: ${complianceMaster.agency_selection_checklist?.jftc_guidelines_2025}`;
            }

            if (viralTemplates) {
                const randomTpl = viralTemplates.viral_structures[Math.floor(Math.random() * viralTemplates.viral_structures.length)];
                knowledgeContext += `\n【採用すべき構成案: ${randomTpl.name}】\n- 流れ: ${randomTpl.flow}\n- フック案: ${randomTpl.example_hook}\n- 2025トレンド語: ${viralTemplates.trending_keywords_2025?.join('、')}`;
            }

            if (writingMaster) {
                knowledgeContext += `\n【ライティング心理学】\n- 構成: ${writingMaster.writingPrinciples?.webWriting?.empathyPattern}\n- アルゴリズム: ${writingMaster.writingPrinciples?.snsAlgorithm2025?.dwellTime}\n- 感情フック: ${writingMaster.psychologicalTriggersForLivers?.aspirational?.phrase}`;
            }
        }

        // --- バリエーション設定 (Angle & Goal) ---
        const postAngles = themeOptionsData?.postAngles || [
            { id: 'data', label: '数字で説得', promptHint: '具体的な数字や比較チャート風の構成を入れる' },
            { id: 'before-after', label: 'ビフォーアフター', promptHint: '過去の悩みと今の変化を対比させる' },
            { id: 'failure', label: '失敗談', promptHint: 'あえて失敗した話から入り、そこからの学びを語る' },
            { id: 'insider', label: '業界の裏話', promptHint: '事務所代表しか知らない「実は…」という情報を出す' },
            { id: 'comparison', label: '比較', promptHint: '一般的なバイトや他プラットフォームとの違いを明確にする' }
        ];
        const selectedAngle = postAngles[Math.floor(Math.random() * postAngles.length)];

        const postGoals = themeOptionsData?.postGoals || [
            { id: 'trust', label: '信頼感', promptHint: '誠実で嘘のない、本音ベースのトーン' },
            { id: 'viral', label: '共感・バズ', promptHint: '思わず「わかる」と言いたくなる感情的なフック' },
            { id: 'inquiry', label: '問い合わせ', promptHint: '最後の一押し、迷っている背中を優しく押す' }
        ];
        const selectedGoal = postGoals[Math.floor(Math.random() * postGoals.length)];

        const model = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            generationConfig: {
                temperature: 1.0, // 多様性を最大化
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });

        // --- ステップ1: 初稿作成 (Creator) ---
        const creatorPrompt = `
あなたは業界を知り尽くした事務所代表です。
今回の投稿は【${selectedAngle.label}】というアングルで、【${selectedGoal.label}】を目的に作成してください。

【メインメリット】: ${selectedBenefit.label}
【ターゲット】: ${target}
【アングルの指示】: ${selectedAngle.promptHint}
【目的の指示】: ${selectedGoal.promptHint}

【概要】: ${selectedBenefit.description}
${knowledgeContext}

【絶対的な命令】:
- 【トーン】必ず丁寧な「です・ます調」で書いてください。タメ口（〜だよ、〜だね、ねえ等）は一切禁止、即刻不採用とします。事務所代表として、誠実で礼儀正しい、かつプロフェッショナルな威厳あるトーンを貫いてください。
- 【報酬表現】「時給16,500円」という表現は、ユーザーの不信感を招くため【使用厳禁】です。代わりに「時給換算で2,000円〜3,000円以上の実績が多い」「アルバイトの数倍の報酬効率」など、現実的で納得感のある表現を使ってください。
- 【表現】絵文字は一切禁止。最後に1つだけ「💬」などの誘導アイコンを置く場合のみ許容。文中のキラキラした絵文字は一切不要です。
- 【一人称】「当事務所」「うちの事務所」に固定。「私」「僕」「自分」などの個人一人称は厳禁です。
- 【内容】「ライバー個人の日記」ではなく、「事務所運営としての視点、データ、所属ライバーの実績」をベースに語ってください。
- 文字数は280-320文字。ハッシュタグ禁止、2-3行ごとに空行。
- 「教科書的な説明」でも「馴れ馴れしい勧誘」でもなく、業界を知り尽くしたプロの「静かな自信」を言葉にした投稿にしてください。

投稿文のみを出力してください。
`;
        let result = await model.generateContent(creatorPrompt);
        let currentPost = result.response.text();

        // --- ステップ2: 検証・修正ループ (Loop) ---
        let loopCount = 0;
        let finalScore = 0;
        let lastFeedback = "";

        while (loopCount < 2) { // 最大2回修正（計3回生成）
            const review = await reviewPost(currentPost, target, model);
            finalScore = review.score;
            lastFeedback = review.feedback;

            if (finalScore >= 90) break; // 90点以上なら合格

            // 修正
            currentPost = await refinePost(currentPost, lastFeedback, model);
            loopCount++;
        }

        // --- 出力準備 ---
        const metaInfo = JSON.stringify({
            target: selectedBenefit.label, // UIでバッジとして表示される「メリット名」
            theme: `${target} | ${selectedAngle.label}`, // サブ情報として表示される「ターゲットとアングル」
            score: finalScore,
            confidence: finalScore,
            loops: loopCount,
            feedback: lastFeedback
        });

        return new Response(`<!--META:${metaInfo}-->\n${currentPost}`, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
        });

    } catch (error: any) {
        console.error('Generation Error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
