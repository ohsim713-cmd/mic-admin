'use client';

import { useState, useEffect } from 'react';
import {
  User, Palette, Bot, Target, Save, CheckCircle, Plus, X,
  Twitter, Instagram, Youtube, Sparkles
} from 'lucide-react';
import { UserProfile, Platform, DEFAULT_USER_PROFILE } from '@/lib/tenant/user-profile';

const PLATFORM_OPTIONS = [
  { type: 'stripchat', label: 'Stripchat', color: '#e91e63' },
  { type: 'chaturbate', label: 'Chaturbate', color: '#f59e0b' },
  { type: 'livejasmin', label: 'LiveJasmin', color: '#ef4444' },
  { type: 'twitter', label: 'X (Twitter)', color: '#1d9bf0' },
  { type: 'instagram', label: 'Instagram', color: '#e1306c' },
  { type: 'tiktok', label: 'TikTok', color: '#000000' },
] as const;

const CHARACTER_TYPES = [
  { value: 'cute', label: 'かわいい系', emoji: '🎀' },
  { value: 'sexy', label: 'セクシー系', emoji: '💋' },
  { value: 'cool', label: 'クール系', emoji: '✨' },
  { value: 'natural', label: 'ナチュラル系', emoji: '🌸' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'personality' | 'agent' | 'goals'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // ローカルストレージからプロフィールを読み込み
    const saved = localStorage.getItem('mic_user_profile');
    if (saved) {
      setProfile(JSON.parse(saved));
    } else {
      setProfile({
        id: `user-${Date.now()}`,
        ...DEFAULT_USER_PROFILE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, []);

  const saveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const updated = { ...profile, updatedAt: new Date().toISOString() };
      localStorage.setItem('mic_user_profile', JSON.stringify(updated));
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addPlatform = (type: Platform['type']) => {
    if (!profile) return;
    const newPlatform: Platform = {
      type,
      username: '',
      isMain: profile.platforms.length === 0,
    };
    setProfile({
      ...profile,
      platforms: [...profile.platforms, newPlatform],
    });
  };

  const removePlatform = (index: number) => {
    if (!profile) return;
    const updated = [...profile.platforms];
    updated.splice(index, 1);
    setProfile({ ...profile, platforms: updated });
  };

  const updatePlatform = (index: number, field: keyof Platform, value: string | boolean) => {
    if (!profile) return;
    const updated = [...profile.platforms];
    updated[index] = { ...updated[index], [field]: value };
    setProfile({ ...profile, platforms: updated });
  };

  if (!profile) {
    return (
      <main className="p-6 md:p-10 md:ml-64 max-w-4xl">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  const tabs = [
    { id: 'basic', label: '基本情報', icon: User },
    { id: 'personality', label: 'キャラ設定', icon: Sparkles },
    { id: 'agent', label: 'AI設定', icon: Bot },
    { id: 'goals', label: '目標', icon: Target },
  ] as const;

  return (
    <main className="p-6 md:p-10 md:ml-64 max-w-4xl">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl md:text-2xl mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
          <User size={24} />
          プロフィール設定
        </h1>
        <p className="text-white/60 text-sm">あなた専用のAIエージェントを設定</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Basic Info */}
      {activeTab === 'basic' && (
        <section className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User size={20} className="text-purple-400" />
            基本情報
          </h2>

          <div>
            <label className="block mb-2 text-sm text-white/60">表示名</label>
            <input
              type="text"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              placeholder="あなたの名前・ニックネーム"
              className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm text-white/60">自己紹介</label>
            <textarea
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="プロフィール文を入力..."
              rows={3}
              className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white resize-none"
            />
          </div>

          {/* Platforms */}
          <div>
            <label className="block mb-3 text-sm text-white/60">活動プラットフォーム</label>
            <div className="space-y-3">
              {profile.platforms.map((platform, index) => {
                const option = PLATFORM_OPTIONS.find(o => o.type === platform.type);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/10"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: option?.color || '#666' }}
                    >
                      {option?.label.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{option?.label}</div>
                      <input
                        type="text"
                        value={platform.username}
                        onChange={(e) => updatePlatform(index, 'username', e.target.value)}
                        placeholder="ユーザー名"
                        className="mt-1 w-full py-1.5 px-3 rounded bg-black/30 border border-white/10 text-sm text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platform.isMain}
                        onChange={(e) => updatePlatform(index, 'isMain', e.target.checked)}
                        className="rounded"
                      />
                      メイン
                    </label>
                    <button
                      onClick={() => removePlatform(index)}
                      className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Platform */}
            <div className="mt-4 flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.filter(o => !profile.platforms.some(p => p.type === o.type)).map(option => (
                <button
                  key={option.type}
                  onClick={() => addPlatform(option.type as Platform['type'])}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={12} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Personality */}
      {activeTab === 'personality' && (
        <section className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            キャラクター設定
          </h2>

          <div>
            <label className="block mb-3 text-sm text-white/60">キャラクタータイプ</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CHARACTER_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setProfile({
                    ...profile,
                    personality: { ...profile.personality, characterType: type.value as UserProfile['personality']['characterType'] }
                  })}
                  className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                    profile.personality.characterType === type.value
                      ? 'bg-purple-500/20 border-purple-500/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.emoji}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm text-white/60">話し方</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'casual', label: 'カジュアル' },
                { value: 'polite', label: '丁寧' },
                { value: 'playful', label: 'ポップ' },
                { value: 'professional', label: 'プロ' },
              ].map(tone => (
                <button
                  key={tone.value}
                  onClick={() => setProfile({
                    ...profile,
                    personality: { ...profile.personality, toneOfVoice: tone.value as UserProfile['personality']['toneOfVoice'] }
                  })}
                  className={`py-3 px-4 rounded-lg border transition-all cursor-pointer ${
                    profile.personality.toneOfVoice === tone.value
                      ? 'bg-purple-500/20 border-purple-500/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm text-white/60">自己紹介テンプレート（AI用）</label>
            <textarea
              value={profile.personality.introTemplate || ''}
              onChange={(e) => setProfile({
                ...profile,
                personality: { ...profile.personality, introTemplate: e.target.value }
              })}
              placeholder="AIが使う自己紹介文のテンプレート..."
              rows={3}
              className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white resize-none"
            />
          </div>
        </section>
      )}

      {/* Agent Config */}
      {activeTab === 'agent' && (
        <section className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot size={20} className="text-purple-400" />
            AI エージェント設定
          </h2>

          <div>
            <label className="block mb-3 text-sm text-white/60">AIの自律度</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'low', label: '低', desc: '確認してから実行' },
                { value: 'medium', label: '中', desc: '基本は自動' },
                { value: 'high', label: '高', desc: '完全自動' },
              ].map(level => (
                <button
                  key={level.value}
                  onClick={() => setProfile({
                    ...profile,
                    agentConfig: { ...profile.agentConfig, autonomyLevel: level.value as UserProfile['agentConfig']['autonomyLevel'] }
                  })}
                  className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                    profile.agentConfig.autonomyLevel === level.value
                      ? 'bg-purple-500/20 border-purple-500/40'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{level.label}</div>
                  <div className="text-xs text-white/60 mt-1">{level.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-black/20 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-medium">自動投稿</div>
                <div className="text-xs text-white/60">SNSへの自動投稿を有効化</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.agentConfig.autoPost.enabled}
                  onChange={(e) => setProfile({
                    ...profile,
                    agentConfig: {
                      ...profile.agentConfig,
                      autoPost: { ...profile.agentConfig.autoPost, enabled: e.target.checked }
                    }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            {profile.agentConfig.autoPost.enabled && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block mb-2 text-sm text-white/60">投稿頻度</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'low', label: '1-3回/日' },
                      { value: 'medium', label: '3-5回/日' },
                      { value: 'high', label: '5-10回/日' },
                    ].map(freq => (
                      <button
                        key={freq.value}
                        onClick={() => setProfile({
                          ...profile,
                          agentConfig: {
                            ...profile.agentConfig,
                            autoPost: { ...profile.agentConfig.autoPost, frequency: freq.value as 'low' | 'medium' | 'high' }
                          }
                        })}
                        className={`flex-1 py-2 rounded-lg border text-sm transition-all cursor-pointer ${
                          profile.agentConfig.autoPost.frequency === freq.value
                            ? 'bg-purple-500/20 border-purple-500/40'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {freq.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Goals */}
      {activeTab === 'goals' && (
        <section className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 animate-fade-in">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target size={20} className="text-purple-400" />
            月間目標
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm text-white/60">目標収入</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">¥</span>
                <input
                  type="number"
                  value={profile.goals.monthlyTarget.earnings || ''}
                  onChange={(e) => setProfile({
                    ...profile,
                    goals: {
                      ...profile.goals,
                      monthlyTarget: { ...profile.goals.monthlyTarget, earnings: Number(e.target.value) }
                    }
                  })}
                  placeholder="0"
                  className="w-full py-3 pl-8 pr-4 rounded-lg bg-black/30 border border-white/10 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm text-white/60">目標フォロワー増</label>
              <input
                type="number"
                value={profile.goals.monthlyTarget.followers || ''}
                onChange={(e) => setProfile({
                  ...profile,
                  goals: {
                    ...profile.goals,
                    monthlyTarget: { ...profile.goals.monthlyTarget, followers: Number(e.target.value) }
                  }
                })}
                placeholder="0"
                className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-white/60">配信時間（時間）</label>
              <input
                type="number"
                value={profile.goals.monthlyTarget.streamHours || ''}
                onChange={(e) => setProfile({
                  ...profile,
                  goals: {
                    ...profile.goals,
                    monthlyTarget: { ...profile.goals.monthlyTarget, streamHours: Number(e.target.value) }
                  }
                })}
                placeholder="0"
                className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-white/60">投稿数</label>
              <input
                type="number"
                value={profile.goals.monthlyTarget.posts || ''}
                onChange={(e) => setProfile({
                  ...profile,
                  goals: {
                    ...profile.goals,
                    monthlyTarget: { ...profile.goals.monthlyTarget, posts: Number(e.target.value) }
                  }
                })}
                placeholder="0"
                className="w-full py-3 px-4 rounded-lg bg-black/30 border border-white/10 text-white"
              />
            </div>
          </div>
        </section>
      )}

      {/* Save Button */}
      <div className="mt-6">
        <button
          onClick={saveProfile}
          disabled={isSaving}
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            saveSuccess
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {saveSuccess ? (
            <><CheckCircle size={18} />保存しました</>
          ) : (
            <><Save size={18} />{isSaving ? '保存中...' : 'プロフィールを保存'}</>
          )}
        </button>
      </div>
    </main>
  );
}
