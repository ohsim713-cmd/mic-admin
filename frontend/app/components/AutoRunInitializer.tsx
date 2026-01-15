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
    // スケジューラーの初期化（利用可能なAPIのみ）
    const schedulerRes = await fetch('/api/start-scheduler', {
      method: 'POST',
    }).catch(() => null);

    if (schedulerRes?.ok) {
      console.log('Scheduler initialization: Scheduler started');
    }

    console.log('✅ Auto-run systems initialized');
  } catch (error) {
    console.error('Failed to initialize auto-run systems:', error);
  }
}
