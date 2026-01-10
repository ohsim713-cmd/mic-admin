'use client';

import { useEffect, useState } from 'react';

export default function SchedulerInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      // スケジューラーを起動
      fetch('/api/start-scheduler')
        .then(res => res.json())
        .then(data => {
          console.log('Scheduler initialization:', data.message);
          setInitialized(true);
        })
        .catch(err => {
          console.error('Failed to start scheduler:', err);
        });
    }
  }, [initialized]);

  return null; // UIには何も表示しない
}
