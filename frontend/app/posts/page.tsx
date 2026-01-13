'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Send, RefreshCw, Check, Clock, TrendingUp, Zap, Activity, User } from 'lucide-react';

// 実際のXアカウント情報
const accounts = [
  { id: 'mic_chat_', name: 'MIC チャット', handle: '@mic_chat_', avatar: '💬', theme: 'lifestyle', platform: 'X' },
  { id: 'ms_stripchat', name: 'MS Stripchat', handle: '@ms_stripchat', avatar: '🌟', theme: 'success', platform: 'X' },
  { id: 'tt_liver', name: 'TT Liver', handle: '@tt_liver', avatar: '🎥', theme: 'freedom', platform: 'X' },
];

interface GeneratedPost {
  id: string;
  content: string;
  platform: 'twitter' | 'threads' | 'bluesky';
  accountId: string;
  status: 'generating' | 'ready' | 'posted' | 'scheduled';
  createdAt: string;
  engagement?: number;
}

const platformConfig = {
  twitter: { label: 'X/Twitter', color: '#1da1f2', maxLength: 280 },
  threads: { label: 'Threads', color: '#000000', maxLength: 500 },
  bluesky: { label: 'Bluesky', color: '#0085ff', maxLength: 300 },
};

// アカウントのテーマに合わせた投稿テンプレート
const contentsByTheme: Record<string, string[]> = {
  lifestyle: [
    '✨ 在宅で自由に働ける時代が来ました！\n\n私も最初は不安でしたが、今では自分のペースで働きながら、しっかり収入を得ています。\n\n通勤なし、人間関係のストレスなし、自分の好きな時間に働ける。\n\nこんな働き方、あなたも始めてみませんか？\n\n気になる方はプロフィールのリンクからチェック👀\n\n#副業 #在宅ワーク #新しい働き方 #自由な生活',
    '☀️ おはようございます！\n\n今日も自宅からお仕事スタートです。\n\n朝はゆっくりコーヒーを飲んで、好きな音楽を聴きながら作業。\n\nこんな働き方ができるなんて、1年前は想像もしていませんでした。\n\n「働き方を変えたい」と思っている方、その気持ちを大切にしてください。\n\n行動すれば、必ず未来は変わります✨\n\n#朝活 #在宅ワーカー #理想の朝',
    '🏠 今日のワークスペース紹介♪\n\nお気に入りのカフェで、美味しいラテを飲みながらお仕事中☕️\n\n在宅ワークの良いところは、こうやって気分転換に場所を変えられること！\n\n・自宅のデスク\n・カフェ\n・コワーキングスペース\n・旅行先のホテル\n\nどこでも働けるって最高です🌟\n\n#ノマドワーカー #カフェ仕事 #自由な働き方',
  ],
  success: [
    '🚀 月収100万円達成しました！\n\nこれは自慢ではなく、「あなたにもできる」ということを伝えたいんです。\n\n半年前の私は、毎月のお給料日を待つだけの生活でした。\n\n今は、自分の努力次第で収入が変わる。そんな刺激的な毎日を送っています。\n\n本気で人生を変えたい方、一緒に頑張りましょう💪\n\n#収入アップ #自己投資 #成功への道',
    '📊 今月の実績報告✨\n\n・総収入: 127万円\n・作業時間: 1日平均4時間\n・お休み: 週2日しっかり確保\n\n会社員時代は毎日12時間働いて手取り25万でした...\n\n今は時間も収入も自分でコントロールできる生活。\n\n「どうやってるの？」ってよく聞かれるので、興味ある方はDMください💬\n\n#副業収入 #時間の自由 #人生変わった',
    '💰 高収入×自由な時間\n\nこの2つを同時に手に入れるのは難しいと思っていませんか？\n\n実は、今の時代それが可能なんです。\n\n私は毎日カフェでお仕事したり、旅行しながら稼いだり、理想のライフスタイルを実現中です☕️✈️\n\n「どうやって？」と思った方、ぜひプロフィールをチェックしてみてください！\n\n#理想の生活 #自由な働き方 #高収入副業',
  ],
  freedom: [
    '🌟 「自分のペースで稼げる仕事」って本当にあるの？\n\n答えは「YES」です！\n\n私が始めて3ヶ月、今では会社員時代の収入を超えました。\n\n・好きな時間に働ける\n・ノルマなし\n・完全在宅OK\n・未経験でもスタートできる\n\n興味がある方は、まずはお気軽にDMください💬\n\n#高収入 #副業初心者 #ライフスタイル',
    '💭 「安定」と「自由」\n\nどちらも欲しいと思いませんか？\n\n会社員時代は安定はあっても自由がなかった。\nフリーランスになったら自由はあっても不安定...\n\nでも今の私は、両方を手に入れることができました。\n\nその秘密、知りたい方はプロフィールから詳細をチェックしてください👀\n\n#安定収入 #自由な生活 #新しいキャリア',
    '✈️ 来週から沖縄でワーケーション！\n\n「仕事があるから旅行できない」\n\nそんな生活とはもうおさらば👋\n\n今の私は、どこにいても収入が入ってくる仕組みを作りました。\n\nビーチを眺めながらお仕事して、午後は観光🌺\n\nこんな働き方、興味ありませんか？\n\n#ワーケーション #沖縄旅行 #自由な人生',
  ],
  dream: [
    '💫 新しい働き方、始めてみませんか？\n\n「今の生活を変えたい」\n「もっと自由に働きたい」\n「収入を増やしたい」\n\nそんな想いを持っている方へ。\n\n私も1年前は同じ気持ちでした。でも今は、時間も収入も自分でコントロールできる生活を送っています。\n\nサポート体制も充実しているので、未経験の方でも安心してスタートできます✨\n\n詳しくはDMでお話しましょう！\n\n#人生を変える #副業 #新生活',
    '🌈 1年前の私へ\n\n「大丈夫、あなたの選択は間違ってなかったよ」\n\n不安だらけで始めた副業。\n周りには反対する人もいました。\n\nでも今、毎日が充実していて、収入も自由も手に入れた。\n\n過去の自分に感謝しています。\n一歩踏み出してくれてありがとう。\n\n今迷っている方へ。その一歩が未来を変えます✨\n\n#自分を信じて #夢への一歩',
    '⭐ 夢リスト、いくつ叶えた？\n\n私の今年叶えた夢：\n✅ 月収100万円達成\n✅ 海外旅行3回\n✅ ブランドバッグ購入\n✅ 親にプレゼント\n✅ 脱サラ成功\n\n1年前は全部「いつか」だった。\n\n行動すれば、「いつか」は「今」になる✨\n\nあなたの夢リスト、一緒に叶えませんか？\n\n#夢を叶える #目標達成 #なりたい自分',
  ],
  happy: [
    '🎯 今日も目標達成！\n\nコツコツ積み重ねる毎日が、本当に楽しいです。\n\n最初は「私にもできるかな...」と不安でしたが、サポート体制が充実していたおかげで、今では安定して結果を出せるようになりました。\n\n大切なのは、一歩踏み出す勇気だけ。\n\n同じように悩んでいる方、一緒に頑張りませんか？\n\n#目標達成 #継続は力なり #成長記録',
    '🎀 今日のハッピーなこと♡\n\n・朝起きたい時間に起きれた\n・お気に入りのカフェでランチ\n・午後は映画を観に行った\n・夜は友達とディナー\n\n平日なのにこんな1日過ごせるなんて💕\n\n「いつか自由になりたい」じゃなくて\n「今、自由になる」を選んで本当によかった✨\n\n#毎日がハッピー #自由な生活 #幸せな日々',
    '💝 嬉しいご報告！\n\n私のもとで始めた方から\n「初月で30万円稼げました！」って連絡が✨\n\n自分のことのように嬉しい😭\n\n正しい方法で努力すれば、結果は必ずついてくる。\n\n次はあなたの番です！\n一緒に頑張りましょう💪\n\n#仲間の成功 #喜びの報告 #次はあなたの番',
  ],
};

