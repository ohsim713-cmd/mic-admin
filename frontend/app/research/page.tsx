'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Target, Calendar, Users,
  Lightbulb, Copy, RefreshCw, ArrowRight, Check
} from 'lucide-react';
import { getUpcomingEvents, UpcomingEvent } from '@/lib/research/site-analyzer';
import { cn } from '@/lib/utils';

type TabType = 'competitor' | 'profile' | 'ideas' | 'events';

const tabs = [
  { id: 'competitor' as TabType, label: '競合分析', icon: Users },
  { id: 'profile' as TabType, label: 'プロフィール', icon: Target },
  { id: 'ideas' as TabType, label: '配信ネタ', icon: Lightbulb },
  { id: 'events' as TabType, label: 'イベント', icon: Calendar },
];

const styleOptions = [
  { value: 'cute', label: 'かわいい' },
  { value: 'sexy', label: 'セクシー' },
  { value: 'cool', label: 'クール' },
  { value: 'natural', label: 'ナチュラル' },
];

const ideaCategories = [
  { icon: '💬', label: 'トーク系' },
  { icon: '🎮', label: 'ゲーム系' },
  { icon: '🎉', label: 'イベント' },
  { icon: '👥', label: '参加型' },
];

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabType>('competitor');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisInput, setAnalysisInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [myProfile, setMyProfile] = useState({ bio: '', style: 'natural' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUpcomingEvents(getUpcomingEvents());
    const saved = localStorage.getItem('mic_user_profile');
    if (saved) {
      const profile = JSON.parse(saved);
      setMyProfile({
        bio: profile.bio || '',
        style: profile.personality?.characterType || 'natural',
      });
    }
  }, []);

  const analyze = async (type: string, input: unknown) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const response = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
      });
      const data = await response.json();
      setAnalysisResult(data.analysis || 'エラーが発生しました');
    } catch {
      setAnalysisResult('分析中にエラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen p-8 md:p-12 md:ml-[280px]">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-semibold text-white/95 mb-2">リサーチ</h1>
          <p className="text-sm text-white/40">
            競合分析・プロフィール改善・配信ネタ
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex gap-2 p-1.5 glass rounded-2xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setAnalysisResult(null);
                  }}
                  className={cn(
                    "relative flex-1 py-3.5 px-4 rounded-xl text-sm font-medium",
                    "flex items-center justify-center gap-2.5",
                    "transition-all duration-200",
                    isActive
                      ? "text-white"
                      : "text-[var(--muted-foreground)] hover:text-white/70"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[var(--violet-500)]/15 border border-[var(--violet-500)]/25 rounded-xl"
                      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    />
                  )}
                  <Icon size={18} className="relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Competitor Analysis */}
            {activeTab === 'competitor' && (
              <div className="card">
                <label className="block text-sm text-white/60 mb-4">
                  分析したい配信者のプロフィールを貼り付け
                </label>
                <textarea
                  value={analysisInput}
                  onChange={(e) => setAnalysisInput(e.target.value)}
                  placeholder="プロフィールページの内容をここにコピペ..."
                  rows={6}
                  className="input resize-none"
                />
                <motion.button
                  onClick={() => analyze('competitor', analysisInput)}
                  disabled={isAnalyzing || !analysisInput.trim()}
                  className={cn(
                    "mt-6 w-full py-4 rounded-xl font-medium",
                    "flex items-center justify-center gap-3",
                    "transition-all duration-200",
                    isAnalyzing || !analysisInput.trim()
                      ? "bg-white/[0.03] text-white/30 cursor-not-allowed"
                      : "btn-primary"
                  )}
                  whileHover={!isAnalyzing && analysisInput.trim() ? { scale: 1.01 } : {}}
                  whileTap={!isAnalyzing && analysisInput.trim() ? { scale: 0.99 } : {}}
                >
                  {isAnalyzing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {isAnalyzing ? '分析中...' : '分析する'}
                </motion.button>
              </div>
            )}

            {/* Profile Improvement */}
            {activeTab === 'profile' && (
              <div className="card">
                <label className="block text-sm text-white/60 mb-4">
                  あなたの自己紹介文
                </label>
                <textarea
                  value={myProfile.bio}
                  onChange={(e) => setMyProfile({ ...myProfile, bio: e.target.value })}
                  placeholder="現在の自己紹介文を入力..."
                  rows={4}
                  className="input resize-none"
                />

                <label className="block text-sm text-white/60 mt-6 mb-4">
                  キャラクタースタイル
                </label>
                <div className="flex flex-wrap gap-3">
                  {styleOptions.map((style) => (
                    <motion.button
                      key={style.value}
                      onClick={() => setMyProfile({ ...myProfile, style: style.value })}
                      className={cn(
                        "px-5 py-2.5 rounded-xl text-sm font-medium",
                        "transition-all duration-200",
                        myProfile.style === style.value
                          ? "bg-[var(--violet-500)]/15 border border-[var(--violet-500)]/30 text-white"
                          : "bg-white/[0.03] border border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.05]"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {style.label}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={() => analyze('profile', myProfile)}
                  disabled={isAnalyzing}
                  className={cn(
                    "mt-8 w-full py-4 rounded-xl font-medium",
                    "flex items-center justify-center gap-3",
                    isAnalyzing
                      ? "bg-white/[0.03] text-white/30 cursor-not-allowed"
                      : "btn-primary"
                  )}
                  whileHover={!isAnalyzing ? { scale: 1.01 } : {}}
                  whileTap={!isAnalyzing ? { scale: 0.99 } : {}}
                >
                  {isAnalyzing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {isAnalyzing ? '分析中...' : '改善案を提案'}
                </motion.button>
              </div>
            )}

            {/* Stream Ideas */}
            {activeTab === 'ideas' && (
              <div className="card">
                <p className="text-white/50 text-sm mb-8">
                  あなたのスタイルと今後のイベントに合わせた配信ネタを提案します
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  {ideaCategories.map((item, i) => (
                    <motion.div
                      key={i}
                      className="glass-subtle rounded-2xl p-5 text-center"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                    >
                      <div className="text-3xl mb-2">{item.icon}</div>
                      <div className="text-xs text-white/50">{item.label}</div>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  onClick={() => analyze('ideas', { style: myProfile.style, events: upcomingEvents.slice(0, 3) })}
                  disabled={isAnalyzing}
                  className={cn(
                    "w-full py-4 rounded-xl font-medium",
                    "flex items-center justify-center gap-3",
                    isAnalyzing
                      ? "bg-white/[0.03] text-white/30 cursor-not-allowed"
                      : "btn-primary"
                  )}
                  whileHover={!isAnalyzing ? { scale: 1.01 } : {}}
                  whileTap={!isAnalyzing ? { scale: 0.99 } : {}}
                >
                  {isAnalyzing ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Lightbulb size={18} />
                  )}
                  {isAnalyzing ? '生成中...' : 'ネタを提案'}
                </motion.button>
              </div>
            )}

            {/* Events */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <motion.div
                    className="card text-center py-12 text-white/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    直近のイベントはありません
                  </motion.div>
                ) : (
                  upcomingEvents.map((event, i) => {
                    const date = new Date(event.date);
                    const daysUntil = Math.ceil(
                      (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <motion.div
                        key={i}
                        className="card-interactive flex items-center gap-5"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="w-16 h-16 rounded-2xl bg-[var(--violet-500)]/10 border border-[var(--violet-500)]/20 flex flex-col items-center justify-center flex-shrink-0">
                          <div className="text-xl font-bold text-[var(--violet-400)]">
                            {date.getDate()}
                          </div>
                          <div className="text-[10px] text-[var(--violet-400)]/70">
                            {date.toLocaleDateString('ja-JP', { month: 'short' })}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-3 mb-1">
                            {event.name}
                            {daysUntil <= 7 && (
                              <span className="badge-warning text-[10px]">
                                {daysUntil}日後
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/40 truncate">
                            {event.suggestions.join(' / ')}
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-white/20 flex-shrink-0" />
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {/* Analysis Result */}
            <AnimatePresence>
              {analysisResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="gradient-border p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--violet-500)]/15 flex items-center justify-center">
                        <Sparkles size={18} className="text-[var(--violet-400)]" />
                      </div>
                      <span className="font-semibold text-[var(--violet-400)]">
                        AI分析結果
                      </span>
                    </div>
                    <motion.button
                      onClick={() => copyToClipboard(analysisResult)}
                      className="btn-ghost"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {copied ? (
                        <Check size={18} className="text-emerald-400" />
                      ) : (
                        <Copy size={18} />
                      )}
                    </motion.button>
                  </div>
                  <div className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                    {analysisResult}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
