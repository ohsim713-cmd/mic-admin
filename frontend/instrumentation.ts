export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startScheduler } = await import('./lib/scheduler');
        const { startAutomationWorker } = await import('./lib/automation-worker');

        // 既存のスケジューラーを起動
        startScheduler();

        // 自動化ワーカーを起動
        startAutomationWorker();
    }
}
