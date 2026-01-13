import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import crypto from 'crypto';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const SETTINGS_FILE = path.join(process.cwd(), 'knowledge', 'twitter_credentials.json');
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
        return '';
    }
}

function loadCredentials() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return null;
        }

        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(data);

        return {
            apiKey: parsed.apiKey ? decrypt(parsed.apiKey) : '',
            apiSecret: parsed.apiSecret ? decrypt(parsed.apiSecret) : '',
            accessToken: parsed.accessToken ? decrypt(parsed.accessToken) : '',
            accessSecret: parsed.accessSecret ? decrypt(parsed.accessSecret) : '',
        };
    } catch (error) {
        return null;
    }
}

function getRandomPost(rawText: string): string {
    if (!rawText) return "";
    const lines = rawText.split("\n");
    const processed = lines
        .map(line => {
            const parts = line.split("\t");
            let content = parts.length > 1 ? parts[1] : parts[0];
            return content.trim().replace(/^\"|\"$/g, '').replace(/\"\"/g, '"');
        })
        .filter(c => c.length > 50 && !c.includes("http") && c !== "Text");

    if (processed.length === 0) return "";
    return processed[Math.floor(Math.random() * processed.length)];
}

async function generatePost(target: string, postType: string, keywords: string, referencePost?: string) {
    const knowledgeBaseDir = path.join(process.cwd(), "knowledge");

    let internalData = "";
    try {
        internalData = fs.readFileSync(path.join(knowledgeBaseDir, "internal_data.txt"), "utf-8");
    } catch (e) { }

    let pastPosts = "";
    try {
        pastPosts = fs.readFileSync(path.join(knowledgeBaseDir, "past_posts.txt"), "utf-8");
    } catch (e) { }

    const seededPost = referencePost || getRandomPost(pastPosts);

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const extractPrompt = `
あなたは業界を知り尽くした事務所代表です。
以下の過去の投稿文から、【チャトレ業界で通用する本質的で抽象的な教訓】と【投稿の型（構成）】を抜き出してください。

【過去の投稿】
${seededPost}

余計な挨拶は不要です。教訓と型だけを簡潔に出力してください。
`;

    const extractResult = await model.generateContent(extractPrompt);
    const insights = extractResult.response.text();

    const finalPrompt = `
あなたは、チャットレディ事務所の代表です。
目的は求人です。ノウハウや実績を投稿して、ターゲット（${target}、経験者、夜職経験者）の心を掴んでください。

### 🚨 構成指示 (Opal Logic)
以下の【教訓】を今回の主張にし、抽出された【型】に沿って、事務所の【知識】を盛り込んで作成してください。

【抽出されたインサイト】
${insights}

【事務所の知識】
${internalData}

### 📝 投稿種類
今回の投稿種類: ${postType}
${keywords ? `指定キーワード: ${keywords}` : ""}

### ✍️ 執筆ルール
- 文字数: 300-400文字。
- 主張は一投稿に一つ。
- ハッシュタグは絶対に禁止。
- 夜職の方でもスッと読める、柔らかくてわかりやすい文章（難しい言葉、失礼なタメ口はNG）。
- 2-3行ごとに空行を入れ、スマホでの可読性を極限まで高めて。

投稿文のテキストのみを出力してください。返事はいらない。
`;

    const result = await model.generateContent(finalPrompt);
    return result.response.text();
}

export async function POST(request: NextRequest) {
    try {
        const { target, postType, keywords, referencePost } = await request.json();

        // 投稿文を生成
        const postText = await generatePost(target, postType, keywords, referencePost);

        // 保存された認証情報を読み込む
        const credentials = loadCredentials();

        // 認証情報チェック
        if (!credentials || !credentials.apiKey || !credentials.accessToken) {
            return NextResponse.json({
                error: 'X API credentials not configured',
                detail: '設定ページでX APIの認証情報を設定してください',
                generatedPost: postText
            }, { status: 400 });
        }

        // X APIクライアントを初期化
        const client = new TwitterApi({
            appKey: credentials.apiKey,
            appSecret: credentials.apiSecret,
            accessToken: credentials.accessToken,
            accessSecret: credentials.accessSecret,
        });

        // Xに投稿
        const tweet = await client.v2.tweet(postText);

        // posts_history.jsonに保存
        const POSTS_HISTORY_FILE = path.join(process.cwd(), 'knowledge', 'posts_history.json');
        try {
            let postsHistory: { posts: any[] } = { posts: [] };
            if (fs.existsSync(POSTS_HISTORY_FILE)) {
                const data = fs.readFileSync(POSTS_HISTORY_FILE, 'utf-8');
                postsHistory = JSON.parse(data);
            }

            postsHistory.posts.push({
                id: tweet.data.id,
                text: postText,
                timestamp: new Date().toISOString(),
                tweetId: tweet.data.id,
                target,
                postType,
                keywords
            });

            const dir = path.dirname(POSTS_HISTORY_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(POSTS_HISTORY_FILE, JSON.stringify(postsHistory, null, 2));
        } catch (e) {
            console.error('Failed to save to posts_history.json:', e);
        }

        // 履歴に保存 (既存の履歴APIも使用)
        try {
            await fetch(`${request.nextUrl.origin}/api/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    postType,
                    keywords,
                    generatedPost: postText,
                }),
            });
        } catch (e) {
            console.error('Failed to save to history:', e);
        }

        return NextResponse.json({
            success: true,
            tweet: tweet.data,
            postText
        });

    } catch (error: any) {
        console.error('Post to X error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to post to X',
            detail: error.data?.detail || 'An error occurred while posting to X'
        }, { status: 500 });
    }
}
