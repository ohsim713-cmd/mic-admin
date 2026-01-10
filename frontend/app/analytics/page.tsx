'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Heart, TrendingUp } from 'lucide-react';

type HistoryEntry = {
  id: string;
  timestamp: string;
  target: string;
  atmosphere: string;
  perks: string[];
  generatedPost: string;
};

type Stats = {
  totalPosts: number;
  targetStats: { [key: string]: number };
  atmosphereStats: { [key: string]: number };
  perkStats: { [key: string]: number };
  recentActivity: { date: string; count: number }[];
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    targetStats: {},
    atmosphereStats: {},
    perkStats: {},
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/history');
      const history: HistoryEntry[] = await res.json();

      // 統計を計算
      const targetStats: { [key: string]: number } = {};
      const atmosphereStats: { [key: string]: number } = {};
      const perkStats: { [key: string]: number } = {};
      const dailyActivity: { [key: string]: number } = {};

      history.forEach((entry) => {
        // ターゲット層の集計
        targetStats[entry.target] = (targetStats[entry.target] || 0) + 1;

        // 雰囲気の集計
        atmosphereStats[entry.atmosphere] = (atmosphereStats[entry.atmosphere] || 0) + 1;

        // アピールポイントの集計
        entry.perks.forEach((perk) => {
          perkStats[perk] = (perkStats[perk] || 0) + 1;
        });

        // 日別アクティビティ
        const date = new Date(entry.timestamp).toLocaleDateString('ja-JP');
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;
      });

      // 最近7日間のアクティビティ
      const recentActivity = Object.entries(dailyActivity)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7)
        .reverse();

      setStats({
        totalPosts: history.length,
        targetStats,
        atmosphereStats,
        perkStats,
        recentActivity,
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <div className="glass" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            {title}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</p>
        </div>
      </div>
    </div>
  );

  const RankingCard = ({ title, data, icon: Icon }: any) => {
    const sortedData = Object.entries(data)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5);

    const maxValue = sortedData.length > 0 ? (sortedData[0][1] as number) : 1;

    return (
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Icon size={20} color="#8b5cf6" />
          {title}
        </h3>

        {sortedData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            データがありません
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedData.map(([name, count], index) => (
              <div key={name}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <span>{name}</span>
                  <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>{count as number}回</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${((count as number) / maxValue) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          background: 'var(--gradient-main)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          アナリティクス
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          投稿生成の傾向と統計データ
        </p>
      </header>

      {/* サマリーカード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard
          icon={BarChart3}
          title="総投稿数"
          value={stats.totalPosts}
          color="#8b5cf6"
        />
        <StatCard
          icon={Users}
          title="ターゲット種類"
          value={Object.keys(stats.targetStats).length}
          color="#ec4899"
        />
        <StatCard
          icon={Heart}
          title="雰囲気種類"
          value={Object.keys(stats.atmosphereStats).length}
          color="#f59e0b"
        />
        <StatCard
          icon={TrendingUp}
          title="最近7日間"
          value={stats.recentActivity.reduce((sum, day) => sum + day.count, 0)}
          color="#10b981"
        />
      </div>

      {/* ランキング */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <RankingCard
          title="人気のターゲット層"
          data={stats.targetStats}
          icon={Users}
        />
        <RankingCard
          title="人気の雰囲気"
          data={stats.atmosphereStats}
          icon={Heart}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <RankingCard
          title="よく使われるアピールポイント"
          data={stats.perkStats}
          icon={TrendingUp}
        />
      </div>

      {/* 最近のアクティビティ */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <TrendingUp size={20} color="#8b5cf6" />
          最近7日間のアクティビティ
        </h3>

        {stats.recentActivity.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            データがありません
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '200px' }}>
            {stats.recentActivity.map((day) => {
              const maxCount = Math.max(...stats.recentActivity.map(d => d.count), 1);
              const heightPercent = (day.count / maxCount) * 100;

              return (
                <div
                  key={day.date}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                    {day.count}
                  </div>
                  <div style={{
                    width: '100%',
                    height: `${heightPercent}%`,
                    background: 'linear-gradient(to top, #8b5cf6, #ec4899)',
                    borderRadius: '4px 4px 0 0',
                    minHeight: '20px'
                  }} />
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    wordBreak: 'keep-all'
                  }}>
                    {day.date.split('/').slice(1).join('/')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
