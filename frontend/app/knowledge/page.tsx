'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Brain, RefreshCw, TrendingUp, Instagram, Clock, Sparkles, Users, MessageSquare, Briefcase } from 'lucide-react';

type TabType = 'ai-nail' | 'ai-chatlady';

interface KnowledgeStatus {
  nailTrends: { exists: boolean; updatedAt?: string };
  instagramTips: { exists: boolean; updatedAt?: string };
  chatladyTrends: { exists: boolean; updatedAt?: string };
  recruitmentCopy: { exists: boolean; updatedAt?: string };
}

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabType>('ai-chatlady');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI ナレッジ状態
  const [aiStatus, setAiStatus] = useState<KnowledgeStatus>({
    nailTrends: { exists: false },
    instagramTips: { exists: false },
    chatladyTrends: { exists: false },
    recruitmentCopy: { exists: false }
  });
  const [isUpdatingTrends, setIsUpdatingTrends] = useState(false);
  const [isUpdatingTips, setIsUpdatingTips] = useState(false);
  const [isUpdatingChatlady, setIsUpdatingChatlady] = useState(false);
  const [isUpdatingRecruitment, setIsUpdatingRecruitment] = useState(false);
  const [trendsData, setTrendsData] = useState<any>(null);
  const [tipsData, setTipsData] = useState<any>(null);
  const [chatladyData, setChatladyData] = useState<any>(null);
  const [recruitmentData, setRecruitmentData] = useState<any>(null);

  useEffect(() => {
    loadAiKnowledgeStatus();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // AI ナレッジ関連の関数
  const loadAiKnowledgeStatus = async () => {
    try {
      const trendsRes = await fetch('/api/knowledge/nail-trends');
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setAiStatus(prev => ({
          ...prev,
          nailTrends: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setTrendsData(data.data);
      }

      const tipsRes = await fetch('/api/knowledge/instagram-tips');
      if (tipsRes.ok) {
        const data = await tipsRes.json();
        setAiStatus(prev => ({
          ...prev,
          instagramTips: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setTipsData(data.data);
      }

      const chatladyRes = await fetch('/api/knowledge/chatlady-trends');
      if (chatladyRes.ok) {
        const data = await chatladyRes.json();
        setAiStatus(prev => ({
          ...prev,
          chatladyTrends: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setChatladyData(data.data);
      }

      const recruitmentRes = await fetch('/api/knowledge/recruitment-copy');
      if (recruitmentRes.ok) {
        const data = await recruitmentRes.json();
        setAiStatus(prev => ({
          ...prev,
          recruitmentCopy: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setRecruitmentData(data.data);
      }
    } catch (error) {
      console.error('Failed to load AI knowledge status:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNailTrends = async () => {
    setIsUpdatingTrends(true);
    try {
      const res = await fetch('/api/knowledge/nail-trends', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setAiStatus(prev => ({
          ...prev,
          nailTrends: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setTrendsData(data.data);
        showMessage('success', 'ネイルトレンド情報を更新しました！');
      } else {
        showMessage('error', '更新に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      showMessage('error', '更新に失敗しました');
    } finally {
      setIsUpdatingTrends(false);
    }
  };

  const updateInstagramTips = async () => {
    setIsUpdatingTips(true);
    try {
      const res = await fetch('/api/knowledge/instagram-tips', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setAiStatus(prev => ({
          ...prev,
          instagramTips: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setTipsData(data.data);
        showMessage('success', 'Instagram運用ノウハウを更新しました！');
      } else {
        showMessage('error', '更新に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      showMessage('error', '更新に失敗しました');
    } finally {
      setIsUpdatingTips(false);
    }
  };

  const updateChatladyTrends = async () => {
    setIsUpdatingChatlady(true);
    try {
      const res = await fetch('/api/knowledge/chatlady-trends', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setAiStatus(prev => ({
          ...prev,
          chatladyTrends: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setChatladyData(data.data);
        showMessage('success', 'チャットレディ業界トレンドを更新しました！');
      } else {
        showMessage('error', '更新に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      showMessage('error', '更新に失敗しました');
    } finally {
      setIsUpdatingChatlady(false);
    }
  };

  const updateRecruitmentCopy = async () => {
    setIsUpdatingRecruitment(true);
    try {
      const res = await fetch('/api/knowledge/recruitment-copy', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setAiStatus(prev => ({
          ...prev,
          recruitmentCopy: { exists: true, updatedAt: data.data?.updatedAt }
        }));
        setRecruitmentData(data.data);
        showMessage('success', '求人コピーライティングノウハウを更新しました！');
      } else {
        showMessage('error', '更新に失敗しました: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      showMessage('error', '更新に失敗しました');
    } finally {
      setIsUpdatingRecruitment(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未取得';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'ai-chatlady' as TabType, label: 'チャットレディ', icon: Users },
    { id: 'ai-nail' as TabType, label: 'ネイルサロン', icon: Sparkles }
  ];

  return (
    <div style={{ padding: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Brain size={32} />
          ナレッジベース管理
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          AIが投稿文生成時に参照する知識ベースを管理します
        </p>
      </header>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === tab.id ? 'var(--card-bg)' : 'transparent',
              borderTop: activeTab === tab.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
              borderLeft: activeTab === tab.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
              borderRight: activeTab === tab.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
              borderBottom: 'none',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              fontSize: '0.95rem',
              fontWeight: activeTab === tab.id ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: message.type === 'success' ? '#10b981' : '#ef4444'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* ネイルサロン AIナレッジタブ */}
      {activeTab === 'ai-nail' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* ネイルトレンド情報 */}
            <section className="glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <TrendingUp size={20} color="#10b981" />
                  ネイルトレンド情報
                </h2>
                {aiStatus.nailTrends.exists ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Clock size={12} />
                  最終更新: {formatDate(aiStatus.nailTrends.updatedAt)}
                </div>
                <p>季節トレンド、人気カラー、デザインパターン</p>
              </div>

              {trendsData && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem'
                }}>
                  <div>トレンド: {trendsData.trends?.length || 0}件</div>
                  <div>デザイン: {trendsData.popularDesigns?.length || 0}件</div>
                </div>
              )}

              <button
                onClick={updateNailTrends}
                disabled={isUpdatingTrends}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  background: isUpdatingTrends ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: isUpdatingTrends ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} style={{ animation: isUpdatingTrends ? 'spin 1s linear infinite' : 'none' }} />
                {isUpdatingTrends ? '更新中...' : '更新'}
              </button>
            </section>

            {/* Instagram運用ノウハウ */}
            <section className="glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <Instagram size={20} color="#ec4899" />
                  Instagram運用ノウハウ
                </h2>
                {aiStatus.instagramTips.exists ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Clock size={12} />
                  最終更新: {formatDate(aiStatus.instagramTips.updatedAt)}
                </div>
                <p>キャプション戦略、ハッシュタグ、投稿タイミング</p>
              </div>

              {tipsData && (
                <div style={{
                  background: 'rgba(236, 72, 153, 0.1)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem'
                }}>
                  <div>戦略: {tipsData.captionStrategies?.length || 0}種類</div>
                  <div>フォーミュラ: {tipsData.captionFormulas?.length || 0}種類</div>
                </div>
              )}

              <button
                onClick={updateInstagramTips}
                disabled={isUpdatingTips}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  background: isUpdatingTips ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: isUpdatingTips ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} style={{ animation: isUpdatingTips ? 'spin 1s linear infinite' : 'none' }} />
                {isUpdatingTips ? '更新中...' : '更新'}
              </button>
            </section>
          </div>

          {/* 説明 */}
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '1rem' }}>
              <Sparkles size={18} color="var(--accent-secondary)" />
              AIナレッジについて
            </h3>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
              <p>AIナレッジを更新すると、画像生成やキャプション作成の品質が向上します。週1回程度の更新をおすすめします。</p>
            </div>
          </section>

          <style jsx global>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* チャットレディ AIナレッジタブ */}
      {activeTab === 'ai-chatlady' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* チャットレディ業界トレンド */}
            <section className="glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <TrendingUp size={20} color="#8b5cf6" />
                  業界トレンド・市場情報
                </h2>
                {aiStatus.chatladyTrends.exists ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Clock size={12} />
                  最終更新: {formatDate(aiStatus.chatladyTrends.updatedAt)}
                </div>
                <p>収入相場、ターゲット層分析、成功パターン</p>
              </div>

              {chatladyData && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem'
                }}>
                  <div>ターゲット層: {chatladyData.targetAudienceAnalysis?.primaryTargets?.length || 0}種類</div>
                  <div>成功パターン: {chatladyData.successPatterns?.highPerformingPosts?.length || 0}件</div>
                </div>
              )}

              <button
                onClick={updateChatladyTrends}
                disabled={isUpdatingChatlady}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  background: isUpdatingChatlady ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: isUpdatingChatlady ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} style={{ animation: isUpdatingChatlady ? 'spin 1s linear infinite' : 'none' }} />
                {isUpdatingChatlady ? '更新中...' : '更新'}
              </button>
            </section>

            {/* 求人コピーライティング */}
            <section className="glass" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                  <MessageSquare size={20} color="#f59e0b" />
                  求人コピーライティング
                </h2>
                {aiStatus.recruitmentCopy.exists ? (
                  <CheckCircle size={18} color="#10b981" />
                ) : (
                  <AlertCircle size={18} color="#ef4444" />
                )}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Clock size={12} />
                  最終更新: {formatDate(aiStatus.recruitmentCopy.updatedAt)}
                </div>
                <p>心理学ベースのコピー技術、CTA、反論処理</p>
              </div>

              {recruitmentData && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem'
                }}>
                  <div>見出しパターン: {Object.keys(recruitmentData.headlineFormulas || {}).length}種類</div>
                  <div>CTAパターン: {Object.keys(recruitmentData.ctaPatterns || {}).length}種類</div>
                </div>
              )}

              <button
                onClick={updateRecruitmentCopy}
                disabled={isUpdatingRecruitment}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '6px',
                  background: isUpdatingRecruitment ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: isUpdatingRecruitment ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={16} style={{ animation: isUpdatingRecruitment ? 'spin 1s linear infinite' : 'none' }} />
                {isUpdatingRecruitment ? '更新中...' : '更新'}
              </button>
            </section>
          </div>

          {/* 説明 */}
          <section className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', marginBottom: '1rem' }}>
              <Briefcase size={18} color="var(--accent-secondary)" />
              チャットレディ求人ナレッジについて
            </h3>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
              <p>業界トレンドと求人コピーライティングのノウハウを活用して、ターゲットに刺さる求人投稿を生成します。定期的な更新で最新の市場動向を反映させましょう。</p>
            </div>
          </section>

          <style jsx global>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
