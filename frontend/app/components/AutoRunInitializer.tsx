'use client';

import { useEffect, useRef } from 'react';

/**
 * 自動運用システムを初期化するコンポーネント
 * アプリ起動時に各自動システムを開始
 */
export default function AutoRunInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 自動システムの初期化
    initializeAutoSystems();
  }, []);

  return null;
}

async function initializeAutoSystems() {
  try {
    // 1. Auto PDCA システムを起動
    await fetch('/api/auto-pdca/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }).catch(() => console.log('Auto PDCA API not available'));

    // 2. メディア生成キューを起動
    await fetch('/api/auto-media/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }).catch(() => console.log('Auto Media API not available'));

    // 3. DM Hunterの自動スケジュールを確認
    await fetch('/api/dm-hunter/schedule/start', {
      method: 'POST',
    }).catch(() => console.log('DM Hunter Schedule API not available'));

    console.log('✅ Auto-run systems initialized');
  } catch (error) {
    console.error('Failed to initialize auto-run systems:', error);
  }
}
