import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { articleTitle, keywords } = await request.json();

    if (!articleTitle) {
      return NextResponse.json(
        { error: '記事タイトルが必要です' },
        { status: 400 }
      );
    }

    // 記事タイトルからキーワードを抽出してUnsplashで検索
    const searchTerms = keywords || extractKeywords(articleTitle);
    const searchQuery = encodeURIComponent(searchTerms);

    // Unsplash Source API（完全無料）
    const unsplashUrl = `https://source.unsplash.com/1200x630/?${searchQuery}`;

    // 画像をダウンロードしてBase64に変換（オプション）
    try {
      const imageResponse = await fetch(unsplashUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        return NextResponse.json({
          success: true,
          imageUrl: dataUrl,
          directUrl: unsplashUrl,
          searchTerms: searchTerms,
          message: '画像が生成されました（Unsplash提供）',
          note: '高品質なプロフェッショナル写真を無料で使用しています'
        });
      }
    } catch (fetchError) {
      // ダウンロードに失敗した場合は直接URLを返す
      console.warn('Image download failed, returning direct URL');
    }

    // フォールバック: 直接URLを返す
    return NextResponse.json({
      success: true,
      imageUrl: unsplashUrl,
      directUrl: unsplashUrl,
      searchTerms: searchTerms,
      message: '画像URLが生成されました'
    });

  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      {
        error: '画像生成中にエラーが発生しました',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// タイトルからキーワードを抽出する簡易関数
function extractKeywords(title: string): string {
  // 一般的なストップワードを除外
  const stopWords = ['の', 'は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'も', 'な', 'する', 'ある', 'いる', 'こと', 'もの', 'ため'];

  // 数字と記号を除去
  const cleaned = title.replace(/[0-9!?！？。、]/g, ' ');

  // 単語に分割してストップワードを除外
  const words = cleaned.split(/\s+/).filter(word =>
    word.length > 1 && !stopWords.includes(word)
  );

  // 最初の2-3単語を使用
  const keywords = words.slice(0, 3).join(' ');

  // キーワードがない場合はデフォルト
  return keywords || 'business professional work';
}
