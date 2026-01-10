import { NextResponse } from 'next/server';
import { startScheduler } from '@/lib/scheduler';

let schedulerStarted = false;

export async function GET() {
  if (!schedulerStarted) {
    startScheduler();
    schedulerStarted = true;
    return NextResponse.json({ message: 'Scheduler started' });
  }

  return NextResponse.json({ message: 'Scheduler already running' });
}