export default function PostsPage() {
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [stats, setStats] = useState({ total: 0, posted: 0, scheduled: 0 });

  // 自動生成シミュレーション
  useEffect(() => {
    if (!autoMode) return;

    const generatePost = () => {
      const platforms: Array<'twitter' | 'threads' | 'bluesky'> = ['twitter', 'threads', 'bluesky'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const account = accounts[Math.floor(Math.random() * accounts.length)];

      const newPost: GeneratedPost = {
        id: `post-${Date.now()}`,
        content: '',
        platform,
        accountId: account.id,
        status: 'generating',
        createdAt: new Date().toISOString(),
      };

      setPosts(prev => [newPost, ...prev.slice(0, 19)]);
      setIsGenerating(true);

      // 生成完了をシミュレート
      setTimeout(() => {
        // アカウントのテーマに合わせたコンテンツを選択
        const contents = contentsByTheme[account.theme] || contentsByTheme.lifestyle;

        setPosts(prev =>
          prev.map(p =>
            p.id === newPost.id
              ? {
                  ...p,
                  content: contents[Math.floor(Math.random() * contents.length)],
                  status: Math.random() > 0.5 ? 'ready' : 'scheduled',
                  engagement: Math.floor(Math.random() * 500) + 100,
                }
              : p
          )
        );
        setIsGenerating(false);
        setStats(prev => ({
          total: prev.total + 1,
          posted: prev.posted + (Math.random() > 0.5 ? 1 : 0),
          scheduled: prev.scheduled + (Math.random() > 0.5 ? 1 : 0),
        }));
      }, 2000 + Math.random() * 3000);
    };

    // 初回生成
    generatePost();

    // 定期生成
    const interval = setInterval(generatePost, 15000 + Math.random() * 10000);
    return () => clearInterval(interval);
  }, [autoMode]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
            }}>
              <FileText size={24} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                投稿文
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'rgba(156, 163, 175, 0.8)' }}>
                AI が自動でSNS投稿文を生成・投稿
              </p>
            </div>
          </div>
        </div>

        {/* 自動モードトグル */}
        <button
          onClick={() => setAutoMode(!autoMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            background: autoMode
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))'
              : 'rgba(255, 255, 255, 0.05)',
            color: autoMode ? '#22c55e' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          {autoMode ? (
            <>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              自動生成 ON
            </>
          ) : (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280' }} />
              自動生成 OFF
            </>
          )}
        </button>
      </div>

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: '生成済み', value: stats.total, icon: Sparkles, color: '#8b5cf6' },
          { label: '投稿済み', value: stats.posted, icon: Send, color: '#22c55e' },
          { label: 'スケジュール', value: stats.scheduled, icon: Clock, color: '#f59e0b' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <stat.icon size={18} color={stat.color} />
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{stat.label}</span>
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'white',
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 生成中インジケーター */}
      {isGenerating && (
        <div style={{
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: '#8b5cf6',
            animation: 'spin 1s linear infinite',
          }} />
          <div>
            <div style={{ fontWeight: '600', color: 'white', marginBottom: '0.25rem' }}>
              AI が投稿文を生成中...
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a78bfa' }}>
              最適なコンテンツを自動作成しています
            </div>
          </div>
        </div>
      )}

      {/* 投稿リスト */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map((post) => {
          const config = platformConfig[post.platform];
          const account = accounts.find(a => a.id === post.accountId) || accounts[0];
          return (
            <div
              key={post.id}
              style={{
                padding: '1.25rem',
                background: post.status === 'generating'
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.05))'
                  : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '14px',
                border: post.status === 'generating'
                  ? '1px solid rgba(139, 92, 246, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.3s',
              }}
            >
              {/* アカウント情報 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}>
                  {account.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: 'white', fontSize: '0.9rem' }}>
                    {account.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {account.handle}
                  </div>
                </div>
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  background: `${config.color}20`,
                  color: config.color,
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  {config.label}
                </span>
              </div>

              {/* ステータス行 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}>
                <span style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  background: post.status === 'generating'
                    ? 'rgba(139, 92, 246, 0.2)'
                    : post.status === 'posted'
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)',
                  color: post.status === 'generating'
                    ? '#a78bfa'
                    : post.status === 'posted'
                      ? '#22c55e'
                      : '#f59e0b',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  {post.status === 'generating' && (
                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  )}
                  {post.status === 'posted' && <Check size={12} />}
                  {post.status === 'scheduled' && <Clock size={12} />}
                  {post.status === 'generating' ? '生成中' : post.status === 'posted' ? '投稿済み' : 'スケジュール済み'}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {new Date(post.createdAt).toLocaleTimeString('ja-JP')}
                </span>
              </div>

              {post.status === 'generating' ? (
                <div style={{
                  height: '120px',
                  background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05), rgba(139, 92, 246, 0.1))',
                  borderRadius: '8px',
                  animation: 'shimmer 1.5s infinite',
                  backgroundSize: '200% 100%',
                }} />
              ) : (
                <p style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: '1.8',
                  fontSize: '0.95rem',
                  whiteSpace: 'pre-wrap',
                }}>
                  {post.content}
                </p>
              )}

              {post.engagement !== undefined && post.status !== 'generating' && (
                <div style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <TrendingUp size={14} color="#22c55e" />
                  <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>
                    予測エンゲージメント: {post.engagement}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {posts.length === 0 && (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#6b7280',
          }}>
            <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>自動生成を開始しています...</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
